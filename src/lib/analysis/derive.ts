import type { WordTiming, SegmentTiming } from "@/lib/transcription/types";
import type { AcousticFeatures } from "@/lib/audio/acoustic";
import { deriveVadStats, type VadFeatures } from "@/lib/audio/vad";

/** Pause = silence between adjacent words >= MIN_PAUSE_MS. Long pause = >= LONG_PAUSE_MS. */
export const MIN_PAUSE_MS = 350;
export const LONG_PAUSE_MS = 1200;

const FILLER_RE = /\b(um+|uh+|uhm+|erm+|ah+|hmm+|like|you know|i mean|so basically|basically|actually|kind of|sort of)\b/gi;

/** Output of {@link computeDerivedMetrics}. Drives both the scoring layer and the UI's "key metrics" row. */
export type DerivedMetrics = {
  // ── Transcript-level (always available)
  wordCount: number;
  uniqueWordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  lexicalDiversity: number;
  fillerCount: number;
  fillerRatePerMin: number;
  repeatedWordCount: number;
  /** Self-corrections / restarts. Heuristic: "I— I"-style stutter or "the the". */
  restartCount: number;
  /** Words whose ASR probability fell below `LOW_CONFIDENCE_THRESHOLD`. Null when timings unavailable. */
  lowConfidenceWordCount: number | null;
  meanWordConfidence: number | null;

  // ── Timing-based (require wordTimings; null otherwise)
  wpm: number | null;
  /** Articulation rate = words per minute excluding pauses (i.e. only when actually speaking). */
  articulationRate: number | null;
  pauseCount: number | null;
  longPauseCount: number | null;
  avgPauseMs: number | null;
  totalPauseMs: number | null;
  /** Voiced ratio derived from word spans / total duration. Complementary to opensmile's voicedRatio. */
  speakingRatio: number | null;

  // ── Acoustic (require openSMILE; null otherwise)
  pitchVariation: number | null;
  loudnessStability: number | null;
  clarityEstimate: number | null;
  monotoneEstimate: number | null;
  energyEstimate: number | null;

  // ── VAD-grounded (overrides timing-gap pauses when available)
  vadProvider: "silero" | "webrtcvad" | null;
  /** Continuous silence at the start of the recording (dead-air before speaking). */
  preSpeechSilenceMs: number | null;
  /** Longest single pause within the recording, in ms (VAD-grounded). */
  longestPauseMs: number | null;
};

const LOW_CONFIDENCE_THRESHOLD = 0.55;

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function normaliseWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9']+/g, "");
}

function countRepeatedWords(words: string[]): number {
  let n = 0;
  for (let i = 1; i < words.length; i++) {
    const a = normaliseWord(words[i - 1]!);
    const b = normaliseWord(words[i]!);
    if (!a || !b) continue;
    if (a === b && a.length >= 2) n++;
  }
  return n;
}

function countRestarts(text: string): number {
  // Heuristic: "I— I", "the— the", or "the the the" — Whisper rarely emits em-dashes, so also match dashes/hyphens.
  const dashRestart = (text.match(/\b(\w+)\s*[—–-]\s*\1\b/gi) ?? []).length;
  // Stutter-style: same short word repeated 3+ in a row.
  const stutter = (text.match(/\b(\w{1,4})\s+\1\s+\1\b/gi) ?? []).length;
  return dashRestart + stutter;
}

function pauseStatsFromWords(words: WordTiming[], segments?: SegmentTiming[]): {
  pauseCount: number;
  longPauseCount: number;
  totalPauseMs: number;
  avgPauseMs: number;
  speakingMs: number;
} {
  let pauseCount = 0;
  let longPauseCount = 0;
  let totalPauseMs = 0;
  let speakingMs = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    speakingMs += Math.max(0, (w.end - w.start) * 1000);
    if (i === 0) continue;
    const gapMs = (w.start - words[i - 1]!.end) * 1000;
    if (gapMs >= MIN_PAUSE_MS) {
      pauseCount++;
      totalPauseMs += gapMs;
      if (gapMs >= LONG_PAUSE_MS) longPauseCount++;
    }
  }

  // Whisper's word timings can miss the gap between two segments; trust the segment-level gap as well.
  if (segments && segments.length > 1) {
    for (let i = 1; i < segments.length; i++) {
      const gapMs = (segments[i]!.start - segments[i - 1]!.end) * 1000;
      if (gapMs >= LONG_PAUSE_MS) {
        longPauseCount++;
        pauseCount++;
        totalPauseMs += gapMs;
      }
    }
  }

  return {
    pauseCount,
    longPauseCount,
    totalPauseMs: Math.round(totalPauseMs),
    avgPauseMs: pauseCount > 0 ? Math.round(totalPauseMs / pauseCount) : 0,
    speakingMs: Math.round(speakingMs),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Normalises eGeMAPS stddev/range numbers into a 0–1 "expressiveness" scalar. */
function pitchVariationFrom(features: AcousticFeatures): number | null {
  const std = features.pitchStddevSemitones;
  const range = features.pitchRangeSemitones;
  if (std == null && range == null) return null;
  const a = std == null ? 0 : clamp01(std / 4); // 4 semitones stddev ≈ very expressive
  const b = range == null ? 0 : clamp01(range / 12); // an octave of range = maximum
  if (std == null) return b;
  if (range == null) return a;
  return (a + b) / 2;
}

/** Lower variance → more stable loudness. Returns 0..1 where 1 = rock steady. */
function loudnessStabilityFrom(features: AcousticFeatures): number | null {
  const sd = features.loudnessStddev;
  if (sd == null) return null;
  // eGeMAPSv02 normalised stddev typically lands in 0.2–1.2 for human speech.
  return clamp01(1 - sd / 1.2);
}

/** Clarity proxy: HNR (higher = cleaner) and inverse shimmer (lower = cleaner). 0..1. */
function clarityFrom(features: AcousticFeatures): number | null {
  const hnr = features.hnrMeanDb;
  const shimmer = features.shimmerLocaldB;
  if (hnr == null && shimmer == null) return null;
  const a = hnr == null ? 0 : clamp01((hnr + 5) / 25); // -5..20 dB → 0..1
  const b = shimmer == null ? 0 : clamp01(1 - shimmer / 1.5); // 0..1.5 dB → 1..0
  if (hnr == null) return b;
  if (shimmer == null) return a;
  return (a + b) / 2;
}

/** Inverse of pitch variation. High monotone score = low expressiveness. */
function monotoneFrom(features: AcousticFeatures): number | null {
  const v = pitchVariationFrom(features);
  if (v == null) return null;
  return clamp01(1 - v);
}

/** Energy proxy: mean loudness, scaled. */
function energyFrom(features: AcousticFeatures): number | null {
  const v = features.loudnessMean;
  if (v == null) return null;
  return clamp01(v / 0.6); // eGeMAPS Zwicker loudness ~0..1 with healthy speech around 0.3–0.6
}

/**
 * Pure function that synthesises every derived metric from whatever inputs are available. Designed to
 * cope with partial inputs (no word timings, no acoustic features) by emitting `null` for the affected
 * fields. The scoring layer is responsible for deciding how to weight each null.
 */
export function computeDerivedMetrics(input: {
  transcript: string;
  wordTimings?: WordTiming[];
  segments?: SegmentTiming[];
  durationSec?: number | null;
  acoustic?: AcousticFeatures | null;
  /** Optional VAD output — when present, pause/silence stats use real VAD instead of word-gap heuristics. */
  vad?: VadFeatures | null;
}): DerivedMetrics {
  const transcript = input.transcript;
  const words = tokenize(transcript);
  const lowerText = transcript.toLowerCase();
  const fillerMatches = lowerText.match(FILLER_RE) ?? [];
  const sentenceParts = transcript.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const unique = new Set(words.map(normaliseWord).filter(Boolean));

  // Determine duration:
  //  1. Explicit duration (best — comes from Whisper info or audio probe).
  //  2. Last word end (if word timings available).
  //  3. Heuristic from word count assuming ~150 wpm (never used for scoring; just keeps fillerRate sane).
  const wordTimings = input.wordTimings;
  const lastWordEnd =
    wordTimings && wordTimings.length > 0 ? wordTimings[wordTimings.length - 1]!.end : 0;
  const durationSec =
    input.durationSec != null && input.durationSec > 0
      ? input.durationSec
      : lastWordEnd > 0
        ? lastWordEnd
        : null;
  const safeMinutes = durationSec ? durationSec / 60 : null;

  // Transcript counters (always available).
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentenceParts.length);
  const fillerCount = fillerMatches.length;
  const fillerRatePerMin = safeMinutes && safeMinutes > 0 ? fillerCount / safeMinutes : fillerCount * 6; // assume ~10s if unknown
  const repeatedWordCount = countRepeatedWords(words);
  const restartCount = countRestarts(transcript);

  // ASR confidence (only meaningful when word timings carry probabilities).
  let lowConfidenceWordCount: number | null = null;
  let meanWordConfidence: number | null = null;
  if (wordTimings && wordTimings.length > 0) {
    let lc = 0;
    let sum = 0;
    for (const w of wordTimings) {
      if (w.probability < LOW_CONFIDENCE_THRESHOLD) lc++;
      sum += w.probability;
    }
    lowConfidenceWordCount = lc;
    meanWordConfidence = sum / wordTimings.length;
  }

  // Timing-based metrics.
  let wpm: number | null = null;
  let articulationRate: number | null = null;
  let pauseCount: number | null = null;
  let longPauseCount: number | null = null;
  let avgPauseMs: number | null = null;
  let totalPauseMs: number | null = null;
  let speakingRatio: number | null = null;

  if (wordTimings && wordTimings.length > 0 && safeMinutes && safeMinutes > 0) {
    wpm = wordTimings.length / safeMinutes;
    const stats = pauseStatsFromWords(wordTimings, input.segments);
    pauseCount = stats.pauseCount;
    longPauseCount = stats.longPauseCount;
    avgPauseMs = stats.avgPauseMs;
    totalPauseMs = stats.totalPauseMs;
    // Articulation rate = words per minute of actual speech (exclude pauses).
    if (stats.speakingMs > 0) {
      articulationRate = wordTimings.length / (stats.speakingMs / 60_000);
    }
    if (durationSec && durationSec > 0) {
      speakingRatio = Math.max(0, Math.min(1, stats.speakingMs / 1000 / durationSec));
    }
  }

  // VAD: when available, override the timing-gap pause stats with real silence detection. The
  // articulation rate is recomputed against actual speaking time rather than estimated from word
  // spans, which is meaningfully more accurate for paced or hesitant speech.
  const vad = input.vad ?? null;
  let vadProvider: DerivedMetrics["vadProvider"] = null;
  let preSpeechSilenceMs: number | null = null;
  let longestPauseMs: number | null = null;
  if (vad) {
    vadProvider = vad.provider;
    const stats = deriveVadStats(vad);
    pauseCount = stats.pauseCount;
    longPauseCount = stats.longPauseCount;
    avgPauseMs = stats.avgPauseMs;
    totalPauseMs = stats.totalSilenceMs;
    longestPauseMs = stats.longestPauseMs;
    preSpeechSilenceMs = stats.preSpeechSilenceMs;
    speakingRatio = vad.speakingRatio;
    if (wordTimings && wordTimings.length > 0 && vad.speakingSec > 0) {
      articulationRate = wordTimings.length / (vad.speakingSec / 60);
    }
  }

  // Acoustic-derived signals.
  const ac = input.acoustic ?? null;
  return {
    wordCount,
    uniqueWordCount: unique.size,
    sentenceCount,
    avgWordsPerSentence: wordCount / sentenceCount,
    lexicalDiversity: wordCount > 0 ? unique.size / wordCount : 0,
    fillerCount,
    fillerRatePerMin,
    repeatedWordCount,
    restartCount,
    lowConfidenceWordCount,
    meanWordConfidence,
    wpm,
    articulationRate,
    pauseCount,
    longPauseCount,
    avgPauseMs,
    totalPauseMs,
    speakingRatio,
    pitchVariation: ac ? pitchVariationFrom(ac) : null,
    loudnessStability: ac ? loudnessStabilityFrom(ac) : null,
    clarityEstimate: ac ? clarityFrom(ac) : null,
    monotoneEstimate: ac ? monotoneFrom(ac) : null,
    energyEstimate: ac ? energyFrom(ac) : null,
    vadProvider,
    preSpeechSilenceMs,
    longestPauseMs,
  };
}
