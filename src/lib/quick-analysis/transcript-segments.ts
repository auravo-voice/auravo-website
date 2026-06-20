import "server-only";

import type { QuickAnalysisTranscriptSegment, QuickAnalysisWordConfidence } from "@/app/quick-analysis/pronunciation-types";
import type { AnalysisSegmentRow } from "@/lib/quick-analysis/prepare-analysis-segment";
import { distributeWordConfidencesToSegments, wordConfidencesFromTimings } from "@/lib/quick-analysis/word-confidences";

/** Build per-question transcript sections from prepared segment rows. */
export function buildTranscriptSegments(
  segmentRows: AnalysisSegmentRow[],
  segmentLabels: string[],
  allWordConfidences?: QuickAnalysisWordConfidence[],
): QuickAnalysisTranscriptSegment[] {
  const segments = segmentRows
    .map((row, i) => {
      const transcript = row.text.trim();
      if (!transcript) return null;
      return {
        label: segmentLabels[i]?.trim() || `Question ${i + 1}`,
        transcript,
        wordConfidences: wordConfidencesFromTimings(row.meta?.wordTimings),
      };
    })
    .filter((s): s is QuickAnalysisTranscriptSegment => s != null);

  return allWordConfidences?.length
    ? distributeWordConfidencesToSegments(segments, allWordConfidences)
    : segments;
}
