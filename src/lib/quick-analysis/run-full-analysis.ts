import "server-only";

import { rm } from "node:fs/promises";

import { runAnalysis } from "@/lib/analysis/run-analysis";
import { mergeSegmentTranscriptions } from "@/lib/assessment/merge-segment-transcriptions";
import type { SegmentTranscriptMeta } from "@/lib/assessment/segment-transcript-meta";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";
import { getTranscriptionAdapter, TranscriptionUnavailableError } from "@/lib/transcription";

const QUICK_ANALYSIS_USER_ID = "00000000-0000-0000-0000-000000000099";

/** Gap between Q3–Q5 clips when concatenating for acoustic/VAD (avoids false energy dips at joins). */
const CONCAT_GAP_MS = 450;

export type QuickAnalysisFullResult = {
  scores: Awaited<ReturnType<typeof runAnalysis>>["scores"];
  transcript: string;
  coachSummary: Awaited<ReturnType<typeof runAnalysis>>["coachSummary"];
};

/**
 * Full Quick Analysis — same pipeline as assessment finalize: per-segment Whisper with word timings,
 * stitch transcripts, concat audio with brief silence, then {@link runAnalysis} (acoustic + VAD + Groq coach).
 */
export async function runQuickAnalysisFull(
  blobs: Blob[],
  transcriptPrefix: string,
): Promise<QuickAnalysisFullResult> {
  if (blobs.length < 1) {
    throw new Error("At least one audio clip is required.");
  }

  const tempPaths: string[] = [];
  try {
    const adapter = getTranscriptionAdapter();
    const segmentRows: { text: string; durationMs: number | null; meta: SegmentTranscriptMeta | null }[] = [];

    for (let i = 0; i < blobs.length; i++) {
      const { absolutePath } = await writeTempAudioFile(`qa-full-${Date.now()}-${i}`, blobs[i]!);
      tempPaths.push(absolutePath);
      const transcription = await adapter.transcribe(absolutePath);
      const text = transcription.text.trim();
      const meta: SegmentTranscriptMeta | null =
        transcription.wordTimings && transcription.wordTimings.length > 0
          ? {
              wordTimings: transcription.wordTimings,
              segments: transcription.segments,
              asrWordHints: transcription.asrWordHints,
              durationSec: transcription.durationSec,
              modelName: transcription.modelName,
              language: transcription.language,
            }
          : null;
      segmentRows.push({
        text,
        durationMs:
          transcription.durationSec != null && transcription.durationSec > 0
            ? Math.round(transcription.durationSec * 1000)
            : null,
        meta,
      });
    }

    const gapSec = CONCAT_GAP_MS / 1000;
    const stitched = mergeSegmentTranscriptions(segmentRows, { gapSecBetweenSegments: gapSec });
    const hasStitchedText = segmentRows.some((s) => s.text.length > 0);
    if (!hasStitchedText) {
      throw new TranscriptionUnavailableError(
        "We could not transcribe your answers. Try re-recording in a quiet room.",
      );
    }

    const canReuseTimings = stitched != null && (stitched.wordTimings?.length ?? 0) > 0;

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
        : {}),
      context: {
        userId: QUICK_ANALYSIS_USER_ID,
        runCoachSummary: true,
        learnerContextHint: { displayName: "Guest" },
      },
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
