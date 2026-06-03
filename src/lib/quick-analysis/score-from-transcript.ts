import "server-only";

import { scoresFromAnalysis } from "@/lib/analysis/scoring";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";

export type TranscriptScoringResult = {
  scores: SixDimensionScores;
  transcript: string;
  lowConfidenceWords: string[];
};

/** Instant per-question scoring from browser speech recognition (no Whisper). */
export function scoreQuickAnalysisFromTranscript(raw: string): TranscriptScoringResult {
  const transcript = raw.trim();
  if (transcript.length < 2) {
    throw new Error("We could not pick up enough speech. Please try again.");
  }
  const voice = scoresFromAnalysis({ transcript });
  return {
    scores: voice.scores,
    transcript,
    lowConfidenceWords: [],
  };
}
