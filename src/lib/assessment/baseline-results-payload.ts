import type { BaselineAnalysis } from "@/lib/assessment/baseline-analysis-types";
import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import type { SegmentTranscriptRow } from "@/lib/assessment/segment-transcripts";
import type { RadarDimension } from "@/lib/coach/schemas";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";

export type AssessmentCoachSummary = {
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  recommendationRationale?: string;
  biggestIssue?: string | null;
  strength?: string | null;
  patterns?: CoachingPattern[];
  acousticPatterns?: AcousticCoachingPattern[];
};

export type AssessmentBaselinePayload = {
  userId: string;
  sessionId: string;
  transcript: string;
  /** Per-segment transcripts when available (assessment results UI). */
  segmentTranscripts?: SegmentTranscriptRow[];
  dimensions: RadarDimension[];
  averageScore: number;
  goalLabel: string | null;
  analysis: BaselineAnalysis;
  voiceExplanations?: Partial<Record<DimensionKey, string>>;
  coachSummary?: AssessmentCoachSummary;
  recommendedExercises?: { id: string; title: string; subtitle: string }[];
  degraded?: boolean;
};
