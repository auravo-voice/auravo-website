import type { QuickAnalysisWordConfidence } from "@/app/quick-analysis/pronunciation-types";
import { PRONUNCIATION_YELLOW_THRESHOLD } from "@/app/quick-analysis/pronunciation-types";
import type { WordTiming } from "@/lib/transcription/types";

export type { QuickAnalysisWordConfidence };
export { PRONUNCIATION_RED_THRESHOLD, PRONUNCIATION_YELLOW_THRESHOLD } from "@/app/quick-analysis/pronunciation-types";

export function wordConfidencesFromTimings(
  wordTimings: WordTiming[] | null | undefined,
): QuickAnalysisWordConfidence[] {
  if (!wordTimings?.length) return [];
  return wordTimings.map((w) => ({
    // Keep Whisper spacing (leading space on tokens) so UI reads naturally.
    word: w.word,
    confidence: w.probability ?? 1,
    start: w.start,
    end: w.end,
  }));
}

/** Words worth a Groq phonetic hint (low confidence, length > 3). */
export function flaggedWordsForPhonetics(
  wordConfidences: QuickAnalysisWordConfidence[],
): string[] {
  return [
    ...new Set(
      wordConfidences
        .filter(
          (w) =>
            w.confidence < PRONUNCIATION_YELLOW_THRESHOLD &&
            w.word.replace(/[^a-zA-Z]/g, "").length > 3,
        )
        .map((w) => w.word.replace(/[^a-zA-Z]/g, ""))
        .filter(Boolean),
    ),
  ];
}
