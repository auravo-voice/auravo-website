import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createPracticeSession,
  createSessionScores,
  createSessionTranscript,
} from "@/db/queries/practice-persist";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import { TranscriptionUnavailableError } from "@/lib/transcription";
import { ensureUserProfile } from "@/db/queries/user";
import { PRACTICE_LIBRARY } from "@/lib/practice/library";
import { runAnalysis, serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Persists a single daily-practice exercise. Uses the canonical {@link runAnalysis} pipeline so the
 * scores + explanations + recommendation logic match every other speaking flow in the product.
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
  const promptIdRaw = form.get("promptId");
  const promptId = typeof promptIdRaw === "string" ? promptIdRaw.trim() : "";
  const prompt = PRACTICE_LIBRARY.find((p) => p.id === promptId);
  if (!prompt) {
    return NextResponse.json({ error: "Unknown practice prompt." }, { status: 400 });
  }

  await ensureUserProfile(userId);

  const sessionId = randomUUID();
  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const { absolutePath } = await writeTempAudioFile(sessionId, audio, ext);

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

  const transcriptId = randomUUID();
  const scoresId = randomUUID();

  await createPracticeSession({
    id: sessionId,
    userId,
    kind: "daily_practice",
    title: prompt.title,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    audioFile: audio,
  });
  await createSessionTranscript({
    id: transcriptId,
    sessionId,
    text: analysis.transcript,
    adapter: analysis.adapter,
    analysisJson: serializeAnalysisForPersistence(analysis),
  });
  await createSessionScores({
    id: scoresId,
    sessionId,
    pronunciation: analysis.scores.pronunciation,
    grammar: analysis.scores.grammar,
    fluency: analysis.scores.fluency,
    vocabulary: analysis.scores.vocabulary,
    fillerWords: analysis.scores.filler_words,
    pacing: analysis.scores.pacing,
  });

  const dimensions = scoresToRadarDimensions(analysis.scores);
  const averageScore = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);

  return NextResponse.json({
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
}
