import type { TranscriptionResult } from "@/lib/transcription/types";
import type { SegmentTranscriptMeta } from "@/lib/assessment/segment-transcript-meta";

export type SegmentForMerge = {
  text: string;
  durationMs: number | null;
  meta: SegmentTranscriptMeta | null;
};

function offsetBefore(segments: SegmentForMerge[], index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i++) {
    const seg = segments[i]!;
    if (seg.durationMs != null && seg.durationMs > 0) {
      offset += seg.durationMs / 1000;
      continue;
    }
    const last = seg.meta?.wordTimings?.at(-1);
    if (last) offset += last.end;
    else if (seg.meta?.durationSec) offset += seg.meta.durationSec;
  }
  return offset;
}

/**
 * Merges per-segment Whisper output into one {@link TranscriptionResult} with timeline offsets so
 * finalize can skip re-transcribing the concatenated WAV without losing WPM / pause metrics.
 */
export function mergeSegmentTranscriptions(segments: SegmentForMerge[]): TranscriptionResult | null {
  const trimmed = segments.map((s) => s.text.trim());
  if (trimmed.some((t) => t.length < 1)) return null;

  const allHaveTimings = segments.every((s) => (s.meta?.wordTimings?.length ?? 0) > 0);
  if (!allHaveTimings) return null;

  const text = trimmed.join("\n\n");
  const wordTimings = segments.flatMap((seg, index) => {
    const offset = offsetBefore(segments, index);
    return (seg.meta!.wordTimings ?? []).map((w) => ({
      ...w,
      start: w.start + offset,
      end: w.end + offset,
    }));
  });

  const whisperSegments = segments.flatMap((seg, index) => {
    const offset = offsetBefore(segments, index);
    return (seg.meta!.segments ?? []).map((s) => ({
      ...s,
      start: s.start + offset,
      end: s.end + offset,
    }));
  });

  const asrWordHints = segments.flatMap((seg) => seg.meta?.asrWordHints ?? []);

  const totalDurationMs = segments.reduce((a, s) => a + (s.durationMs ?? 0), 0);
  const durationSec =
    totalDurationMs > 0
      ? totalDurationMs / 1000
      : (wordTimings.at(-1)?.end ?? segments.reduce((a, s) => a + (s.meta?.durationSec ?? 0), 0));

  const modelName = segments.find((s) => s.meta?.modelName)?.meta?.modelName;
  const language = segments.find((s) => s.meta?.language)?.meta?.language;

  return {
    text,
    wordTimings,
    segments: whisperSegments.length > 0 ? whisperSegments : undefined,
    asrWordHints: asrWordHints.length > 0 ? asrWordHints : undefined,
    durationSec: durationSec > 0 ? durationSec : undefined,
    modelName,
    language,
  };
}
