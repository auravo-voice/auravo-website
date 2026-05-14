import "server-only";

import { scoresFromAnalysis } from "@/lib/analysis/scoring";

export type SixDimensionScores = {
  pronunciation: number;
  grammar: number;
  fluency: number;
  vocabulary: number;
  filler_words: number;
  pacing: number;
};

/**
 * Back-compat entry point: derives six-dimension scores from transcript text only. Internally this now
 * delegates to {@link scoresFromAnalysis}, which means non-migrated routes (assessment/simulation/
 * meeting-prep finalize) automatically pick up the richer transcript-only scoring. Routes that have
 * been migrated should call `scoresFromAnalysis` directly to receive the audio-grounded numbers.
 */
export function scoresFromTranscript(transcript: string): SixDimensionScores {
  return scoresFromAnalysis({ transcript }).scores;
}
