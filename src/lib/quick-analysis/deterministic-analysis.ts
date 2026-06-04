import "server-only";

import { rm } from "node:fs/promises";

import { scoresFromAnalysis } from "@/lib/analysis/scoring";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { withQuickAnalysisWhisperModel } from "@/lib/quick-analysis/whisper-model";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";
import { getTranscriptionAdapter } from "@/lib/transcription";
import type { WordTiming } from "@/lib/transcription/types";

const LOW_CONFIDENCE_THRESHOLD = 0.55;

export type DeterministicAnalysisResult = {
  scores: SixDimensionScores;
  transcript: string;
  lowConfidenceWords: string[];
};

function lowConfidenceTokens(wordTimings: WordTiming[] | undefined): string[] {
  if (!wordTimings?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of wordTimings) {
    if (w.probability >= LOW_CONFIDENCE_THRESHOLD) continue;
    const token = w.word.trim();
    if (!token || seen.has(token.toLowerCase())) continue;
    seen.add(token.toLowerCase());
    out.push(token);
  }
  return out.slice(0, 12);
}

const MIN_AUDIO_BYTES = 800;

/** Whisper + derived metrics + scores only (no Groq, no acoustic/VAD). */
export async function runDeterministicQuickAnalysis(audio: Blob): Promise<DeterministicAnalysisResult> {
  if (audio.size < MIN_AUDIO_BYTES) {
    throw new Error("Recording was too short or empty. Hold the mic a little longer and try again.");
  }

  const id = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const { absolutePath } = await writeTempAudioFile(id, audio);

  try {
    return await withQuickAnalysisWhisperModel(async () => {
      const adapter = getTranscriptionAdapter();
      const transcription = await adapter.transcribe(absolutePath);
      const transcript = transcription.text.trim();
      const voice = scoresFromAnalysis({
        transcript,
        wordTimings: transcription.wordTimings,
        segments: transcription.segments,
        durationSec: transcription.durationSec ?? null,
      });
      return {
        scores: voice.scores,
        transcript,
        lowConfidenceWords: lowConfidenceTokens(transcription.wordTimings),
      };
    });
  } finally {
    await rm(absolutePath, { force: true }).catch(() => {});
  }
}
