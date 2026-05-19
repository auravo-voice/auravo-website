import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createOnboardingBaseline,
  createPracticeSession,
  createSessionScores,
  createSessionTranscript,
} from "@/db/queries/practice-persist";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import { getOnboardingGoalLabel, isOnboardingGoalId } from "@/lib/coach/dashboard";
import { ensureUserProfile } from "@/db/queries/user";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  auravoPendingBaselineSessionCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { writeBaselineHandoffToken } from "@/lib/assessment/baseline-handoff-disk";
import { runAnalysis, serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import { TranscriptionUnavailableError } from "@/lib/transcription";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy “single recording” onboarding path. Mirrors `/api/practice/exercise`: everything runs through
 * {@link runAnalysis} so persisted `analysis_json` matches `assessment/draft/finalize` and the dashboard.
 */
export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;
  const userId = auth;

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

  const tempKey = randomUUID();
  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const { absolutePath } = await writeTempAudioFile(tempKey, audio, ext);

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

  const sessionId = await createPracticeSession({
    userId,
    kind: "onboarding_assessment",
    title: "Initial assessment",
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    audioFile: audio,
  });
  await createSessionTranscript({
    sessionId,
    text: canonical.transcript,
    adapter: canonical.adapter,
    analysisJson: serializeAnalysisForPersistence(canonical),
  });
  await createSessionScores({
    sessionId,
    pronunciation: canonical.scores.pronunciation,
    grammar: canonical.scores.grammar,
    fluency: canonical.scores.fluency,
    vocabulary: canonical.scores.vocabulary,
    fillerWords: canonical.scores.filler_words,
    pacing: canonical.scores.pacing,
  });
  await createOnboardingBaseline(userId, sessionId);

  try {
    await writeBaselineHandoffToken(sessionId, userId);
  } catch {
    /* handoff is best-effort */
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
  res.cookies.set(AURAVO_PENDING_BASELINE_SESSION_COOKIE, sessionId, auravoPendingBaselineSessionCookieOptions());
  return res;
}
