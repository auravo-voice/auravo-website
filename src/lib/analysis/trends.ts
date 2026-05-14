/**
 * Longitudinal trend analysis over a learner's saved sessions. Pure functions — no DB, no LLM,
 * no I/O. The caller (e.g. /progress page) loads sessions + their `analysisJson` and threads them
 * through `buildTrendInsights()` to surface insights like "your pacing improved 11% vs baseline".
 */

import type { SixDimensionScores } from "@/lib/assessment/heuristics";

/** Snapshot of a single saved session for trend comparison. */
export type TrendSession = {
  id: string;
  kind: string;
  createdAt: number;
  scores: SixDimensionScores;
  /** Optional rich metrics persisted on session_transcript.analysisJson. May be null on old rows. */
  metrics?: {
    wpm?: number | null;
    fillerCount?: number | null;
    fillerPerMinute?: number | null;
    longPauseCount?: number | null;
    pauseCount?: number | null;
    speakingRatio?: number | null;
    clarityEstimate?: number | null;
    loudnessStability?: number | null;
    pitchVariation?: number | null;
  } | null;
};

export type TrendInsight = {
  id: string;
  /** Plain-text sentence ready to render in the progress journal. */
  message: string;
  /** Optional numeric delta for the UI to render a chip (+12% / −3). Positive = improvement. */
  deltaPct?: number;
  /** Optional severity tag — "positive" / "neutral" / "regression" for color coding. */
  tone: "positive" | "neutral" | "regression";
};

export type TrendInsights = {
  insights: TrendInsight[];
  /** Per-dimension overall-score deltas (latest vs baseline). Null when baseline is missing. */
  scoreDeltas: Partial<Record<keyof SixDimensionScores, number>> | null;
  /** Convenience handles for the UI. */
  hasBaseline: boolean;
  sessionsCompared: number;
};

const DIM_KEYS: (keyof SixDimensionScores)[] = [
  "pronunciation",
  "grammar",
  "fluency",
  "vocabulary",
  "filler_words",
  "pacing",
];

const DIM_LABELS: Record<keyof SixDimensionScores, string> = {
  pronunciation: "speech clarity",
  grammar: "grammar",
  fluency: "fluency",
  vocabulary: "vocabulary",
  filler_words: "filler control",
  pacing: "pacing",
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pctChange(latest: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((latest - baseline) / baseline) * 100;
}

function findBaseline(sessions: TrendSession[]): TrendSession | null {
  return sessions.find((s) => s.kind === "onboarding_assessment") ?? null;
}

function findMostRecent(sessions: TrendSession[]): TrendSession | null {
  if (sessions.length === 0) return null;
  return sessions.slice().sort((a, b) => b.createdAt - a.createdAt)[0]!;
}

function recentWindow(sessions: TrendSession[], windowMs: number): TrendSession[] {
  if (sessions.length === 0) return [];
  const cutoff = Date.now() - windowMs;
  return sessions.filter((s) => s.createdAt >= cutoff && s.kind !== "onboarding_assessment");
}

/**
 * Build a small set of evidence-grounded insights from the user's session history. Every insight is
 * pinned to a measured metric (WPM, filler count, score delta) — we never invent prose without a
 * quantitative anchor, so insights stay trustworthy when shown in the UI.
 */
export function buildTrendInsights(sessions: TrendSession[]): TrendInsights {
  if (sessions.length === 0) {
    return { insights: [], scoreDeltas: null, hasBaseline: false, sessionsCompared: 0 };
  }
  const baseline = findBaseline(sessions);
  const latest = findMostRecent(sessions);
  const thisWeek = recentWindow(sessions, ONE_WEEK_MS);
  const lastWeek = recentWindow(sessions, ONE_WEEK_MS * 2).filter((s) => !thisWeek.includes(s));

  const insights: TrendInsight[] = [];
  let scoreDeltas: TrendInsights["scoreDeltas"] = null;

  if (baseline && latest && baseline.id !== latest.id) {
    scoreDeltas = {};
    for (const dim of DIM_KEYS) {
      scoreDeltas[dim] = Math.round((latest.scores[dim] - baseline.scores[dim]) * 10) / 10;
    }
    // Biggest improvement vs baseline (>= 5 points and >= 8% relative change).
    const sortedImprovements = DIM_KEYS.map((d) => ({
      dim: d,
      pct: pctChange(latest.scores[d], baseline.scores[d]),
      abs: latest.scores[d] - baseline.scores[d],
    })).sort((a, b) => b.pct - a.pct);
    const topImprovement = sortedImprovements[0]!;
    if (topImprovement.abs >= 5 && topImprovement.pct >= 8) {
      insights.push({
        id: `improve-${topImprovement.dim}`,
        message: `Your ${DIM_LABELS[topImprovement.dim]} improved by ${Math.round(topImprovement.pct)}% compared to your onboarding assessment.`,
        deltaPct: Math.round(topImprovement.pct),
        tone: "positive",
      });
    }
    // Biggest regression vs baseline (<= -5 points and <= -8% relative change).
    const topRegression = sortedImprovements[sortedImprovements.length - 1]!;
    if (topRegression.abs <= -5 && topRegression.pct <= -8) {
      insights.push({
        id: `regression-${topRegression.dim}`,
        message: `Your ${DIM_LABELS[topRegression.dim]} dropped ${Math.abs(Math.round(topRegression.pct))}% versus baseline — let's stack a session there this week.`,
        deltaPct: Math.round(topRegression.pct),
        tone: "regression",
      });
    }
  }

  // Filler-word trend (this week vs last week).
  const fillerThisWeek = avg(
    thisWeek.flatMap((s) => (s.metrics?.fillerPerMinute != null ? [s.metrics.fillerPerMinute] : [])),
  );
  const fillerLastWeek = avg(
    lastWeek.flatMap((s) => (s.metrics?.fillerPerMinute != null ? [s.metrics.fillerPerMinute] : [])),
  );
  if (fillerThisWeek != null && fillerLastWeek != null && fillerLastWeek > 0) {
    const pct = pctChange(fillerThisWeek, fillerLastWeek);
    if (pct <= -10) {
      insights.push({
        id: "fillers-down",
        message: `You used ${Math.round(Math.abs(pct))}% fewer filler words than last week (${fillerThisWeek.toFixed(1)} vs ${fillerLastWeek.toFixed(1)}/min).`,
        deltaPct: -Math.round(pct), // positive = improvement, so flip sign
        tone: "positive",
      });
    } else if (pct >= 25) {
      insights.push({
        id: "fillers-up",
        message: `Filler-word rate climbed back up this week (${fillerThisWeek.toFixed(1)} vs ${fillerLastWeek.toFixed(1)}/min). Schedule a filler-control drill.`,
        deltaPct: -Math.round(pct),
        tone: "regression",
      });
    }
  }

  // WPM stability (variance across recent sessions).
  const recentWpm = thisWeek.flatMap((s) => (s.metrics?.wpm != null ? [s.metrics.wpm] : []));
  if (recentWpm.length >= 3) {
    const m = avg(recentWpm)!;
    const variance =
      recentWpm.reduce((acc, v) => acc + (v - m) * (v - m), 0) / recentWpm.length;
    const stddev = Math.sqrt(variance);
    if (stddev < 15) {
      insights.push({
        id: "wpm-stable",
        message: `Your pace has stabilised around ${Math.round(m)} WPM across recent sessions.`,
        tone: "positive",
      });
    } else if (stddev > 40) {
      insights.push({
        id: "wpm-volatile",
        message: `Your pace swings widely (${Math.round(stddev)} WPM stddev) — pacing drills can dampen that.`,
        tone: "neutral",
      });
    }
  }

  // Loudness/confidence consistency.
  const stabilityValues = thisWeek.flatMap((s) =>
    s.metrics?.loudnessStability != null ? [s.metrics.loudnessStability] : [],
  );
  if (stabilityValues.length >= 3) {
    const m = avg(stabilityValues)!;
    if (m >= 0.75) {
      insights.push({
        id: "confidence-consistent",
        message: "Your speaking confidence has become more consistent — volume holds steady throughout your recordings.",
        tone: "positive",
      });
    }
  }

  // Long-pause control (using pause counts when present).
  const longPausesThisWeek = avg(
    thisWeek.flatMap((s) => (s.metrics?.longPauseCount != null ? [s.metrics.longPauseCount] : [])),
  );
  const longPausesLastWeek = avg(
    lastWeek.flatMap((s) => (s.metrics?.longPauseCount != null ? [s.metrics.longPauseCount] : [])),
  );
  if (
    longPausesThisWeek != null &&
    longPausesLastWeek != null &&
    longPausesLastWeek - longPausesThisWeek >= 1
  ) {
    insights.push({
      id: "pauses-down",
      message: `Long pauses are down to ~${longPausesThisWeek.toFixed(1)} per session (was ${longPausesLastWeek.toFixed(1)}). Smoother flow.`,
      tone: "positive",
    });
  }

  return {
    insights,
    scoreDeltas,
    hasBaseline: baseline != null,
    sessionsCompared: sessions.length,
  };
}
