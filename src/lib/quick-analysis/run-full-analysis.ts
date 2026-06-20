import "server-only";

import { rm } from "node:fs/promises";

import { runAnalysis, type CanonicalAnalysis } from "@/lib/analysis/run-analysis";
import { mergeSegmentTranscriptions } from "@/lib/assessment/merge-segment-transcriptions";
import { getTranscriptionAdapter, TranscriptionUnavailableError } from "@/lib/transcription";
import { getPhoneticPronunciations } from "@/lib/quick-analysis/phonetic-analysis";
import { resolvePronunciationHighlightSource } from "@/app/quick-analysis/lib/word-highlight";
import { prepareAnalysisSegment } from "@/lib/quick-analysis/prepare-analysis-segment";
import {
  distributeWordConfidencesToSegments,
  ensureSegmentWordHighlights,
  flaggedWordsForPhonetics,
  wordConfidencesFromTimings,
} from "@/lib/quick-analysis/word-confidences";
import { displayWordConfidencesWithPolishedTranscript } from "@/app/quick-analysis/lib/polished-word-display";
import { buildTranscriptSegments } from "@/lib/quick-analysis/transcript-segments";
import { grammarSnapshotFromAnalysis } from "@/lib/quick-analysis/grammar-snapshot";
import type { QuickAnalysisGrammarSnapshot } from "@/lib/quick-analysis/grammar-snapshot";
import { polishTranscriptSegmentsForDisplay } from "@/lib/transcription/polish-transcript-display";
import type {
  QuickAnalysisTranscriptSegment,
  QuickAnalysisWordConfidence,
} from "@/app/quick-analysis/pronunciation-types";
import type { PronunciationHighlightSource } from "@/app/quick-analysis/lib/word-highlight";

/** Gap between Q3–Q5 clips when concatenating for acoustic/VAD (avoids false energy dips at joins). */
const CONCAT_GAP_MS = 450;

export type QuickAnalysisFullResult = {
  analysis: CanonicalAnalysis;
  durationMs: number | null;
  scores: CanonicalAnalysis["scores"];
  transcript: string;
  transcriptSegments: QuickAnalysisTranscriptSegment[];
  wordConfidences: QuickAnalysisWordConfidence[];
  phoneticMap: Record<string, string>;
  pronunciationHighlightSource: PronunciationHighlightSource;
  grammar: QuickAnalysisGrammarSnapshot;
  coachSummary: CanonicalAnalysis["coachSummary"];
};

/**
 * Full Quick Analysis — parallel per-segment Whisper when needed, then acoustic/VAD + Groq on
 * stitched text without a second concat Whisper pass.
 */
export async function runQuickAnalysisFull(
  blobs: Blob[],
  segmentTranscripts?: string[],
  segmentServerTranscripts?: string[],
  segmentServerMetaJson?: string[],
  segmentLabels?: string[],
  userId?: string,
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
    const serverMeta = segmentServerMetaJson ?? [];

    const prepared = await Promise.all(
      blobs.map((blob, i) =>
        prepareAnalysisSegment(blob, i, {
          browserTranscript: browserTexts[i],
          serverTranscript: serverTexts[i],
          serverMetaJson: serverMeta[i],
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

    const totalDurationMs =
      stitched?.durationSec != null
        ? Math.round(stitched.durationSec * 1000 + gapSec * 1000 * Math.max(0, tempPaths.length - 1))
        : null;

    const analysisStartedAt = Date.now();
    const analysis = await runAnalysis({
      audio: {
        mode: "concat",
        absolutePaths: tempPaths,
        totalDurationMs,
        gapMs: CONCAT_GAP_MS,
      },
      preTranscribed:
        canReuseTimings && stitched
          ? { ...stitched, adapter: adapter.name }
          : { text: stitchedText, adapter: "quick-analysis-stitch" },
      reusePreTranscription: true,
      context: {
        userId: userId ?? "00000000-0000-0000-0000-000000000099",
        runCoachSummary: true,
        learnerContextHint: { displayName: userId ? "Learner" : "Guest" },
      },
    });

    console.info("[quick-analysis/full] runAnalysis done", {
      ms: Date.now() - analysisStartedAt,
      totalMs: Date.now() - startedAt,
      reuseTimings: canReuseTimings,
    });

    const labels =
      segmentLabels?.length === segmentRows.length
        ? segmentLabels
        : segmentRows.map((_, i) => `Question ${i + 1}`);
    const wordConfidences = wordConfidencesFromTimings(analysis.voice.wordTimings ?? undefined);
    let transcriptSegments = buildTranscriptSegments(segmentRows, labels, wordConfidences);

    const globalWords =
      wordConfidences.length > 0
        ? wordConfidences
        : transcriptSegments.flatMap((s) => s.wordConfidences);
    if (
      globalWords.length > 0 &&
      transcriptSegments.some((s) => s.transcript.trim().length > 0 && s.wordConfidences.length === 0)
    ) {
      transcriptSegments = distributeWordConfidencesToSegments(
        transcriptSegments.map((s) => ({ ...s, wordConfidences: [] })),
        globalWords,
        { force: true },
      );
    }

    const polishedSegments = await polishTranscriptSegmentsForDisplay(transcriptSegments);
    transcriptSegments = transcriptSegments.map((segment, i) => {
      const polishedText = polishedSegments[i]?.transcript ?? segment.transcript;
      return {
        ...segment,
        transcript: polishedText,
        wordConfidences: displayWordConfidencesWithPolishedTranscript(
          segment.wordConfidences,
          polishedText,
        ),
      };
    });
    const sessionWordConfidences =
      wordConfidences.length > 0
        ? wordConfidences
        : transcriptSegments.flatMap((s) => s.wordConfidences);
    transcriptSegments = ensureSegmentWordHighlights(transcriptSegments, sessionWordConfidences);
    const flagged = flaggedWordsForPhonetics(sessionWordConfidences);

    const transcript = transcriptSegments
      .map((s) => s.transcript.trim())
      .filter(Boolean)
      .join("\n\n");

    // Brief pause so Groq TPM can recover after runAnalysis grammar/vocab/coach batch.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const phoneticMap = await getPhoneticPronunciations(flagged);
    const pronunciationHighlightSource = resolvePronunciationHighlightSource(
      phoneticMap,
      flagged.length,
    );
    const grammar = grammarSnapshotFromAnalysis(analysis);

    return {
      analysis,
      durationMs: totalDurationMs,
      scores: analysis.scores,
      transcript,
      transcriptSegments,
      wordConfidences: sessionWordConfidences,
      phoneticMap,
      pronunciationHighlightSource,
      grammar,
      coachSummary: analysis.coachSummary,
    };
  } finally {
    await Promise.all(tempPaths.map((p) => rm(p, { force: true }).catch(() => {})));
  }
}
