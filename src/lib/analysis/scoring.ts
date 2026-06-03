import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import type { AcousticFeatures, AcousticResult } from "@/lib/audio/acoustic";
import type { WordTiming, SegmentTiming } from "@/lib/transcription/types";
import type { VadResult, VadFeatures } from "@/lib/audio/vad";
import type { GrammarAnalysisResult } from "@/lib/analysis/grammar-analysis";
import { computeDerivedMetrics, type DerivedMetrics } from "./derive";

const clamp = (n: number, lo = 35, hi = 95) =>
  Math.max(lo, Math.min(hi, Math.round(Number.isFinite(n) ? n : lo)));

/** What every individual scorer returns. The explanation is deterministic and evidence-based. */
export type ScoreResult = {
  score: number;
  /**
   * Single short sentence explaining the score in plain language, grounded in measured metrics.
   * Used directly in the UI under each dimension card.
   */
  explanation: string;
  /** Indicates whether the score had to fall back to transcript-only signals. */
  qualityFlag: "audio_grounded" | "transcript_only" | "approximate";
};

const TARGET_WPM_LOW = 130;
const TARGET_WPM_HIGH = 165;
const SOFT_WPM_LOW = 110;
const SOFT_WPM_HIGH = 185;

/** Returns 0–100 favouring values inside [innerLo, innerHi], dropping linearly outside [outerLo, outerHi]. */
function plateauScore(value: number, innerLo: number, innerHi: number, outerLo: number, outerHi: number): number {
  if (value >= innerLo && value <= innerHi) return 100;
  if (value < outerLo || value > outerHi) return 0;
  if (value < innerLo) {
    return ((value - outerLo) / (innerLo - outerLo)) * 100;
  }
  return ((outerHi - value) / (outerHi - innerHi)) * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-dimension scorers
// Each scorer is pure and returns a {score, explanation, qualityFlag} so the UI can render evidence.
// ─────────────────────────────────────────────────────────────────────────────

export function scorePace(d: DerivedMetrics, acoustic: AcousticFeatures | null = null): ScoreResult {
  if (d.wpm == null) {
    // Fallback: estimate from sentence + word counts only. Less precise, marked accordingly.
    const proxy = d.avgWordsPerSentence > 0 ? Math.min(d.avgWordsPerSentence * 11, 200) : 130;
    const raw = plateauScore(proxy, TARGET_WPM_LOW, TARGET_WPM_HIGH, SOFT_WPM_LOW - 30, SOFT_WPM_HIGH + 40);
    return {
      score: clamp(raw, 40, 80),
      explanation:
        "We could not measure your tempo precisely — there were no word timings on this recording. Try running the assessment with faster-whisper enabled for a real pace score.",
      qualityFlag: "transcript_only",
    };
  }
  const wpm = d.wpm;
  let raw = plateauScore(wpm, TARGET_WPM_LOW, TARGET_WPM_HIGH, SOFT_WPM_LOW - 30, SOFT_WPM_HIGH + 40);
  const collapseN = acoustic?.intensity.collapseSegments.length ?? d.energyCollapseCount;
  if (collapseN > 0) {
    raw -= Math.min(25, collapseN * 8);
  }
  let explanation: string;
  if (wpm < SOFT_WPM_LOW) {
    explanation = `You averaged ${Math.round(wpm)} WPM, which sits below the conversational sweet spot (${TARGET_WPM_LOW}–${TARGET_WPM_HIGH}). Aim for a touch quicker on the next pass.`;
  } else if (wpm > SOFT_WPM_HIGH) {
    explanation = `You averaged ${Math.round(wpm)} WPM, faster than the ${TARGET_WPM_LOW}–${TARGET_WPM_HIGH} target range. Slow your busiest sentences and add a pause where you'd normally rush.`;
  } else if (wpm >= TARGET_WPM_LOW && wpm <= TARGET_WPM_HIGH) {
    explanation = `Your tempo (${Math.round(wpm)} WPM) is right in the conversational target band.`;
  } else {
    const dir = wpm < TARGET_WPM_LOW ? "slightly slow" : "slightly fast";
    explanation = `You averaged ${Math.round(wpm)} WPM — ${dir} of the ${TARGET_WPM_LOW}–${TARGET_WPM_HIGH} target.`;
  }
  if (collapseN > 0) {
    explanation += ` Voice energy dropped in ${collapseN} segment${collapseN === 1 ? "" : "s"}, which can make pacing feel uneven.`;
  }
  return {
    score: clamp(raw),
    explanation,
    qualityFlag: collapseN > 0 || acoustic ? "audio_grounded" : "audio_grounded",
  };
}

export function scoreFluency(d: DerivedMetrics): ScoreResult {
  // Component scores; each 0–100.
  let runComponent = 70;
  const fillerComponent = clamp(100 - d.fillerRatePerMin * 10, 0, 100); // 6 per min → 40
  let pauseComponent = 70;

  if (d.pauseCount != null && d.longPauseCount != null) {
    // Long pauses hurt more than regular ones; ≥3 long pauses in a ~60s clip is "broken flow."
    pauseComponent = clamp(100 - d.longPauseCount * 18 - Math.max(0, (d.pauseCount - 3)) * 4, 0, 100);
  }
  if (d.repeatedWordCount > 0 || d.restartCount > 0) {
    runComponent -= Math.min(40, d.repeatedWordCount * 6 + d.restartCount * 10);
  }
  runComponent -= Math.min(25, d.trailingCount * 5 + d.restateCount * 6);
  const raw = (runComponent + fillerComponent + pauseComponent) / 3;
  const explanationBits: string[] = [];
  if (d.fillerCount > 0) {
    explanationBits.push(
      `${d.fillerCount} filler${d.fillerCount === 1 ? "" : "s"} (${Math.round(d.fillerRatePerMin)} per minute)`,
    );
  }
  if (d.longPauseCount != null && d.longPauseCount > 0) {
    explanationBits.push(`${d.longPauseCount} long pause${d.longPauseCount === 1 ? "" : "s"}`);
  }
  if (d.repeatedWordCount > 0 || d.restartCount > 0) {
    explanationBits.push(`${d.repeatedWordCount + d.restartCount} restart/repeat${d.repeatedWordCount + d.restartCount === 1 ? "" : "s"}`);
  }
  if (d.trailingCount > 0) {
    explanationBits.push(`${d.trailingCount} trailing-off phrase${d.trailingCount === 1 ? "" : "s"}`);
  }
  if (d.restateCount > 0) {
    explanationBits.push(`${d.restateCount} restatement${d.restateCount === 1 ? "" : "s"}`);
  }
  const explanation =
    explanationBits.length === 0
      ? "Steady flow with no significant interruptions detected."
      : `Flow was interrupted by ${explanationBits.join(", ")}.`;
  return {
    score: clamp(raw),
    explanation,
    qualityFlag: d.pauseCount == null ? "transcript_only" : "audio_grounded",
  };
}

export function scoreClarity(d: DerivedMetrics, acoustic: AcousticFeatures | null): ScoreResult {
  if (!acoustic || d.clarityEstimate == null) {
    // Transcript-only fallback: low-confidence words + repeat/restart noise.
    let raw = 70;
    if (d.lowConfidenceWordCount != null && d.wordCount > 0) {
      raw -= Math.min(35, (d.lowConfidenceWordCount / d.wordCount) * 90);
    }
    raw -= Math.min(20, d.restartCount * 4);
    return {
      score: clamp(raw),
      explanation:
        "Clarity is estimated from transcript confidence only because acoustic analysis was not available on this recording.",
      qualityFlag: "transcript_only",
    };
  }
  // Audio-grounded clarity: HNR + shimmer + low-confidence words.
  let raw = d.clarityEstimate * 70 + 25;
  if (d.lowConfidenceWordCount != null && d.wordCount > 0) {
    raw -= Math.min(20, (d.lowConfidenceWordCount / d.wordCount) * 60);
  }
  const explanation =
    d.clarityEstimate != null
      ? `Voice clarity score ${(d.clarityEstimate * 100).toFixed(0)}% from spectral contrast${
          d.lowConfidenceWordCount != null
            ? `; ${d.lowConfidenceWordCount} word${d.lowConfidenceWordCount === 1 ? "" : "s"} fell below the ASR confidence threshold`
            : ""
        }.`
      : "Clarity estimated from acoustic voice-quality features.";
  return { score: clamp(raw), explanation, qualityFlag: "audio_grounded" };
}

export function scoreConfidence(d: DerivedMetrics, acoustic: AcousticFeatures | null): ScoreResult {
  if (!acoustic) {
    // Transcript-only: use fillers + restarts as a (weak) proxy for hesitation.
    const raw = 70 - Math.min(30, d.fillerRatePerMin * 4) - Math.min(20, d.restartCount * 6);
    return {
      score: clamp(raw),
      explanation:
        "Confidence is a rough estimate (no acoustic features). Acoustic analysis adds volume stability and pitch variation to this score.",
      qualityFlag: "transcript_only",
    };
  }
  const volumeComponent = d.loudnessStability == null ? 60 : d.loudnessStability * 100;
  const pitchComponent = d.pitchVariation == null ? 50 : d.pitchVariation * 100;
  const energyComponent = d.energyEstimate == null ? 60 : d.energyEstimate * 100;
  // We want stable volume (heavier weight), some pitch movement (medium), and enough energy (light).
  let raw = volumeComponent * 0.5 + pitchComponent * 0.3 + energyComponent * 0.2;
  raw -= Math.min(20, d.restartCount * 5);
  const pitchPhrase =
    d.pitchVariation == null
      ? ""
      : d.pitchVariation < 0.3
        ? "but pitch variation was narrow"
        : "with healthy pitch variation";
  const volumePhrase =
    d.loudnessStability == null
      ? ""
      : d.loudnessStability > 0.7
        ? "Your volume stayed steady"
        : "Your volume drifted noticeably across the recording";
  const explanation =
    volumePhrase && pitchPhrase
      ? `${volumePhrase}, ${pitchPhrase}.`
      : "Confidence estimated from voice stability and energy.";
  return { score: clamp(raw), explanation, qualityFlag: "audio_grounded" };
}

export function scorePronunciationApprox(
  d: DerivedMetrics,
  acoustic: AcousticFeatures | null,
): ScoreResult {
  // We are NOT doing real phoneme alignment. This is an approximation based on:
  //   1. Mean word confidence from Whisper (high = the model heard you clearly).
  //   2. Low-confidence word density (low = clear articulation).
  //   3. Acoustic clarity (HNR, shimmer) when available.
  let raw = 70;
  let usedAcoustic = false;
  if (d.meanWordConfidence != null) {
    raw = 40 + d.meanWordConfidence * 50; // 0.6 conf → 70, 0.85 conf → 82, 0.95 conf → 87
  }
  if (d.lowConfidenceWordCount != null && d.wordCount > 0) {
    raw -= Math.min(25, (d.lowConfidenceWordCount / d.wordCount) * 70);
  }
  if (acoustic && d.clarityEstimate != null) {
    raw = raw * 0.7 + d.clarityEstimate * 100 * 0.3;
    usedAcoustic = true;
  }
  const flag: ScoreResult["qualityFlag"] = usedAcoustic
    ? "audio_grounded"
    : d.meanWordConfidence != null
      ? "approximate"
      : "transcript_only";
  const explanation =
    d.lowConfidenceWordCount != null
      ? `Estimated locally from transcript confidence (${(d.meanWordConfidence ?? 0).toFixed(2)} avg) and ${
          d.lowConfidenceWordCount
        } unclear word${d.lowConfidenceWordCount === 1 ? "" : "s"}${usedAcoustic ? " plus acoustic clarity" : ""}.`
      : "Estimated heuristically — install faster-whisper for a real pronunciation signal.";
  return { score: clamp(raw), explanation, qualityFlag: flag };
}

const GRAMMAR_BAD_PHRASES = [
  /\bcould of\b/gi,
  /\bshould of\b/gi,
  /\bwould of\b/gi,
  /\btheir is\b/gi,
  /\balot\b/gi,
];

export function scoreGrammar(
  d: DerivedMetrics,
  transcript: string,
  grammarAnalysis?: GrammarAnalysisResult | null,
): ScoreResult {
  if (grammarAnalysis && grammarAnalysis.errors !== undefined) {
    return {
      score: grammarAnalysis.score,
      explanation: grammarAnalysis.summary || "Grammar reviewed from your transcript.",
      qualityFlag: "transcript_only",
    };
  }

  const flagged = GRAMMAR_BAD_PHRASES.reduce(
    (acc, re) => acc + (transcript.match(re)?.length ?? 0),
    0,
  );
  let raw = clamp(52 + Math.min(d.avgWordsPerSentence * 2.2, 28) - Math.min(d.fillerRatePerMin, 12), 35, 92);
  raw -= Math.min(20, flagged * 6);
  const explanation =
    flagged > 0
      ? `${flagged} non-standard phrase${flagged === 1 ? "" : "s"} detected. Sentence length averages ${d.avgWordsPerSentence.toFixed(1)} words — keep clauses tight without losing structure.`
      : `Sentences averaged ${d.avgWordsPerSentence.toFixed(1)} words; no common non-standard phrases caught.`;
  return { score: clamp(raw), explanation, qualityFlag: "transcript_only" };
}

export function scoreVocabulary(d: DerivedMetrics): ScoreResult {
  const raw = clamp(
    45 + d.lexicalDiversity * 85 - Math.min(d.fillerRatePerMin * 0.5, 10) - Math.min(d.hedgeCount * 4, 20),
    35,
    92,
  );
  const hedgeNote =
    d.hedgeCount > 0 ? ` Hedging phrases appeared ${d.hedgeCount} time${d.hedgeCount === 1 ? "" : "s"}.` : "";
  const explanation = `Lexical diversity was ${(d.lexicalDiversity * 100).toFixed(0)}% (${d.uniqueWordCount} unique of ${d.wordCount} words).${hedgeNote}`;
  return { score: clamp(raw), explanation, qualityFlag: "transcript_only" };
}

export function scoreFillerWords(d: DerivedMetrics): ScoreResult {
  const hedgePenalty = Math.min(25, d.hedgeCount * 5);
  const raw = clamp(100 - d.fillerRatePerMin * 8 - hedgePenalty, 0, 100);
  const bits: string[] = [];
  if (d.fillerCount > 0) {
    bits.push(
      `${d.fillerCount} classic filler${d.fillerCount === 1 ? "" : "s"} (${Math.round(d.fillerRatePerMin)}/min)`,
    );
  }
  if (d.hedgeCount > 0) {
    bits.push(`${d.hedgeCount} hedge phrase${d.hedgeCount === 1 ? "" : "s"}`);
  }
  const explanation =
    bits.length === 0
      ? "Zero filler words or hedge phrases detected — strong control."
      : `Detected ${bits.join(" and ")}.`;
  return { score: clamp(raw), explanation, qualityFlag: "transcript_only" };
}

/** Weighted average across the six skill dimensions plus the bonus delivery dimensions. */
export function scoreOverall(scores: SixDimensionScores): number {
  const vals = Object.values(scores);
  return clamp(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public bundle
// ─────────────────────────────────────────────────────────────────────────────

export type VoiceAnalysis = {
  transcript: string;
  durationSec: number | null;
  wordTimings: WordTiming[] | null;
  asrConfidence: { mean: number | null; lowConfidenceCount: number | null };
  fillerStats: { count: number; ratePerMin: number; rateLabel: string };
  pauseStats: {
    count: number | null;
    longCount: number | null;
    avgMs: number | null;
    totalMs: number | null;
  };
  acousticFeatures: AcousticFeatures | null;
  acousticReason: string | null;
  vadFeatures: VadFeatures | null;
  vadReason: string | null;
  derivedMetrics: DerivedMetrics;
  scores: SixDimensionScores;
  /** Per-dimension evidence-based explanations. Keys mirror `DimensionKey`. */
  explanations: Record<DimensionKey, string>;
  /** Quality of each score so the UI can mark transcript-only estimates. */
  qualityFlags: Record<DimensionKey, ScoreResult["qualityFlag"]>;
  /**
   * Bonus delivery scores that don't fit the six core dimensions but are still useful to surface.
   * `clarity` and `confidence` are scored separately so the UI can show them as supporting evidence
   * even though they fold into pronunciation/fluency internally.
   */
  bonusSignals: {
    clarity: ScoreResult;
    confidence: ScoreResult;
  };
};

/**
 * The primary scoring entry point. Pure function over the analysis inputs — easy to test and
 * deterministic for a given set of metrics. Pass `acoustic.available === false` (or omit) when
 * acoustic analysis could not run; the scoring degrades gracefully.
 */
export function scoresFromAnalysis(input: {
  transcript: string;
  wordTimings?: WordTiming[];
  segments?: SegmentTiming[];
  durationSec?: number | null;
  acoustic?: AcousticResult;
  /** Optional VAD result — when available, supersedes timing-gap pause math. */
  vad?: VadResult;
  /** Groq grammar analysis — when present, drives the grammar score. */
  grammarAnalysis?: GrammarAnalysisResult | null;
}): VoiceAnalysis {
  const features =
    input.acoustic && input.acoustic.available ? input.acoustic.features : null;
  const vadFeatures = input.vad && input.vad.available ? input.vad.features : null;
  const derived = computeDerivedMetrics({
    transcript: input.transcript,
    wordTimings: input.wordTimings,
    segments: input.segments,
    durationSec: input.durationSec ?? null,
    acoustic: features,
    vad: vadFeatures,
  });

  const pace = scorePace(derived, features);
  const fluency = scoreFluency(derived);
  const clarity = scoreClarity(derived, features);
  const confidence = scoreConfidence(derived, features);
  const pronunciation = scorePronunciationApprox(derived, features);
  const grammar = scoreGrammar(derived, input.transcript, input.grammarAnalysis);
  const vocabulary = scoreVocabulary(derived);
  const fillerWords = scoreFillerWords(derived);

  const scores: SixDimensionScores = {
    pronunciation: pronunciation.score,
    grammar: grammar.score,
    fluency: fluency.score,
    vocabulary: vocabulary.score,
    filler_words: fillerWords.score,
    pacing: pace.score,
  };

  const explanations: Record<DimensionKey, string> = {
    pronunciation: pronunciation.explanation,
    grammar: grammar.explanation,
    fluency: fluency.explanation,
    vocabulary: vocabulary.explanation,
    filler_words: fillerWords.explanation,
    pacing: pace.explanation,
  };

  const qualityFlags: Record<DimensionKey, ScoreResult["qualityFlag"]> = {
    pronunciation: pronunciation.qualityFlag,
    grammar: grammar.qualityFlag,
    fluency: fluency.qualityFlag,
    vocabulary: vocabulary.qualityFlag,
    filler_words: "transcript_only",
    pacing: pace.qualityFlag,
  };

  const fillerLabel =
    derived.fillerRatePerMin < 2
      ? "rare"
      : derived.fillerRatePerMin < 6
        ? "occasional"
        : derived.fillerRatePerMin < 12
          ? "frequent"
          : "very frequent";

  return {
    transcript: input.transcript,
    durationSec: input.durationSec ?? derived.wpm != null ? input.durationSec ?? null : null,
    wordTimings: input.wordTimings ?? null,
    asrConfidence: {
      mean: derived.meanWordConfidence,
      lowConfidenceCount: derived.lowConfidenceWordCount,
    },
    fillerStats: {
      count: derived.fillerCount,
      ratePerMin: Number.isFinite(derived.fillerRatePerMin) ? Math.round(derived.fillerRatePerMin * 10) / 10 : 0,
      rateLabel: fillerLabel,
    },
    pauseStats: {
      count: derived.pauseCount,
      longCount: derived.longPauseCount,
      avgMs: derived.avgPauseMs,
      totalMs: derived.totalPauseMs,
    },
    acousticFeatures: features,
    acousticReason: input.acoustic && !input.acoustic.available ? input.acoustic.reason : null,
    vadFeatures,
    vadReason: input.vad && !input.vad.available ? input.vad.reason : null,
    derivedMetrics: derived,
    scores,
    explanations,
    qualityFlags,
    bonusSignals: { clarity, confidence },
  };
}

/**
 * Back-compat shim: keeps the original `scoresFromTranscript(text)` API working for existing callers
 * (assessment finalize, simulation finalize, meeting prep finalize, etc.). Those routes will be migrated
 * to `scoresFromAnalysis` later for richer signal; until then they get the same numbers they used to.
 */
export function scoresFromTranscriptCompat(transcript: string): SixDimensionScores {
  return scoresFromAnalysis({ transcript }).scores;
}
