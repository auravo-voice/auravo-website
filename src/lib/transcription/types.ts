import "server-only";

import type { AsrWordHint } from "@/lib/assessment/baseline-analysis-types";

/** Per-word timestamp + ASR confidence as produced by faster-whisper. */
export type WordTiming = {
  word: string;
  start: number;
  end: number;
  probability: number;
};

/** Per-segment (whisper-internal grouping) timing + text. */
export type SegmentTiming = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptionResult = {
  /** Joined plain text — keep this stable for back-compat with existing routes. */
  text: string;
  /**
   * Low-confidence word hints used by the deep-analysis pronunciation tips. Present when faster-whisper
   * produced word-level probabilities; absent for the placeholder adapter.
   */
  asrWordHints?: AsrWordHint[];
  /** Optional per-word timing + probability. Drives WPM, pause detection, and confidence metrics. */
  wordTimings?: WordTiming[];
  /** Optional per-segment timing — used for long-pause detection between Whisper segments. */
  segments?: SegmentTiming[];
  /** Audio duration in seconds (model report or fallback to last word end). */
  durationSec?: number;
  /** Whisper model name, e.g. "base". Persisted in `session_transcript.adapter` metadata. */
  modelName?: string;
  /** Detected language code (e.g. "en"). */
  language?: string;
};

export type TranscriptionAdapter = {
  readonly name: string;
  transcribe(audioAbsolutePath: string): Promise<TranscriptionResult>;
};
