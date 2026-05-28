import type { BaselineAnalysis } from "@/lib/assessment/baseline-analysis-types";
import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import type { RadarDimension } from "@/lib/coach/schemas";

export type AssessmentBaselinePayload = {
  userId: string;
  sessionId: string;
  transcript: string;
  dimensions: RadarDimension[];
  averageScore: number;
  goalLabel: string | null;
  analysis: BaselineAnalysis;
  voiceExplanations?: Partial<Record<DimensionKey, string>>;
  coachSummary?: {
    summary: string;
    strengths: string[];
    improvementAreas: string[];
    recommendationRationale?: string;
  };
  recommendedExercises?: { id: string; title: string; subtitle: string }[];
  degraded?: boolean;
};
