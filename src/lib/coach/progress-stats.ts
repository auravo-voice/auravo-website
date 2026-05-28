import "server-only";
import { toLocalDayKey, type SessionListRow } from "@/db/queries/sessions";
import { DIMENSION_LABELS, type DimensionKey } from "@/lib/assessment/dimensions-from-scores";

const DIMENSIONS: DimensionKey[] = [
  "pronunciation",
  "grammar",
  "fluency",
  "vocabulary",
  "filler_words",
  "pacing",
];

const FIELD_BY_DIM: Record<DimensionKey, keyof NonNullable<SessionListRow["scores"]>> = {
  pronunciation: "pronunciation",
  grammar: "grammar",
  fluency: "fluency",
  vocabulary: "vocabulary",
  filler_words: "fillerWords",
  pacing: "pacing",
};

export type TimelineRow = {
  id: string;
  kind: string;
  title: string;
  scenario: string;
  date: string;
  durationSec: number;
  score: number;
};

export type MilestoneRow = {
  id: string;
  label: string;
  date: string;
};

export type ProgressSnapshot = {
  timeline: TimelineRow[];
  milestones: MilestoneRow[];
  /** Average overall score per week, oldest → newest, up to 7 buckets. `null` if a week has no sessions. */
  weeklyTrend: (number | null)[];
  summary: string;
  hasBaseline: boolean;
  /** True when only the baseline exists — caller shows a CTA to log a daily practice. */
  baselineOnly: boolean;
};

function scenarioLabelFromKind(kind: string): string {
  switch (kind) {
    case "onboarding_assessment":
      return "Baseline";
    case "daily_practice":
      return "Daily practice";
    case "simulation":
      return "Simulation";
    case "meeting_rehearsal":
      return "Meeting prep";
    default:
      return kind;
  }
}

function averageScore(scores: NonNullable<SessionListRow["scores"]>): number {
  return Math.round(
    (scores.pronunciation +
      scores.grammar +
      scores.fluency +
      scores.vocabulary +
      scores.fillerWords +
      scores.pacing) /
      6,
  );
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function computeWeeklyTrend(rows: SessionListRow[]): (number | null)[] {
  const scored = rows.filter((r) => r.scores != null);
  if (scored.length === 0) return Array.from({ length: 7 }, () => null);

  const todayStart = startOfDay(Date.now());
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  for (const row of scored) {
    if (!row.scores) continue;
    const diff = todayStart - startOfDay(row.createdAt);
    if (diff < 0) continue;
    const weeksAgo = Math.floor(diff / oneWeekMs);
    if (weeksAgo >= 7) continue;
    buckets[6 - weeksAgo]?.push(averageScore(row.scores));
  }
  return buckets.map((b) =>
    b.length === 0 ? null : Math.round(b.reduce((a, c) => a + c, 0) / b.length),
  );
}

function computeMilestones(rows: SessionListRow[]): MilestoneRow[] {
  const dated = [...rows]
    .filter((r) => r.scores != null)
    .sort((a, b) => a.createdAt - b.createdAt);
  if (dated.length === 0) return [];

  const baseline = dated[0]!;
  const out: MilestoneRow[] = [];
  out.push({
    id: `m-baseline-${baseline.id}`,
    label: "Baseline assessment saved",
    date: toLocalDayKey(baseline.createdAt),
  });
  if (dated.length === 1) return out;

  // Detect first time each dimension crosses a threshold or improves materially over baseline.
  const seenThreshold = new Set<string>();
  for (const row of dated.slice(1)) {
    if (!row.scores) continue;
    for (const dim of DIMENSIONS) {
      const field = FIELD_BY_DIM[dim];
      const baselineVal = baseline.scores![field];
      const curr = row.scores[field];
      // "Crossed N" for thresholds 60/70/80/90 (one event per dim/threshold ever).
      for (const threshold of [60, 70, 80, 90]) {
        const key = `cross:${dim}:${threshold}`;
        if (seenThreshold.has(key)) continue;
        if (baselineVal < threshold && curr >= threshold) {
          seenThreshold.add(key);
          out.push({
            id: `m-${row.id}-${dim}-${threshold}`,
            label: `${DIMENSION_LABELS[dim]} crossed ${threshold}`,
            date: toLocalDayKey(row.createdAt),
          });
        }
      }
      // Reduction milestone for filler words: ≥25% drop vs baseline (lower is better only if heuristic encodes it
      // that way; this codebase stores higher = better for filler_words because heuristic inverts before saving).
      const dropKey = `drop:${dim}:25`;
      if (!seenThreshold.has(dropKey) && baselineVal > 0) {
        const delta = curr - baselineVal;
        const pct = (delta / baselineVal) * 100;
        if (dim === "filler_words" && pct >= 25) {
          seenThreshold.add(dropKey);
          out.push({
            id: `m-${row.id}-fillers-25`,
            label: "Filler-word score up 25%+ vs baseline",
            date: toLocalDayKey(row.createdAt),
          });
        }
      }
    }
  }

  // First 7-day streak: any 7-day window covered by distinct session days, oldest evidence wins.
  const dayKeys = new Set(dated.map((r) => toLocalDayKey(r.createdAt)));
  const sortedDays = [...dayKeys].sort();
  outer: for (let i = 0; i + 6 < sortedDays.length; i += 1) {
    const start = new Date(sortedDays[i]!);
    let covered = true;
    for (let k = 0; k < 7; k += 1) {
      const probe = new Date(start.getTime() + k * 24 * 60 * 60 * 1000);
      if (!dayKeys.has(toLocalDayKey(probe.getTime()))) {
        covered = false;
        break;
      }
    }
    if (covered) {
      out.push({
        id: "m-first-7-day-streak",
        label: "First 7-day streak",
        date: sortedDays[i + 6]!,
      });
      break outer;
    }
  }

  // Keep most recent ~6 milestones for the UI.
  return out.slice(-6);
}

function summaryText(rows: SessionListRow[]): string {
  const scored = rows.filter((r) => r.scores != null);
  if (scored.length === 0) {
    return "Run the baseline assessment to start your progress journal.";
  }
  if (scored.length === 1) {
    return "Baseline saved. Complete a daily practice session to populate the timeline.";
  }
  const latest = scored[0]!;
  const baseline = scored[scored.length - 1]!;
  const deltaAvg = averageScore(latest.scores!) - averageScore(baseline.scores!);
  if (deltaAvg > 0) {
    return `Across ${scored.length} sessions, your average is up ${deltaAvg} points vs baseline.`;
  }
  if (deltaAvg < 0) {
    return `Across ${scored.length} sessions, your average is ${Math.abs(deltaAvg)} points below baseline — variability is normal early on.`;
  }
  return `Across ${scored.length} sessions, your average is steady vs baseline.`;
}

export function buildProgressSnapshot(rows: SessionListRow[]): ProgressSnapshot {
  const scoredRows = rows.filter((r) => r.scores != null);
  const hasBaseline = rows.some((r) => r.kind === "onboarding_assessment");
  const timeline: TimelineRow[] = rows
    .filter((r) => r.scores != null)
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title ?? scenarioLabelFromKind(r.kind),
      scenario: scenarioLabelFromKind(r.kind),
      date: toLocalDayKey(r.createdAt),
      durationSec: Math.max(0, Math.round((r.durationMs ?? 0) / 1000)),
      score: averageScore(r.scores!),
    }));

  return {
    timeline,
    milestones: computeMilestones(rows),
    weeklyTrend: computeWeeklyTrend(rows),
    summary: summaryText(rows),
    hasBaseline,
    baselineOnly: hasBaseline && scoredRows.length <= 1,
  };
}
