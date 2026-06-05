import "server-only";

import { rm } from "node:fs/promises";

import {
  parseSegmentTranscriptMeta,
  serializeSegmentTranscriptMeta,
  type SegmentTranscriptMeta,
} from "@/lib/assessment/segment-transcript-meta";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";
import { getTranscriptionAdapter } from "@/lib/transcription";
import type { QuickAnalysisWordConfidence } from "@/app/quick-analysis/pronunciation-types";
import { wordConfidencesFromTimings } from "@/lib/quick-analysis/word-confidences";
import type { TranscriptionResult } from "@/lib/transcription/types";

/**
 * Browser STT (Web Speech API) is used only when Whisper is unavailable — it has no punctuation.
 * Prefetched/server Whisper text is always preferred for the stitched transcript.
 */
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
 * Prepare one Q3–Q5 clip: prefetched Whisper first, else live Whisper, else browser STT fallback.
 * Caller must delete `absolutePath` when done (full analysis concat).
 */
export async function prepareAnalysisSegment(
  blob: Blob,
  index: number,
  options: { browserTranscript?: string; serverTranscript?: string; serverMetaJson?: string },
): Promise<PreparedAnalysisSegment> {
  const browser = (options.browserTranscript ?? "").trim();
  const server = (options.serverTranscript ?? "").trim();
  const { absolutePath } = await writeTempAudioFile(`qa-full-${Date.now()}-${index}`, blob);

  if (server.length > 0) {
    const meta = parseSegmentTranscriptMeta(options.serverMetaJson);
    return {
      absolutePath,
      row: {
        text: server,
        durationMs:
          meta?.durationSec != null && meta.durationSec > 0
            ? Math.round(meta.durationSec * 1000)
            : null,
        meta,
      },
      whispered: false,
    };
  }

  try {
    const adapter = getTranscriptionAdapter();
    const transcription = await adapter.transcribe(absolutePath);
    const text = transcription.text.trim();
    if (text.length > 0) {
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
    }
  } catch (e) {
    if (wordCount(browser) < SEGMENT_BROWSER_TRANSCRIPT_MIN_WORDS) {
      await rm(absolutePath, { force: true }).catch(() => {});
      throw e;
    }
    console.warn("[prepare-analysis-segment] Whisper failed, using browser STT fallback:", e);
  }

  if (wordCount(browser) >= SEGMENT_BROWSER_TRANSCRIPT_MIN_WORDS) {
    return {
      absolutePath,
      row: { text: browser, durationMs: null, meta: null },
      whispered: false,
    };
  }

  await rm(absolutePath, { force: true }).catch(() => {});
  throw new Error("Could not transcribe this answer.");
}

export type QuickAnalysisSegmentResult = {
  transcript: string;
  whispered: boolean;
  wordConfidences: QuickAnalysisWordConfidence[];
  /** Serialized {@link SegmentTranscriptMeta} for full-analysis stitch (word timings reuse). */
  transcriptMetaJson: string | null;
};

/** Background Whisper for the next question — always transcribe for punctuation (browser STT has none). */
export async function transcribeQuickAnalysisSegment(
  audio: Blob,
  _browserTranscript?: string,
): Promise<QuickAnalysisSegmentResult> {
  const id = `qa-seg-${Date.now()}`;
  const { absolutePath } = await writeTempAudioFile(id, audio);
  try {
    const adapter = getTranscriptionAdapter();
    const transcription = await adapter.transcribe(absolutePath);
    return {
      transcript: transcription.text.trim(),
      whispered: true,
      wordConfidences: wordConfidencesFromTimings(transcription.wordTimings),
      transcriptMetaJson: serializeSegmentTranscriptMeta(transcription),
    };
  } finally {
    await rm(absolutePath, { force: true }).catch(() => {});
  }
}
