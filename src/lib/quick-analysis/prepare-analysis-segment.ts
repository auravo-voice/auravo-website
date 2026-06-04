import "server-only";

import { rm } from "node:fs/promises";

import type { SegmentTranscriptMeta } from "@/lib/assessment/segment-transcript-meta";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";
import { getTranscriptionAdapter } from "@/lib/transcription";
import type { TranscriptionResult } from "@/lib/transcription/types";

/** Trust browser STT for a segment when it has at least this many words — skips Whisper for that clip. */
export const SEGMENT_BROWSER_TRANSCRIPT_MIN_WORDS = 3;

export type AnalysisSegmentRow = {
  text: string;
  durationMs: number | null;
  meta: SegmentTranscriptMeta | null;
};

export type PreparedAnalysisSegment = {
  absolutePath: string;
  row: AnalysisSegmentRow;
  whispered: boolean;
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function metaFromTranscription(transcription: TranscriptionResult): SegmentTranscriptMeta | null {
  if (!transcription.wordTimings?.length) return null;
  return {
    wordTimings: transcription.wordTimings,
    segments: transcription.segments,
    asrWordHints: transcription.asrWordHints,
    durationSec: transcription.durationSec,
    modelName: transcription.modelName,
    language: transcription.language,
  };
}

/**
 * Prepare one Q3–Q5 clip: prefer browser or prefetched server text; otherwise Whisper.
 * Caller must delete `absolutePath` when done (full analysis concat).
 */
export async function prepareAnalysisSegment(
  blob: Blob,
  index: number,
  options: { browserTranscript?: string; serverTranscript?: string },
): Promise<PreparedAnalysisSegment> {
  const browser = (options.browserTranscript ?? "").trim();
  const server = (options.serverTranscript ?? "").trim();

  if (wordCount(browser) >= SEGMENT_BROWSER_TRANSCRIPT_MIN_WORDS) {
    const { absolutePath } = await writeTempAudioFile(`qa-full-${Date.now()}-${index}`, blob);
    return {
      absolutePath,
      row: { text: browser, durationMs: null, meta: null },
      whispered: false,
    };
  }

  if (server.length > 0) {
    const { absolutePath } = await writeTempAudioFile(`qa-full-${Date.now()}-${index}`, blob);
    return {
      absolutePath,
      row: { text: server, durationMs: null, meta: null },
      whispered: false,
    };
  }

  const { absolutePath } = await writeTempAudioFile(`qa-full-${Date.now()}-${index}`, blob);
  try {
    const adapter = getTranscriptionAdapter();
    const transcription = await adapter.transcribe(absolutePath);
    const text = transcription.text.trim();
    return {
      absolutePath,
      row: {
        text,
        durationMs:
          transcription.durationSec != null && transcription.durationSec > 0
            ? Math.round(transcription.durationSec * 1000)
            : null,
        meta: metaFromTranscription(transcription),
      },
      whispered: true,
    };
  } catch (e) {
    await rm(absolutePath, { force: true }).catch(() => {});
    throw e;
  }
}

/** Single-segment Whisper for background prefetch while the user answers the next question. */
export async function transcribeQuickAnalysisSegment(
  audio: Blob,
  browserTranscript?: string,
): Promise<{ transcript: string; whispered: boolean }> {
  const browser = (browserTranscript ?? "").trim();
  if (wordCount(browser) >= SEGMENT_BROWSER_TRANSCRIPT_MIN_WORDS) {
    return { transcript: browser, whispered: false };
  }

  const id = `qa-seg-${Date.now()}`;
  const { absolutePath } = await writeTempAudioFile(id, audio);
  try {
    const adapter = getTranscriptionAdapter();
    const transcription = await adapter.transcribe(absolutePath);
    return { transcript: transcription.text.trim(), whispered: true };
  } finally {
    await rm(absolutePath, { force: true }).catch(() => {});
  }
}
