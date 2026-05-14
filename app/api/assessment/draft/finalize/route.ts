import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDataDir, getDb } from "@/db/client";
import {
  onboardingBaseline,
  practiceSession,
  sessionScores,
  sessionTranscript,
} from "@/db/schema";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import { getOnboardingGoalLabel, isOnboardingGoalId } from "@/lib/coach/dashboard";
import { ensureUserProfile } from "@/db/queries/user";
import { writeBaselineHandoffToken } from "@/lib/assessment/baseline-handoff-disk";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_USER_ID_COOKIE,
  auravoPendingBaselineSessionCookieOptions,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import {
  ASSESSMENT_SEGMENT_KINDS,
  segmentDisplayLabel,
  type AssessmentSegmentKind,
} from "@/lib/assessment/segments";
import {
  attachDraftSegmentsToSession,
  listDraftSegments,
} from "@/db/queries/baseline-segments";
import { isUuidLike } from "@/lib/util/is-uuid-like";
import { runAnalysis, serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import { TranscriptionUnavailableError } from "@/lib/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finalize the initial assessment. The four segment audios are concatenated with ffmpeg and run
 * through the canonical {@link runAnalysis} pipeline — this is intentionally the highest-quality
 * analysis flow in the product because the resulting baseline drives the entire learning path.
 *
 * If real transcription is unavailable, we fall back to the already-stored per-segment transcripts
 * (concatenated as plain text) so the learner still gets a baseline; the response includes a
 * `degraded: true` flag and the UI surfaces a warning.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value ?? "";
  if (!userId || !isUuidLike(userId)) {
    return NextResponse.json({ error: "No active session. Start the assessment again." }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* tolerate empty body */
  }
  const goalRaw = body && typeof body === "object" && "goalId" in body ? (body as { goalId?: unknown }).goalId : null;
  const goalId = typeof goalRaw === "string" && goalRaw.trim() !== "" ? goalRaw.trim() : null;
  if (goalId != null && !isOnboardingGoalId(goalId)) {
    return NextResponse.json({ error: "Invalid goal id." }, { status: 400 });
  }
  await ensureUserProfile(userId, goalId != null ? { onboardingGoalId: goalId } : {});

  const drafts = await listDraftSegments(userId);
  const haveByKind: Partial<Record<AssessmentSegmentKind, (typeof drafts)[number]>> = {};
  for (const d of drafts) haveByKind[d.segmentKind] = d;
  const missing = ASSESSMENT_SEGMENT_KINDS.filter((k) => !haveByKind[k]);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Still need ${missing.length} segment${missing.length === 1 ? "" : "s"}: ${missing
          .map(segmentDisplayLabel)
          .join(", ")}.`,
        missing,
      },
      { status: 400 },
    );
  }

  const orderedDrafts = ASSESSMENT_SEGMENT_KINDS.map((k) => haveByKind[k]!);
  const dataDir = getDataDir();
  const absolutePaths = orderedDrafts.map((d) => path.join(dataDir, d.audioRelativePath));
  const totalDurationMs = orderedDrafts.reduce((a, d) => a + (d.durationMs ?? 0), 0) || null;
  const fallbackTranscript = orderedDrafts
    .map((d) => (d.transcript ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  // Run the canonical analysis on the concatenated audio. If real transcription is unavailable,
  // gracefully degrade to the per-segment transcripts that were already produced live.
  let analysis;
  let degraded = false;
  try {
    analysis = await runAnalysis({
      audio: { mode: "concat", absolutePaths, totalDurationMs },
      context: {
        userId,
        runCoachSummary: true,
        learnerContextHint: { displayName: "Learner" },
      },
    });
  } catch (e) {
    if (!(e instanceof TranscriptionUnavailableError)) throw e;
    if (fallbackTranscript.length < 1) {
      return NextResponse.json(
        { error: e.message, code: "transcription_unavailable" },
        { status: 503 },
      );
    }
    degraded = true;
    analysis = await runAnalysis({
      preTranscribed: { text: fallbackTranscript, adapter: "draft-segments-fallback" },
      context: { userId, runCoachSummary: true },
    });
  }

  if (analysis.transcript.length < 1) {
    return NextResponse.json(
      { error: "Could not transcribe your recordings. Try re-recording at least one segment." },
      { status: 422 },
    );
  }

  const sessionId = randomUUID();
  const primaryAudio = orderedDrafts[0]!.audioRelativePath;
  const manifest = orderedDrafts.map((d) => ({
    kind: d.segmentKind,
    audioRelativePath: d.audioRelativePath,
    durationMs: d.durationMs,
  }));
  const now = Date.now();

  const db = getDb();
  db.transaction((tx) => {
    tx.insert(practiceSession)
      .values({
        id: sessionId,
        userId,
        kind: "onboarding_assessment",
        title: "Initial assessment",
        audioRelativePath: primaryAudio,
        durationMs: totalDurationMs,
        createdAt: now,
        segmentsJson: JSON.stringify(manifest),
      })
      .run();
    tx.insert(sessionTranscript)
      .values({
        id: randomUUID(),
        sessionId,
        text: analysis.transcript,
        adapter: analysis.adapter,
        analysisJson: serializeAnalysisForPersistence(analysis),
        createdAt: now,
      })
      .run();
    tx.insert(sessionScores)
      .values({
        id: randomUUID(),
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
    tx.insert(onboardingBaseline)
      .values({ userId, sessionId, createdAt: now })
      .onConflictDoUpdate({
        target: onboardingBaseline.userId,
        set: { sessionId, createdAt: now },
      })
      .run();
  });
  attachDraftSegmentsToSession(userId, sessionId);

  try {
    writeBaselineHandoffToken(sessionId, userId);
  } catch {
    /* disk handoff is best-effort; SQLite row remains the source of truth */
  }

  const dimensions = scoresToRadarDimensions(analysis.scores);
  const averageScore = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);

  const res = NextResponse.json({
    ok: true,
    userId,
    sessionId,
    transcript: analysis.transcript.slice(0, 12_000),
    dimensions,
    averageScore,
    goalLabel: goalId != null ? getOnboardingGoalLabel(goalId) ?? null : null,
    analysis: analysis.deep,
    voiceAnalysis: {
      adapter: analysis.adapter,
      modelName: analysis.modelName,
      durationSec: analysis.durationSec,
      derivedMetrics: analysis.voice.derivedMetrics,
      explanations: analysis.voice.explanations,
      qualityFlags: analysis.voice.qualityFlags,
      acousticAvailable: analysis.voice.acousticFeatures != null,
      vadAvailable: analysis.voice.vadFeatures != null,
    },
    coachSummary: analysis.coachSummary,
    recommendedExercises: analysis.candidateExercises,
    degraded,
  });
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  res.cookies.set(AURAVO_PENDING_BASELINE_SESSION_COOKIE, sessionId, auravoPendingBaselineSessionCookieOptions());
  return res;
}
