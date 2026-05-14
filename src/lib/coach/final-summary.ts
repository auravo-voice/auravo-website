import "server-only";

import { z } from "zod";
import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import { DIMENSION_LABELS } from "@/lib/assessment/dimensions-from-scores";
import type { VoiceAnalysis } from "@/lib/analysis/scoring";
import { ollamaChatStructured } from "@/lib/ollama/chat-json";
import { getCoachOllamaTimeoutMs } from "@/lib/ollama/env";
import {
  isValidRecommendationSet,
  type RecommendedExercise,
} from "@/lib/practice/recommend";
import type { ExerciseContextForTaskReview, ExerciseTaskReviewResult } from "@/lib/coach/exercise-task-review-core";

const finalSummarySchema = z.object({
  summary: z.string().min(20).max(700),
  strengths: z.array(z.string().min(3).max(140)).min(1).max(4),
  improvementAreas: z.array(z.string().min(3).max(140)).min(1).max(4),
  scoreExplanations: z.record(z.string(), z.string().min(8).max(280)).optional(),
  recommendedExerciseIds: z.array(z.string().min(1).max(80)).min(1).max(4),
  recommendationRationale: z.string().min(10).max(420),
});

export type FinalCoachingSummary = z.infer<typeof finalSummarySchema> & {
  /** True when validation rejected the LLM output and the deterministic fallback was used. */
  fallbackUsed: boolean;
  /** Human-readable warning to surface in the UI if generation degraded. */
  warning: string | null;
};

const SYSTEM_BASE = `You are Auravo's senior speaking coach summarising one recording.

Output a single JSON object (no markdown, no commentary). Fields and rules:
  summary: 2–4 sentences. Lead with how they performed on the specific exercise (when exerciseTaskReview is provided — paraphrase it, do not contradict it), then bridge to delivery (pace, fillers, pauses, clarity) using the supplied metrics only as qualitative evidence. If no exerciseTaskReview, summarise delivery and dimension explanations only.
  strengths: 1–3 specific wins. Prefer a mix of task execution and delivery when exerciseTaskReview exists; otherwise delivery-only. Reference measured evidence (e.g. "steady 148 WPM") when citing delivery — never invent numbers.
  improvementAreas: 1–3 specific gaps. When exerciseTaskReview exists, include at least one task- or prompt-related gap when the review flags one; otherwise stay with delivery gaps. No platitudes.
  scoreExplanations: { dimensionKey: short sentence } — restate the explanation in coach voice. Optional.
  recommendedExerciseIds: 2–3 ids COPIED EXACTLY from the provided "candidateExercises" pool. NEVER invent ids.
  recommendationRationale: one short paragraph explaining why those exercises target this learner's gaps.

Hard rules:
- Never produce a recommendedExerciseId that is not in the candidate pool.
- Never invent new exercise names. Refer to them by their title only.
- Never invent or recompute dimension scores, WPM, pause counts, or filler counts — those are precomputed.
- Never invent a taskFitScore; if you mention task fit, only paraphrase the provided exerciseTaskReview.taskFitScore.
- If pronunciation is "approximate", say so plainly.
`;

function buildFallback(
  analysis: VoiceAnalysis,
  candidates: RecommendedExercise[],
): z.infer<typeof finalSummarySchema> {
  const sortedDims = (Object.keys(analysis.scores) as DimensionKey[]).sort(
    (a, b) => analysis.scores[b] - analysis.scores[a],
  );
  const top = sortedDims.slice(0, 2);
  const bottom = sortedDims.slice(-2);
  const fallbackIds = candidates.slice(0, Math.min(3, candidates.length)).map((c) => c.id);
  const strengths = top.map(
    (k) => `${DIMENSION_LABELS[k]}: ${analysis.explanations[k] ?? "scored above average for this session."}`,
  );
  const improvementAreas = bottom.map(
    (k) => `${DIMENSION_LABELS[k]}: ${analysis.explanations[k] ?? "needs the most attention next."}`,
  );
  const summaryPieces: string[] = [];
  if (top.length > 0) summaryPieces.push(`Your strongest signal was ${DIMENSION_LABELS[top[0]!]}.`);
  if (bottom.length > 0)
    summaryPieces.push(`The largest gap right now is ${DIMENSION_LABELS[bottom[0]!]}.`);
  if (candidates.length > 0) summaryPieces.push(`We've queued ${candidates.length} sessions to close it.`);

  return {
    summary: summaryPieces.join(" ") || "Recording captured. Keep practising.",
    strengths: strengths.length > 0 ? strengths : ["Recording captured."],
    improvementAreas: improvementAreas.length > 0 ? improvementAreas : ["Keep practising."],
    scoreExplanations: { ...analysis.explanations },
    recommendedExerciseIds: fallbackIds.length > 0 ? fallbackIds : ["filler-three-beat-status"],
    recommendationRationale:
      candidates.length > 0
        ? `These ${fallbackIds.length} sessions come straight from your current week and target the dimensions where you scored lowest in this recording.`
        : "Default starter session selected.",
  };
}

export type GenerateFinalSummaryInput = {
  analysis: VoiceAnalysis;
  /** The 2–3 deterministically-picked candidate exercises. The LLM may only refer to ids in this set. */
  candidateExercises: RecommendedExercise[];
  /** Learner-friendly context: goal label, days into the program, etc. Optional — keeps the prompt grounded. */
  learnerContext?: {
    displayName?: string;
    goalLabel?: string | null;
    streakDays?: number;
  };
  /** When set (e.g. daily practice), the coach summary should integrate structured task review. */
  exerciseContext?: ExerciseContextForTaskReview | null;
  taskReview?: ExerciseTaskReviewResult | null;
};

/**
 * Generates the structured coaching summary. The LLM only sees:
 *   - measured scores + per-score evidence,
 *   - key metrics (WPM, fillers, long pauses),
 *   - the pre-picked candidate exercise pool,
 *   - the learner's display name and goal.
 *
 * It never sees the raw acoustic feature dump and it can never produce an unknown exercise id — invalid
 * responses fall back to the deterministic summary so the UI always renders real clickable cards.
 */
export async function generateFinalCoachingSummary(
  input: GenerateFinalSummaryInput,
): Promise<FinalCoachingSummary> {
  const { analysis, candidateExercises, learnerContext, exerciseContext, taskReview } = input;
  const allowedIds = candidateExercises.map((c) => c.id);

  const sortedDims = (Object.keys(analysis.scores) as DimensionKey[]).sort(
    (a, b) => analysis.scores[a] - analysis.scores[b],
  );
  const weakest = sortedDims.slice(0, 3).map((k) => DIMENSION_LABELS[k]);
  const strongest = sortedDims.slice(-2).map((k) => DIMENSION_LABELS[k]);

  const userPayload = {
    learner: {
      displayName: learnerContext?.displayName ?? "Learner",
      goalLabel: learnerContext?.goalLabel ?? null,
      streakDays: learnerContext?.streakDays ?? 0,
    },
    exercise: exerciseContext ?? null,
    exerciseTaskReview: taskReview ?? null,
    scores: analysis.scores,
    scoreExplanations: analysis.explanations,
    keyMetrics: {
      wpm: analysis.derivedMetrics.wpm == null ? null : Math.round(analysis.derivedMetrics.wpm),
      fillerCount: analysis.fillerStats.count,
      fillerPerMinute: analysis.fillerStats.ratePerMin,
      longPauseCount: analysis.pauseStats.longCount,
      pauseCount: analysis.pauseStats.count,
      meanWordConfidence:
        analysis.asrConfidence.mean == null ? null : Number(analysis.asrConfidence.mean.toFixed(2)),
      acousticAvailable: analysis.acousticFeatures != null,
    },
    weakestDimensions: weakest,
    strongestDimensions: strongest,
    candidateExercises: candidateExercises.map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      category: c.category,
      focus: c.focus,
      coachingGoal: c.coachingGoal,
      promptPreview: c.promptPreview,
    })),
    rules: [
      `recommendedExerciseIds must be a subset of: ${allowedIds.join(", ")}`,
      "Never invent new exercise names or ids.",
    ],
  };

  const fallback = buildFallback(analysis, candidateExercises);

  try {
    const data = await ollamaChatStructured({
      messages: [
        { role: "system", content: SYSTEM_BASE },
        {
          role: "user",
          content: `Recording analysis (JSON). Respond with the JSON schema.\n${JSON.stringify(userPayload)}`,
        },
      ],
      schema: finalSummarySchema,
      numPredict: 700,
      timeoutMs: getCoachOllamaTimeoutMs(),
    });

    if (!isValidRecommendationSet(data.recommendedExerciseIds, candidateExercises)) {
      console.error(
        "[final-summary] LLM returned ids outside the candidate pool, falling back",
        data.recommendedExerciseIds,
      );
      return {
        ...fallback,
        fallbackUsed: true,
        warning: "Coach output referenced an unknown exercise; using a deterministic plan instead.",
      };
    }

    return {
      ...data,
      fallbackUsed: false,
      warning: null,
    };
  } catch (e) {
    console.error("[final-summary] generation failed; using deterministic fallback:", e);
    return {
      ...fallback,
      fallbackUsed: true,
      warning: "Coach narrative used a deterministic fallback — open Ollama locally to enable richer copy.",
    };
  }
}
