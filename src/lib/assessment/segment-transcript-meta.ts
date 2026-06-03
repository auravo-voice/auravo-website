import type { AsrWordHint } from "@/lib/assessment/baseline-analysis-types";
import type { SegmentTiming, TranscriptionResult, WordTiming } from "@/lib/transcription/types";

/** JSON persisted on `baseline_segment.transcript_meta_json` after per-segment Whisper. */
export type SegmentTranscriptMeta = {
  wordTimings?: WordTiming[];
  segments?: SegmentTiming[];
  asrWordHints?: AsrWordHint[];
  durationSec?: number;
  modelName?: string;
  language?: string;
};

export function serializeSegmentTranscriptMeta(result: TranscriptionResult): string | null {
  if (!result.wordTimings?.length) return null;
  const payload: SegmentTranscriptMeta = {
    wordTimings: result.wordTimings,
    segments: result.segments,
    asrWordHints: result.asrWordHints,
    durationSec: result.durationSec,
    modelName: result.modelName,
    language: result.language,
  };
  return JSON.stringify(payload);
}

export function parseSegmentTranscriptMeta(raw: string | null | undefined): SegmentTranscriptMeta | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as SegmentTranscriptMeta;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.wordTimings) || parsed.wordTimings.length < 1) return null;
    return parsed;
  } catch {
    return null;
  }
}
