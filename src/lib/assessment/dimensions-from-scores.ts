import type { RadarDimension } from "@/lib/coach/schemas";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";

const KEY_ORDER = ["pronunciation", "grammar", "fluency", "vocabulary", "filler_words", "pacing"] as const;

export type DimensionKey = (typeof KEY_ORDER)[number];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  // "Speech clarity" is more accurate than "Pronunciation" for what we actually measure: the score is
  // derived from speech clarity (HNR + shimmer), articulation quality (Whisper word confidence), and
  // overall delivery clarity. We are not doing phoneme-level pronunciation evaluation.
  pronunciation: "Speech clarity",
  grammar: "Grammar",
  fluency: "Fluency",
  vocabulary: "Vocabulary",
  filler_words: "Filler control",
  pacing: "Pacing",
};

/**
 * One-line disclaimer surfaced under "Speech clarity" cards so learners know this is a local proxy
 * for articulation/delivery quality, not a phoneme-level pronunciation grade.
 */
export const SPEECH_CLARITY_DISCLAIMER =
  "Estimated locally from articulation clarity, transcript confidence, and delivery patterns. Not a phoneme-level pronunciation grade.";

export const DIMENSION_KEYS: readonly DimensionKey[] = KEY_ORDER;

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoresToRadarDimensions(scores: SixDimensionScores): RadarDimension[] {
  return KEY_ORDER.map((k) => ({
    key: k,
    label: DIMENSION_LABELS[k],
    score: clampScore(scores[k]),
  }));
}
