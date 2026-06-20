import type {
  QuickAnalysisTranscriptSegment,
  QuickAnalysisWordConfidence,
} from "@/app/quick-analysis/pronunciation-types";
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

function segmentWordCount(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * When per-segment Whisper meta is missing, fill each section from the full-session word list
 * (same order as concat analysis) so transcript tokens can be highlighted.
 */
export function distributeWordConfidencesToSegments(
  segments: QuickAnalysisTranscriptSegment[],
  allWords: QuickAnalysisWordConfidence[],
  options?: { force?: boolean },
): QuickAnalysisTranscriptSegment[] {
  if (!allWords.length) return segments;

  const needsFill =
    options?.force ||
    segments.some((s) => s.transcript.trim().length > 0 && s.wordConfidences.length === 0);
  if (!needsFill) return segments;

  let cursor = 0;
  return segments.map((seg) => {
    if (!options?.force && seg.wordConfidences.length > 0) {
      cursor += seg.wordConfidences.length;
      return seg;
    }
    const count = segmentWordCount(seg.transcript);
    if (count < 1) return { ...seg, wordConfidences: [] };
    const wordConfidences = allWords.slice(cursor, cursor + count);
    cursor += count;
    return { ...seg, wordConfidences };
  });
}

/** Fill missing per-segment word timings from the session word list (order matches concat analysis). */
export function ensureSegmentWordHighlights(
  segments: QuickAnalysisTranscriptSegment[],
  allWords: QuickAnalysisWordConfidence[],
): QuickAnalysisTranscriptSegment[] {
  if (segments.length === 0 || allWords.length === 0) return segments;
  const needsFill = segments.some(
    (s) => s.transcript.trim().length > 0 && s.wordConfidences.length === 0,
  );
  if (!needsFill) return segments;
  return distributeWordConfidencesToSegments(segments, allWords);
}
