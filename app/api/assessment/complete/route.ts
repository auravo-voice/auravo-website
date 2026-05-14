import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDataDir, getDb } from "@/db/client";
import { onboardingBaseline, practiceSession, sessionScores, sessionTranscript } from "@/db/schema";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import { getOnboardingGoalLabel, isOnboardingGoalId } from "@/lib/coach/dashboard";
import { ensureUserProfile } from "@/db/queries/user";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_USER_ID_COOKIE,
  auravoPendingBaselineSessionCookieOptions,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { writeBaselineHandoffToken } from "@/lib/assessment/baseline-handoff-disk";
import { runAnalysis, serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import { TranscriptionUnavailableError } from "@/lib/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy “single recording” onboarding path. Mirrors `/api/practice/exercise`: everything runs through
 * {@link runAnalysis} so persisted `analysis_json` matches `assessment/draft/finalize` and the dashboard.
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
  const goalRaw = form.get("goalId");
  const goalId = typeof goalRaw === "string" && goalRaw.trim() !== "" ? goalRaw.trim() : null;

  if (goalId != null && !isOnboardingGoalId(goalId)) {
    return NextResponse.json({ error: "Invalid goal id." }, { status: 400 });
  }

  await ensureUserProfile(userId, goalId != null ? { onboardingGoalId: goalId } : {});

  const sessionId = randomUUID();
  const dataDir = getDataDir();
  const uploadsDir = path.join(dataDir, "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const relativePath = path.join("uploads", `${sessionId}.${ext}`).split(path.sep).join("/");
  const absolutePath = path.join(dataDir, relativePath);

  const buf = Buffer.from(await audio.arrayBuffer());
  await fs.writeFile(absolutePath, buf);

  let canonical;
  try {
    canonical = await runAnalysis({
      audio: { mode: "single", absolutePath, durationMs: Number.isFinite(durationMs) ? durationMs : null },
      context: {
        userId,
        runCoachSummary: true,
        learnerContextHint: { displayName: "Learner" },
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

  if (!canonical.transcript.trim()) {
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
        kind: "onboarding_assessment",
        title: "Initial assessment",
        audioRelativePath: relativePath,
        durationMs: Number.isFinite(durationMs) ? durationMs : null,
        createdAt: now,
      })
      .run();
    tx.insert(sessionTranscript)
      .values({
        id: transcriptId,
        sessionId,
        text: canonical.transcript,
        adapter: canonical.adapter,
        analysisJson: serializeAnalysisForPersistence(canonical),
        createdAt: now,
      })
      .run();
    tx.insert(sessionScores)
      .values({
        id: scoresId,
        sessionId,
        pronunciation: canonical.scores.pronunciation,
        grammar: canonical.scores.grammar,
        fluency: canonical.scores.fluency,
        vocabulary: canonical.scores.vocabulary,
        fillerWords: canonical.scores.filler_words,
        pacing: canonical.scores.pacing,
        createdAt: now,
      })
      .run();
    tx.insert(onboardingBaseline)
      .values({ userId, sessionId, createdAt: now })
      .onConflictDoUpdate({
        target: onboardingBaseline.userId,
        set: { sessionId, createdAt: now },
      })
      .run();
  });

  try {
    writeBaselineHandoffToken(sessionId, userId);
  } catch {
    /* disk handoff is best-effort; SQLite row is still the source of truth */
  }

  const dimensions = scoresToRadarDimensions(canonical.scores);
  const averageScore = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);

  const res = NextResponse.json({
    ok: true,
    userId,
    sessionId,
    transcript: canonical.transcript.slice(0, 12_000),
    dimensions,
    averageScore,
    goalLabel: goalId != null ? getOnboardingGoalLabel(goalId) ?? null : null,
    analysis: canonical.deep,
    voiceAnalysis: {
      adapter: canonical.adapter,
      durationSec: canonical.durationSec,
      derivedMetrics: canonical.voice.derivedMetrics,
      explanations: canonical.voice.explanations,
      qualityFlags: canonical.voice.qualityFlags,
      acousticFeatures: canonical.voice.acousticFeatures,
      vadFeatures: canonical.voice.vadFeatures,
    },
    coachSummary: canonical.coachSummary,
    recommendedExercises: canonical.candidateExercises,
  });
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  res.cookies.set(AURAVO_PENDING_BASELINE_SESSION_COOKIE, sessionId, auravoPendingBaselineSessionCookieOptions());
  return res;
}
