import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTrendInsights, type TrendSession } from "@/lib/analysis/trends";

const NOW = Date.UTC(2026, 4, 14, 12, 0, 0);

function session(input: {
  id: string;
  kind: string;
  daysAgo: number;
  scores?: Partial<TrendSession["scores"]>;
  fillerPerMinute?: number | null;
  wpm?: number | null;
  longPauseCount?: number | null;
  loudnessStability?: number | null;
}): TrendSession {
  const base: TrendSession["scores"] = {
    pronunciation: 70,
    grammar: 70,
    fluency: 70,
    vocabulary: 70,
    filler_words: 70,
    pacing: 70,
  };
  return {
    id: input.id,
    kind: input.kind,
    createdAt: NOW - input.daysAgo * 24 * 60 * 60 * 1000,
    scores: { ...base, ...input.scores },
    metrics:
      input.fillerPerMinute !== undefined ||
      input.wpm !== undefined ||
      input.longPauseCount !== undefined ||
      input.loudnessStability !== undefined
        ? {
            wpm: input.wpm ?? null,
            fillerPerMinute: input.fillerPerMinute ?? null,
            longPauseCount: input.longPauseCount ?? null,
            loudnessStability: input.loudnessStability ?? null,
          }
        : null,
  };
}

describe("buildTrendInsights", () => {
  // Pin Date.now so the "this week / last week" windows are deterministic regardless of CI time.
  const realDateNow = Date.now;
  beforeAll(() => {
    Date.now = () => NOW;
  });
  afterAll(() => {
    Date.now = realDateNow;
  });

  it("returns nothing meaningful with zero sessions", () => {
    const r = buildTrendInsights([]);
    expect(r.insights).toEqual([]);
    expect(r.hasBaseline).toBe(false);
  });

  it("surfaces baseline-vs-latest improvement when a dimension jumped >=5 points and >=8%", () => {
    const baseline = session({
      id: "b",
      kind: "onboarding_assessment",
      daysAgo: 14,
      scores: { pacing: 55 },
    });
    const latest = session({
      id: "p1",
      kind: "daily_practice",
      daysAgo: 1,
      scores: { pacing: 70 },
    });
    const r = buildTrendInsights([baseline, latest]);
    expect(r.hasBaseline).toBe(true);
    expect(r.scoreDeltas?.pacing).toBeGreaterThan(0);
    expect(r.insights.some((i) => i.id === "improve-pacing")).toBe(true);
  });

  it("reports filler-word reduction across consecutive weeks", () => {
    const baseline = session({ id: "b", kind: "onboarding_assessment", daysAgo: 21 });
    const lastWeek = [
      session({ id: "lw1", kind: "daily_practice", daysAgo: 10, fillerPerMinute: 10 }),
      session({ id: "lw2", kind: "daily_practice", daysAgo: 9, fillerPerMinute: 9 }),
      session({ id: "lw3", kind: "daily_practice", daysAgo: 8, fillerPerMinute: 11 }),
    ];
    const thisWeek = [
      session({ id: "tw1", kind: "daily_practice", daysAgo: 4, fillerPerMinute: 6 }),
      session({ id: "tw2", kind: "daily_practice", daysAgo: 3, fillerPerMinute: 5 }),
      session({ id: "tw3", kind: "daily_practice", daysAgo: 2, fillerPerMinute: 7 }),
    ];
    const r = buildTrendInsights([baseline, ...lastWeek, ...thisWeek]);
    expect(r.insights.some((i) => i.id === "fillers-down")).toBe(true);
  });

  it("calls out confidence consistency when loudness stability is high", () => {
    const baseline = session({ id: "b", kind: "onboarding_assessment", daysAgo: 14 });
    const thisWeek = [
      session({ id: "1", kind: "daily_practice", daysAgo: 3, loudnessStability: 0.82 }),
      session({ id: "2", kind: "daily_practice", daysAgo: 2, loudnessStability: 0.8 }),
      session({ id: "3", kind: "daily_practice", daysAgo: 1, loudnessStability: 0.78 }),
    ];
    const r = buildTrendInsights([baseline, ...thisWeek]);
    expect(r.insights.some((i) => i.id === "confidence-consistent")).toBe(true);
  });
});
