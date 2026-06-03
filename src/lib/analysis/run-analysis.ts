import "server-only";

import path from "node:path";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

import { getTempAudioRoot } from "@/lib/storage/temp-audio";
import { resolveAudioAbsolutePath } from "@/lib/storage/audio-path";
import { extractAcousticFeatures, type AcousticResult } from "@/lib/audio/acoustic";
import { extractVadFeatures, type VadResult } from "@/lib/audio/vad";
import {
  getTranscriptionAdapter,
  TranscriptionUnavailableError,
  type TranscriptionResult,
} from "@/lib/transcription";
import { concatAudioToWav } from "@/lib/audio/concat";
import { fingerprintAudioInputs } from "@/lib/audio/audio-fingerprint";
import { scoresFromAnalysis, type VoiceAnalysis } from "@/lib/analysis/scoring";
import { analyzeGrammarWithGroq, type GrammarAnalysisResult } from "@/lib/analysis/grammar-analysis";
import { analyzeTranscriptDeep } from "@/lib/assessment/transcript-deep-analysis";
import type { BaselineAnalysis } from "@/lib/assessment/baseline-analysis-types";
import { computeConversationMetrics, describeConversation, type ConversationMetrics, type ConversationTurnInput } from "@/lib/analysis/conversation";
import { getOnboardingBaselineForUser } from "@/db/queries/baseline";
import { buildWeekPlan } from "@/lib/practice/week-plan";
import {
  pickRecommendedExercises,
  type RecommendedExercise,
} from "@/lib/practice/recommend";
import { generateFinalCoachingSummary, type FinalCoachingSummary } from "@/lib/coach/final-summary";
import {
  generateExerciseTaskReview,
  type ExerciseTaskReviewResult,
  type ExerciseContextForTaskReview,
} from "@/lib/coach/task-review";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";

/**
 * Canonical analysis result. Every finalize route — initial assessment, daily practice, simulation,
 * meeting rehearsal — funnels through {@link runAnalysis} and persists this shape into
 * `session_transcript.analysisJson` so the rest of the app reads from one well-known schema.
 */
export type CanonicalAnalysis = {
  /** What was actually heard (full plain text, suitable for `session_transcript.text`). */
  transcript: string;
  /** Adapter name that produced the transcript, e.g. "faster-whisper" or "faster-whisper-strict". */
  adapter: string;
  modelName: string | null;
  language: string | null;
  /** End-to-end audio duration in seconds, when known. */
  durationSec: number | null;

  /** Per-dimension audio-grounded scores (the canonical six). */
  scores: SixDimensionScores;
  /** Audio-grounded score evidence + key metrics from `scoresFromAnalysis`. */
  voice: VoiceAnalysis;
  /** Legacy transcript-only analysis (grammar flags + pronunciation tips). Kept for back-compat. */
  deep: BaselineAnalysis;
  /** Groq grammar review (tense, articles, agreement, etc.) when available. */
  grammarAnalysis: GrammarAnalysisResult | null;

  /** Optional conversational metrics — present only for simulation + meeting-rehearsal flows. */
  conversation: ConversationMetrics | null;
  conversationCoachNotes: string[];

  /** Final coaching summary (LLM-authored over structured metrics; deterministic fallback when Ollama is down). */
  coachSummary: FinalCoachingSummary;
  /** Exercise-specific task review (daily practice); null when no exercise context (e.g. assessment). */
  taskReview: ExerciseTaskReviewResult | null;
  /** Candidate exercises shown to the LLM — also rendered as clickable cards in the UI. */
  candidateExercises: RecommendedExercise[];
};

/**
 * Inputs to {@link runAnalysis}. Callers can either supply audio inputs (full pipeline runs) or
 * provide already-transcribed text via `preTranscribed` when the route has reason to skip
 * re-transcription (e.g. simulation finalize where each turn was transcribed live). When both audio
 * and preTranscribed are supplied, audio wins — the orchestrator re-transcribes the concatenated
 * audio because Whisper word timings on the full recording yield better pacing/pause scores than
 * stitching per-turn transcripts together.
 */
export type RunAnalysisInput = {
  /** Path to a single audio file relative to `data/`, OR a sequence to concat. Use one or the other. */
  audio?:
    | { mode: "single"; absolutePath: string; durationMs?: number | null }
    | { mode: "concat"; absolutePaths: string[]; totalDurationMs?: number | null };
  /** Pre-transcribed text when audio is not provided. Used only as a fallback path. */
  preTranscribed?: {
    text: string;
    adapter?: string;
    durationSec?: number | null;
  };
  /** Conversation context for simulations / meeting rehearsals. */
  conversation?: { turns: ConversationTurnInput[] };
  /** User context used for exercise recommendations + coach summary personalisation. */
  context: {
    userId: string;
    /** When true, runs the Ollama coach summary. Set false for tests / debugging. */
    runCoachSummary?: boolean;
    /** Exclude these exercise ids from recommendations (e.g. the one just completed). */
    excludeExerciseIds?: string[];
    /** Pretty label for the conversation / session, used inside the LLM prompt. */
    learnerContextHint?: { displayName?: string; streakDays?: number };
    /**
     * When false and {@link exerciseContext} is set, skips the extra Ollama task-review call (tests / debugging).
     * Default: task review runs whenever exerciseContext is present.
     */
    runExerciseTaskReview?: boolean;
    /**
     * When set, runs {@link generateExerciseTaskReview} after scoring so feedback is grounded in the
     * actual exercise prompt (daily practice).
     */
    exerciseContext?: ExerciseContextForTaskReview | null;
  };
};

async function asAbsolute(relativeOrAbsolute: string): Promise<string> {
  if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  if (relativeOrAbsolute.startsWith("http://") || relativeOrAbsolute.startsWith("https://")) {
    return resolveAudioAbsolutePath(relativeOrAbsolute);
  }
  return path.join(getTempAudioRoot(), path.basename(relativeOrAbsolute));
}

/**
 * Resolve the audio file to feed into Whisper/acoustic/VAD. Concatenates with ffmpeg when the caller
 * supplies multiple inputs. Returns the absolute path plus a `cleanup` function which the orchestrator
 * runs in a `finally` after the heavy pipeline stages complete.
 */
async function resolveAudio(input: RunAnalysisInput["audio"]): Promise<{
  audioPath: string;
  totalDurationMs: number | null;
  cleanup: () => Promise<void>;
  /** Fingerprint of upstream source files for subprocess cache hits (reload / dev retries). */
  featureCacheKey: string | null;
} | null> {
  if (!input) return null;
  if (input.mode === "single") {
    const abs = await asAbsolute(input.absolutePath);
    if (!existsSync(abs)) {
      throw new Error(`runAnalysis: audio file missing: ${abs}`);
    }
    const featureCacheKey = await fingerprintAudioInputs([abs]);
    return {
      audioPath: abs,
      totalDurationMs: input.durationMs ?? null,
      cleanup: async () => {},
      featureCacheKey,
    };
  }
  const abs = await Promise.all(input.absolutePaths.map((p) => asAbsolute(p)));
  const featureCacheKey = await fingerprintAudioInputs(abs);
  const { wavPath, workDir } = await concatAudioToWav(abs);
  return {
    audioPath: wavPath,
    totalDurationMs: input.totalDurationMs ?? null,
    cleanup: async () => {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    },
    featureCacheKey,
  };
}

/**
 * Canonical voice-analysis pipeline. Used by every finalize route in the product so onboarding
 * baseline, daily practice, simulations, and meeting rehearsals all produce the same rich
 * `CanonicalAnalysis` payload (scores + explanations + key metrics + recommended next exercises).
 *
 * Pipeline order matches the layered architecture in the spec:
 *   audio → transcription ∥ VAD + acoustic (parallel) → derive → score → recommend → coach summary.
 *
 * Failure model: if real transcription is required but unavailable (faster-whisper down without
 * placeholder fallback enabled), this throws a {@link TranscriptionUnavailableError}; routes catch
 * and return HTTP 503 with a clear message. All other subsystems degrade gracefully.
 */
export async function runAnalysis(input: RunAnalysisInput): Promise<CanonicalAnalysis> {
  const resolved = await resolveAudio(input.audio);
  const baselinePromise = getOnboardingBaselineForUser(input.context.userId);

  // Stages 1–2: Whisper and acoustic/VAD only read the audio file — run them in parallel to cut wall-clock time.
  let transcription: TranscriptionResult;
  let adapterName: string;
  let acoustic: AcousticResult;
  let vad: VadResult;

  if (resolved) {
    const adapter = getTranscriptionAdapter();
    adapterName = adapter.name;
    const cacheKey = resolved.featureCacheKey;
    const [transcriptionResult, acousticResult, vadResult] = await Promise.all([
      adapter.transcribe(resolved.audioPath),
      extractAcousticFeatures(resolved.audioPath, { cacheKey }),
      extractVadFeatures(resolved.audioPath, { cacheKey }),
    ]);
    transcription = transcriptionResult;
    acoustic = acousticResult;
    vad = vadResult;
  } else if (input.preTranscribed) {
    adapterName = input.preTranscribed.adapter ?? "pre-transcribed";
    transcription = {
      text: input.preTranscribed.text,
      durationSec: input.preTranscribed.durationSec ?? undefined,
    };
    acoustic = { available: false, reason: "no_audio_input" };
    vad = { available: false, reason: "no_audio_input" };
  } else {
    throw new Error("runAnalysis: neither audio nor preTranscribed input was provided");
  }

  if (acoustic.available === false) {
    console.error("[runAnalysis] acoustic unavailable:", acoustic.reason);
  }
  if (vad.available === false) {
    console.error("[runAnalysis] vad unavailable:", vad.reason);
  }

  const transcriptText = transcription.text.trim();

  const audioDurationSec =
    transcription.durationSec ??
    (resolved?.totalDurationMs != null ? resolved.totalDurationMs / 1000 : null);

  const scoringInput = {
    transcript: transcriptText,
    wordTimings: transcription.wordTimings,
    segments: transcription.segments,
    durationSec: audioDurationSec,
    acoustic,
    vad,
  };

  // Stage 3: derive + score (deterministic). Grammar uses regex fallback until Groq returns.
  let voice = scoresFromAnalysis({ ...scoringInput, grammarAnalysis: null });
  let deep = analyzeTranscriptDeep(transcriptText, transcription.asrWordHints, null);

  // Stage 4: conversation metrics (simulations + meeting rehearsals only).
  const conversation = input.conversation
    ? computeConversationMetrics(input.conversation.turns)
    : null;
  const conversationCoachNotes = conversation ? describeConversation(conversation) : [];

  // Stage 5: exercise recommendation. Baseline fetch started during audio pipeline above.
  const baseline = await baselinePromise;
  const baselineScores: SixDimensionScores = baseline
    ? {
        pronunciation: baseline.scores.pronunciation,
        grammar: baseline.scores.grammar,
        fluency: baseline.scores.fluency,
        vocabulary: baseline.scores.vocabulary,
        filler_words: baseline.scores.fillerWords,
        pacing: baseline.scores.pacing,
      }
    : voice.scores;
  const weekPlan = buildWeekPlan({
    userId: input.context.userId,
    scores: baselineScores,
    goalId: baseline?.user.onboardingGoalId ?? null,
  });
  const candidateExercises = pickRecommendedExercises({
    scores: voice.scores,
    weekPlan,
    excludeIds: input.context.excludeExerciseIds,
    count: 3,
  });

  const learnerContext = {
    displayName: baseline?.user.displayName ?? input.context.learnerContextHint?.displayName ?? "Learner",
    goalLabel: baseline?.user.onboardingGoalId ?? null,
    streakDays: input.context.learnerContextHint?.streakDays,
  };

  // Stages 5b + 6: daily practice runs two coach calls — run in parallel (task review has its own UI block).
  let taskReview: ExerciseTaskReviewResult | null = null;
  let coachSummary: FinalCoachingSummary;
  const wantsTaskReview =
    input.context.exerciseContext != null && input.context.runExerciseTaskReview !== false;
  const wantsCoachSummary = input.context.runCoachSummary !== false;

  const coachInput = {
    transcript: transcriptText,
    analysis: voice,
    acousticFeatures: acoustic.available ? acoustic.features : null,
    candidateExercises,
    learnerContext,
    exerciseContext: input.context.exerciseContext ?? null,
    taskReview: null as ExerciseTaskReviewResult | null,
  };

  const emptyCoachSummary = (): FinalCoachingSummary => ({
    biggestIssue: null,
    strength: null,
    patterns: [],
    acousticPatterns: [],
    summary: "",
    strengths: [],
    improvementAreas: [],
    scoreExplanations: undefined,
    recommendedExerciseIds: candidateExercises.map((c) => c.id),
    recommendationRationale: "",
    fallbackUsed: true,
    warning: null,
  });

  const grammarGroqPromise: Promise<GrammarAnalysisResult | null> = process.env.GROQ_API_KEY?.trim()
    ? analyzeGrammarWithGroq(transcriptText)
    : Promise.resolve(null);

  let grammarAnalysis: GrammarAnalysisResult | null = null;

  const applyGrammarResult = (result: GrammarAnalysisResult | null) => {
    if (!result) return;
    grammarAnalysis = result;
    voice = scoresFromAnalysis({ ...scoringInput, grammarAnalysis });
    deep = analyzeTranscriptDeep(transcriptText, transcription.asrWordHints, grammarAnalysis);
  };

  const patchCoachSummaryGrammar = (summary: FinalCoachingSummary): FinalCoachingSummary => {
    if (!grammarAnalysis || !summary.scoreExplanations) return summary;
    return {
      ...summary,
      scoreExplanations: {
        ...summary.scoreExplanations,
        grammar: voice.explanations.grammar,
      },
    };
  };

  // Stage 6: Groq grammar analysis runs in parallel with coaching summary (both need the transcript).
  if (wantsTaskReview && wantsCoachSummary && input.context.exerciseContext) {
    const exercise = input.context.exerciseContext;
    const [grammarSettled, taskReviewSettled, coachSettled] = await Promise.allSettled([
      grammarGroqPromise,
      generateExerciseTaskReview({ exercise, transcript: transcriptText, voice }),
      generateFinalCoachingSummary({ ...coachInput, exerciseContext: exercise }),
    ]);
    if (grammarSettled.status === "fulfilled") {
      applyGrammarResult(grammarSettled.value);
    } else {
      console.error("[runAnalysis] Groq grammar analysis failed:", grammarSettled.reason);
    }
    if (taskReviewSettled.status === "fulfilled") {
      taskReview = taskReviewSettled.value;
    } else {
      console.error("[runAnalysis] exercise task review failed:", taskReviewSettled.reason);
    }
    if (coachSettled.status === "fulfilled") {
      coachSummary = patchCoachSummaryGrammar(coachSettled.value);
    } else {
      console.error("[runAnalysis] coaching summary failed:", coachSettled.reason);
      coachSummary = emptyCoachSummary();
    }
  } else {
    const groqParallel: Promise<unknown>[] = [grammarGroqPromise];

    if (wantsTaskReview && input.context.exerciseContext) {
      groqParallel.push(
        generateExerciseTaskReview({
          exercise: input.context.exerciseContext,
          transcript: transcriptText,
          voice,
        }),
      );
    }

    if (wantsCoachSummary) {
      groqParallel.push(
        generateFinalCoachingSummary({
          ...coachInput,
          taskReview,
        }),
      );
    }

    const settled = await Promise.allSettled(groqParallel);

    const grammarSettled = settled[0] as PromiseSettledResult<GrammarAnalysisResult | null>;
    if (grammarSettled.status === "fulfilled") {
      applyGrammarResult(grammarSettled.value);
    } else {
      console.error("[runAnalysis] Groq grammar analysis failed:", grammarSettled.reason);
    }

    let idx = 1;
    if (wantsTaskReview && input.context.exerciseContext) {
      const taskReviewSettled = settled[idx] as PromiseSettledResult<ExerciseTaskReviewResult>;
      idx += 1;
      if (taskReviewSettled.status === "fulfilled") {
        taskReview = taskReviewSettled.value;
      } else {
        console.error("[runAnalysis] exercise task review failed:", taskReviewSettled.reason);
      }
    }

    if (wantsCoachSummary) {
      const coachSettled = settled[idx] as PromiseSettledResult<FinalCoachingSummary>;
      if (coachSettled.status === "fulfilled") {
        coachSummary = patchCoachSummaryGrammar(coachSettled.value);
      } else {
        console.error("[runAnalysis] coaching summary failed:", coachSettled.reason);
        coachSummary = emptyCoachSummary();
      }
    } else {
      coachSummary = emptyCoachSummary();
    }
  }

  try {
    return {
      transcript: transcriptText,
      adapter: adapterName,
      modelName: transcription.modelName ?? null,
      language: transcription.language ?? null,
      durationSec: audioDurationSec ?? null,
      scores: voice.scores,
      voice,
      deep,
      grammarAnalysis,
      conversation,
      conversationCoachNotes,
      coachSummary,
      taskReview,
      candidateExercises,
    };
  } finally {
    if (resolved) await resolved.cleanup();
  }
}

/**
 * Helper for finalize routes: produce the JSON blob that goes into `session_transcript.analysisJson`.
 * Centralising this keeps the persisted shape consistent across routes; existing readers that look
 * for `grammarFlags` / `pronunciationTips` keep working because those live at the top level.
 */
export function serializeAnalysisForPersistence(analysis: CanonicalAnalysis): string {
  const payload = {
    // Legacy keys (back-compat with code that still reads BaselineAnalysis directly).
    grammarFlags: analysis.deep.grammarFlags,
    pronunciationTips: analysis.deep.pronunciationTips,

    // Canonical voice-analysis bundle.
    voiceAnalysis: {
      transcript: analysis.transcript,
      durationSec: analysis.durationSec,
      adapter: analysis.adapter,
      modelName: analysis.modelName,
      language: analysis.language,
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
      bonusSignals: analysis.voice.bonusSignals,
    },
    coachSummary: {
      biggestIssue: analysis.coachSummary.biggestIssue,
      strength: analysis.coachSummary.strength,
      patterns: analysis.coachSummary.patterns,
      acousticPatterns: analysis.coachSummary.acousticPatterns,
      summary: analysis.coachSummary.summary,
      strengths: analysis.coachSummary.strengths,
      improvementAreas: analysis.coachSummary.improvementAreas,
      scoreExplanations: analysis.coachSummary.scoreExplanations,
      recommendedExerciseIds: analysis.coachSummary.recommendedExerciseIds,
      recommendationRationale: analysis.coachSummary.recommendationRationale,
      fallbackUsed: analysis.coachSummary.fallbackUsed,
      warning: analysis.coachSummary.warning,
    },
    taskReview: analysis.taskReview,
    candidateExercises: analysis.candidateExercises,
    conversation: analysis.conversation,
    conversationCoachNotes: analysis.conversationCoachNotes,
    grammarAnalysis: analysis.grammarAnalysis
      ? {
          errors: analysis.grammarAnalysis.errors,
          score: analysis.grammarAnalysis.score,
          summary: analysis.grammarAnalysis.summary,
          strengths: analysis.grammarAnalysis.strengths,
        }
      : {
          errors: [],
          score: null,
          summary: null,
          strengths: [],
        },
  };
  return JSON.stringify(payload);
}

export { TranscriptionUnavailableError };
