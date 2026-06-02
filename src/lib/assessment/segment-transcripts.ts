import {
  ASSESSMENT_PROMPTS,
  ASSESSMENT_SEGMENT_KINDS,
  segmentDisplayLabel,
  type AssessmentSegmentKind,
} from "@/lib/assessment/segments";
import type { DraftSegmentRow } from "@/db/queries/baseline-segments";

export type SegmentTranscriptRow = {
  kind: AssessmentSegmentKind;
  label: string;
  title: string;
  transcript: string;
};

/** Ordered per-segment transcripts for assessment results (skips empty segments). */
export function buildSegmentTranscriptRows(rows: DraftSegmentRow[]): SegmentTranscriptRow[] {
  const byKind = new Map(rows.map((r) => [r.segmentKind, r]));
  return ASSESSMENT_SEGMENT_KINDS.flatMap((kind) => {
    const row = byKind.get(kind);
    const transcript = (row?.transcript ?? "").trim();
    if (!transcript) return [];
    return [
      {
        kind,
        label: segmentDisplayLabel(kind),
        title: ASSESSMENT_PROMPTS[kind].title,
        transcript,
      },
    ];
  });
}
