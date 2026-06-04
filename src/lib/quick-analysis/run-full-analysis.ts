import "server-only";

import { rm } from "node:fs/promises";

import { runAnalysis } from "@/lib/analysis/run-analysis";
import { mergeSegmentTranscriptions } from "@/lib/assessment/merge-segment-transcriptions";
import { getTranscriptionAdapter, TranscriptionUnavailableError } from "@/lib/transcription";
import { prepareAnalysisSegment } from "@/lib/quick-analysis/prepare-analysis-segment";

const QUICK_ANALYSIS_USER_ID = "00000000-0000-0000-0000-000000000099";

/** Gap between Q3–Q5 clips when concatenating for acoustic/VAD (avoids false energy dips at joins). */
const CONCAT_GAP_MS = 450;

export type QuickAnalysisFullResult = {
  scores: Awaited<ReturnType<typeof runAnalysis>>["scores"];
  transcript: string;
  coachSummary: Awaited<ReturnType<typeof runAnalysis>>["coachSummary"];
};

/**
 * Full Quick Analysis — parallel per-segment Whisper when needed, then acoustic/VAD + Groq on
 * stitched text without a second concat Whisper pass.
 */
export async function runQuickAnalysisFull(
  blobs: Blob[],
  transcriptPrefix: string,
  segmentTranscripts?: string[],
  segmentServerTranscripts?: string[],
): Promise<QuickAnalysisFullResult> {
  if (blobs.length < 1) {
    throw new Error("At least one audio clip is required.");
  }

  const tempPaths: string[] = [];
  const startedAt = Date.now();
  try {
    const adapter = getTranscriptionAdapter();
    const browserTexts = segmentTranscripts ?? [];
    const serverTexts = segmentServerTranscripts ?? [];

    const prepared = await Promise.all(
      blobs.map((blob, i) =>
        prepareAnalysisSegment(blob, i, {
          browserTranscript: browserTexts[i],
          serverTranscript: serverTexts[i],
        }),
      ),
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
      preTranscribed:
        canReuseTimings && stitched
          ? { ...stitched, adapter: adapter.name }
          : { text: stitchedText, adapter: "quick-analysis-stitch" },
      reusePreTranscription: true,
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
