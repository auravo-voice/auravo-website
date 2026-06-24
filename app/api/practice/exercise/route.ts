import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDataDir, getDb } from "@/db/client";
import { practiceSession, sessionScores, sessionTranscript } from "@/db/schema";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import { TranscriptionUnavailableError } from "@/lib/transcription";
import { ensureUserProfile } from "@/db/queries/user";
import {
  AURAVO_USER_ID_COOKIE,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { PRACTICE_LIBRARY } from "@/lib/practice/library";
import { runAnalysis, serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import {
  assertCanRecordVocaPractice,
  QuickAnalysisPaywallError,
  recordCompletedVocaPractice,
  shouldCountQuickAnalysisRun,
} from "@/lib/billing/quick-analysis-entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Persists a single daily-practice exercise. Uses the canonical {@link runAnalysis} pipeline so the
 * scores + explanations + recommendation logic match every other speaking flow in the product.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  let userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value;
  if (!userId) {
    userId = randomUUID();
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }
  const durationRaw = form.get("durationMs");
  const durationMs =
    typeof durationRaw === "string" && durationRaw.trim() !== "" ? Number.parseInt(durationRaw, 10) : NaN;
  const promptIdRaw = form.get("promptId");
  const promptId = typeof promptIdRaw === "string" ? promptIdRaw.trim() : "";
  const prompt = PRACTICE_LIBRARY.find((p) => p.id === promptId);
  if (!prompt) {
    return NextResponse.json({ error: "Unknown practice prompt." }, { status: 400 });
  }

  await ensureUserProfile(userId);

  try {
    await assertCanRecordVocaPractice(userId);
  } catch (e) {
    if (e instanceof QuickAnalysisPaywallError) {
      return NextResponse.json(
        { error: e.message, code: e.code, usage: e.usage },
        { status: 402 },
      );
    }
    throw e;
  }

  const sessionId = randomUUID();
  const dataDir = getDataDir();
  const uploadsDir = path.join(dataDir, "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const relativePath = path.join("uploads", `${sessionId}.${ext}`).split(path.sep).join("/");
  const absolutePath = path.join(dataDir, relativePath);
  const buf = Buffer.from(await audio.arrayBuffer());
  await fs.writeFile(absolutePath, buf);

  let analysis;
  try {
    analysis = await runAnalysis({
      audio: { mode: "single", absolutePath, durationMs: Number.isFinite(durationMs) ? durationMs : null },
      context: {
        userId,
        runCoachSummary: true,
        excludeExerciseIds: [prompt.id],
        exerciseContext: {
          exerciseId: prompt.id,
          title: prompt.title,
          subtitle: prompt.subtitle,
          category: prompt.category,
          focus: prompt.focus,
          coachingGoal: prompt.coachingGoal,
          promptText: prompt.promptText,
          targetDurationSec: prompt.targetDurationSec,
        },
      },
    });
  } catch (e) {
    if (e instanceof TranscriptionUnavailableError) {
      return NextResponse.json(
        { error: e.message, code: "transcription_unavailable" },
        { status: 503 },
      );
    }
    throw e;
  }

  if (!analysis.transcript) {
    return NextResponse.json(
      { error: "No speech detected in the recording. Try again in a quieter environment." },
      { status: 422 },
    );
  }

  const now = Date.now();
  const transcriptId = randomUUID();
  const scoresId = randomUUID();
  const db = getDb();
  db.transaction((tx) => {
    tx.insert(practiceSession)
      .values({
        id: sessionId,
        userId,
        kind: "daily_practice",
        title: prompt.title,
        audioRelativePath: relativePath,
        durationMs: Number.isFinite(durationMs) ? durationMs : null,
        createdAt: now,
      })
      .run();
    tx.insert(sessionTranscript)
      .values({
        id: transcriptId,
        sessionId,
        text: analysis.transcript,
        adapter: analysis.adapter,
        analysisJson: serializeAnalysisForPersistence(analysis),
        createdAt: now,
      })
      .run();
    tx.insert(sessionScores)
      .values({
        id: scoresId,
        sessionId,
        pronunciation: analysis.scores.pronunciation,
        grammar: analysis.scores.grammar,
        fluency: analysis.scores.fluency,
        vocabulary: analysis.scores.vocabulary,
        fillerWords: analysis.scores.filler_words,
        pacing: analysis.scores.pacing,
        createdAt: now,
      })
      .run();
  });

  if (await shouldCountQuickAnalysisRun(userId)) {
    await recordCompletedVocaPractice(userId);
  }

  const dimensions = scoresToRadarDimensions(analysis.scores);
  const averageScore = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);

  const res = NextResponse.json({
    ok: true,
    userId,
    sessionId,
    promptId: prompt.id,
    focus: prompt.focus,
    transcript: analysis.transcript.slice(0, 12_000),
    dimensions,
    averageScore,
    analysis: analysis.deep,
    voiceAnalysis: {
      adapter: analysis.adapter,
      modelName: analysis.modelName,
      language: analysis.language,
      durationSec: analysis.durationSec,
      wordTimings: analysis.voice.wordTimings,
      asrConfidence: analysis.voice.asrConfidence,
      fillerStats: analysis.voice.fillerStats,
      pauseStats: analysis.voice.pauseStats,
      acousticFeatures: analysis.voice.acousticFeatures,
      acousticReason: analysis.voice.acousticReason,
      vadFeatures: analysis.voice.vadFeatures,
      vadReason: analysis.voice.vadReason,
      derivedMetrics: analysis.voice.derivedMetrics,
      scores: analysis.voice.scores,
      explanations: analysis.voice.explanations,
      qualityFlags: analysis.voice.qualityFlags,
    },
    coachSummary: analysis.coachSummary,
    taskReview: analysis.taskReview,
    recommendedExercises: analysis.candidateExercises,
  });
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  return res;
}
