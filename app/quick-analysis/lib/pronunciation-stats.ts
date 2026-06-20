import type { QuickAnalysisTranscriptSegment } from "@/app/quick-analysis/pronunciation-types";
import {
  flaggedWordsFromHighlights,
  resolveWordHighlightColor,
  type FlaggedWord,
  type PronunciationHighlightSource,
} from "@/app/quick-analysis/lib/word-highlight";

export type { FlaggedWord };

export type PronunciationStats = {
  clearCount: number;
  partialCount: number;
  reviewCount: number;
  flagged: FlaggedWord[];
  allWords: QuickAnalysisTranscriptSegment["wordConfidences"];
  highlightSource: PronunciationHighlightSource;
};

export function computePronunciationStats(
  segments: QuickAnalysisTranscriptSegment[],
  phoneticMap: Record<string, string>,
  highlightSource: PronunciationHighlightSource,
): PronunciationStats {
  const visibleSegments = segments.filter(
    (s) => s.transcript.length > 0 || s.wordConfidences.length > 0,
  );
  const allWords = visibleSegments.flatMap((s) => s.wordConfidences);
  const flagged = flaggedWordsFromHighlights(allWords, phoneticMap, highlightSource);

  let clearCount = 0;
  let partialCount = 0;
  let reviewCount = 0;
  for (const w of allWords) {
    const color = resolveWordHighlightColor(w.word, w.confidence, phoneticMap, highlightSource);
    if (color === "green") clearCount += 1;
    else if (color === "yellow") partialCount += 1;
    else if (color === "red") reviewCount += 1;
  }

  return { clearCount, partialCount, reviewCount, flagged, allWords, highlightSource };
}
