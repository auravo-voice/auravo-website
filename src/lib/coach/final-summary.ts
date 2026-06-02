import "server-only";

import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import { DIMENSION_LABELS } from "@/lib/assessment/dimensions-from-scores";
import type { VoiceAnalysis } from "@/lib/analysis/scoring";
import type { AcousticFeatures } from "@/lib/audio/acoustic";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";
import { analyzeTranscriptWithCoachingFallback } from "@/lib/coach/fallbacks";
import {
  isValidRecommendationSet,
  type RecommendedExercise,
} from "@/lib/practice/recommend";
import type { ExerciseContextForTaskReview, ExerciseTaskReviewResult } from "@/lib/coach/exercise-task-review-core";
import { generateExerciseTaskReview } from "@/lib/coach/task-review";

export type FinalCoachingSummary = {
  /** Primary insight from transcript LLM pass. */
  biggestIssue: string | null;
  strength: string | null;
  patterns: CoachingPattern[];
  acousticPatterns: AcousticCoachingPattern[];
  recommendedExerciseIds: string[];
  recommendationRationale: string;
  /** Back-compat narrative fields for older UI paths. */
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  scoreExplanations?: Record<string, string>;
  fallbackUsed: boolean;
  warning: string | null;
};

export type GenerateFinalSummaryInput = {
  transcript: string;
  analysis: VoiceAnalysis;
  acousticFeatures: AcousticFeatures | null;
  candidateExercises: RecommendedExercise[];
  learnerContext?: {
    displayName?: string;
    goalLabel?: string | null;
    streakDays?: number;
  };
  exerciseContext?: ExerciseContextForTaskReview | null;
  taskReview?: ExerciseTaskReviewResult | null;
};

function buildRecommendationRationale(candidates: RecommendedExercise[], weakest: string[]): string {
  if (candidates.length === 0) {
    return "Default starter session selected.";
  }
  const titles = candidates.slice(0, 3).map((c) => c.title);
  const focus = weakest.length > 0 ? weakest.join(", ") : "your weakest dimensions";
  return `These sessions target ${focus}: ${titles.join("; ")}.`;
}

function buildFallbackSummary(
  analysis: VoiceAnalysis,
  candidates: RecommendedExercise[],
): Pick<
  FinalCoachingSummary,
  | "biggestIssue"
  | "strength"
  | "patterns"
  | "acousticPatterns"
  | "summary"
  | "strengths"
  | "improvementAreas"
  | "recommendedExerciseIds"
  | "recommendationRationale"
  | "scoreExplanations"
> {
  const sortedDims = (Object.keys(analysis.scores) as DimensionKey[]).sort(
    (a, b) => analysis.scores[a] - analysis.scores[b],
  );
  const top = sortedDims.slice(-2);
  const bottom = sortedDims.slice(0, 2);
  const fallbackIds = candidates.slice(0, Math.min(3, candidates.length)).map((c) => c.id);
  const strengths = top.map(
    (k) => `${DIMENSION_LABELS[k]}: ${analysis.explanations[k] ?? "scored above average for this session."}`,
  );
  const improvementAreas = bottom.map(
    (k) => `${DIMENSION_LABELS[k]}: ${analysis.explanations[k] ?? "needs the most attention next."}`,
  );
  const biggestIssue =
    bottom.length > 0
      ? `Focus on ${DIMENSION_LABELS[bottom[0]!]}: ${analysis.explanations[bottom[0]!] ?? "your largest gap this session."}`
      : null;
  const strength =
    top.length > 0
      ? `${DIMENSION_LABELS[top[top.length - 1]!]} stood out: ${analysis.explanations[top[top.length - 1]!] ?? "solid delivery."}`
      : null;
  const summaryPieces: string[] = [];
  if (biggestIssue) summaryPieces.push(biggestIssue);
  if (strength) summaryPieces.push(strength);
  if (candidates.length > 0) summaryPieces.push(`We've queued ${fallbackIds.length} practice sessions to close the gap.`);

  return {
    biggestIssue,
    strength,
    patterns: [],
    acousticPatterns: [],
    summary: summaryPieces.join(" ") || "Recording captured. Keep practising.",
    strengths: strengths.length > 0 ? strengths : ["Recording captured."],
    improvementAreas: improvementAreas.length > 0 ? improvementAreas : ["Keep practising."],
    scoreExplanations: { ...analysis.explanations },
    recommendedExerciseIds: fallbackIds.length > 0 ? fallbackIds : ["filler-three-beat-status"],
    recommendationRationale: buildRecommendationRationale(
      candidates,
      bottom.map((k) => DIMENSION_LABELS[k]),
    ),
  };
}

/**
 * Two-pass coaching: deterministic scores (pass 1) + Groq transcript pattern analysis (pass 2).
 * Exercise picks remain deterministic from the candidate pool.
 */
export async function generateFinalCoachingSummary(
  input: GenerateFinalSummaryInput,
): Promise<FinalCoachingSummary> {
  const {
    transcript,
    analysis,
    acousticFeatures,
    candidateExercises,
    learnerContext,
    exerciseContext,
    taskReview,
  } = input;

  const userGoal = learnerContext?.goalLabel?.trim() || "professional English communication";
  const fallback = buildFallbackSummary(analysis, candidateExercises);
  const recommendedExerciseIds = fallback.recommendedExerciseIds;

  let taskReviewResult = taskReview ?? null;
  if (exerciseContext && !taskReviewResult) {
    try {
      taskReviewResult = await generateExerciseTaskReview({
        exercise: exerciseContext,
        transcript,
        voice: analysis,
      });
    } catch (e) {
      console.error("[final-summary] task review failed:", e);
    }
  }

  const transcriptInsights = await analyzeTranscriptWithCoachingFallback(
    transcript,
    userGoal,
    analysis.derivedMetrics,
    acousticFeatures,
  );

  const groqFailed =
    transcriptInsights.patterns.length === 0 &&
    !transcriptInsights.biggest_issue &&
    !transcriptInsights.strength;

  const patterns = transcriptInsights.patterns.slice(0, 6);
  const acousticPatterns = transcriptInsights.acoustic_patterns.slice(0, 4);
  const biggestIssue = transcriptInsights.biggest_issue ?? fallback.biggestIssue;
  const strength = transcriptInsights.strength ?? fallback.strength;

  const improvementAreas =
    patterns.length > 0
      ? patterns.map((p) => `${p.pattern}: ${p.fix}`)
      : fallback.improvementAreas;
  const strengths =
    strength != null && strength.length > 0 ? [strength, ...fallback.strengths.slice(0, 2)] : fallback.strengths;

  const summaryParts: string[] = [];
  if (biggestIssue) summaryParts.push(biggestIssue);
  if (strength) summaryParts.push(strength);
  if (patterns.length > 0) {
    summaryParts.push(
      `We spotted ${patterns.length} specific pattern${patterns.length === 1 ? "" : "s"} in how you structured your answer.`,
    );
  }
  summaryParts.push(fallback.recommendationRationale);

  const coachSummary: FinalCoachingSummary = {
    biggestIssue,
    strength,
    patterns,
    acousticPatterns,
    recommendedExerciseIds,
    recommendationRationale: fallback.recommendationRationale,
    summary: summaryParts.join(" ").trim() || fallback.summary,
    strengths: strengths.slice(0, 4),
    improvementAreas: improvementAreas.slice(0, 4),
    scoreExplanations: fallback.scoreExplanations,
    fallbackUsed: groqFailed,
    warning: groqFailed ? "Coach used score-based guidance because Groq returned no patterns." : null,
  };

  if (!isValidRecommendationSet(coachSummary.recommendedExerciseIds, candidateExercises)) {
    return {
      ...coachSummary,
      recommendedExerciseIds: fallback.recommendedExerciseIds,
      fallbackUsed: true,
      warning: "Exercise recommendations were adjusted to the available pool.",
    };
  }

  return coachSummary;
}
