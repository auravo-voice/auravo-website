import "server-only";

import { rm } from "node:fs/promises";

import { runAnalysis } from "@/lib/analysis/run-analysis";
import { mergeSegmentTranscriptions } from "@/lib/assessment/merge-segment-transcriptions";
import type { SegmentTranscriptMeta } from "@/lib/assessment/segment-transcript-meta";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";
import { getTranscriptionAdapter, TranscriptionUnavailableError } from "@/lib/transcription";
import type { TranscriptionResult } from "@/lib/transcription/types";

const QUICK_ANALYSIS_USER_ID = "00000000-0000-0000-0000-000000000099";

/** Gap between Q3–Q5 clips when concatenating for acoustic/VAD (avoids false energy dips at joins). */
const CONCAT_GAP_MS = 450;

/** Trust browser STT for a segment when it has at least this many words — skips a Whisper pass for that clip. */
const SEGMENT_BROWSER_TRANSCRIPT_MIN_WORDS = 5;

export type QuickAnalysisFullResult = {
  scores: Awaited<ReturnType<typeof runAnalysis>>["scores"];
  transcript: string;
  coachSummary: Awaited<ReturnType<typeof runAnalysis>>["coachSummary"];
};

type SegmentRow = {
  text: string;
  durationMs: number | null;
  meta: SegmentTranscriptMeta | null;
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

async function persistClip(
  blob: Blob,
  index: number,
): Promise<{ absolutePath: string; durationMs: number | null }> {
  const { absolutePath } = await writeTempAudioFile(`qa-full-${Date.now()}-${index}`, blob);
  return { absolutePath, durationMs: null };
}

async function transcribeClip(
  blob: Blob,
  index: number,
): Promise<{ absolutePath: string; row: SegmentRow }> {
  const { absolutePath } = await writeTempAudioFile(`qa-full-${Date.now()}-${index}`, blob);
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
  };
}

/**
 * Full Quick Analysis — per-segment Whisper (parallel) when needed, stitch when timings exist,
 * otherwise one concat Whisper. Assessment finalizes faster because it transcribes on upload;
 * this path optimizes the demo flow the same way.
 */
export async function runQuickAnalysisFull(
  blobs: Blob[],
  transcriptPrefix: string,
  segmentTranscripts?: string[],
): Promise<QuickAnalysisFullResult> {
  if (blobs.length < 1) {
    throw new Error("At least one audio clip is required.");
  }

  const tempPaths: string[] = [];
  const startedAt = Date.now();
  try {
    const adapter = getTranscriptionAdapter();
    const browserTexts = segmentTranscripts ?? [];

    const prepared = await Promise.all(
      blobs.map(async (blob, i) => {
        const browser = (browserTexts[i] ?? "").trim();
        if (wordCount(browser) >= SEGMENT_BROWSER_TRANSCRIPT_MIN_WORDS) {
          const { absolutePath, durationMs } = await persistClip(blob, i);
          return {
            absolutePath,
            row: { text: browser, durationMs, meta: null as SegmentTranscriptMeta | null },
            whispered: false,
          };
        }
        const { absolutePath, row } = await transcribeClip(blob, i);
        return { absolutePath, row, whispered: true };
      }),
    );

    tempPaths.push(...prepared.map((p) => p.absolutePath));
    const segmentRows = prepared.map((p) => p.row);
    const whisperCount = prepared.filter((p) => p.whispered).length;
    console.info("[quick-analysis/full] segments prepared", {
      ms: Date.now() - startedAt,
      clips: blobs.length,
      whisperPasses: whisperCount,
      browserOnly: blobs.length - whisperCount,
    });

    const gapSec = CONCAT_GAP_MS / 1000;
    const stitched = mergeSegmentTranscriptions(segmentRows, { gapSecBetweenSegments: gapSec });
    const hasStitchedText = segmentRows.some((s) => s.text.length > 0);
    if (!hasStitchedText) {
      throw new TranscriptionUnavailableError(
        "We could not transcribe your answers. Try re-recording in a quiet room.",
      );
    }

    const canReuseTimings = stitched != null && (stitched.wordTimings?.length ?? 0) > 0;
    const stitchedText = segmentRows.map((s) => s.text.trim()).filter(Boolean).join("\n\n");

    const analysisStartedAt = Date.now();
    const analysis = await runAnalysis({
      audio: {
        mode: "concat",
        absolutePaths: tempPaths,
        totalDurationMs:
          stitched?.durationSec != null
            ? Math.round(stitched.durationSec * 1000 + gapSec * 1000 * Math.max(0, tempPaths.length - 1))
            : null,
        gapMs: CONCAT_GAP_MS,
      },
      ...(canReuseTimings && stitched
        ? {
            preTranscribed: { ...stitched, adapter: adapter.name },
            reusePreTranscription: true,
          }
        : {
            preTranscribed: { text: stitchedText },
            reusePreTranscription: false,
          }),
      context: {
        userId: QUICK_ANALYSIS_USER_ID,
        runCoachSummary: true,
        learnerContextHint: { displayName: "Guest" },
      },
    });

    console.info("[quick-analysis/full] runAnalysis done", {
      ms: Date.now() - analysisStartedAt,
      totalMs: Date.now() - startedAt,
      reuseTimings: canReuseTimings,
    });

    const transcript = transcriptPrefix
      ? `${transcriptPrefix.trim()}\n\n${analysis.transcript}`.trim()
      : analysis.transcript;

    return {
      scores: analysis.scores,
      transcript,
      coachSummary: analysis.coachSummary,
    };
  } finally {
    await Promise.all(tempPaths.map((p) => rm(p, { force: true }).catch(() => {})));
  }
}
