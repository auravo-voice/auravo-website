import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY } from "@/lib/practice/exercises";
import { buildWeekPlan } from "@/lib/practice/week-plan";
import { pickRecommendedExercises, isValidRecommendationSet } from "@/lib/practice/recommend";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";

const lowFillers: SixDimensionScores = {
  pronunciation: 78,
  grammar: 75,
  fluency: 70,
  vocabulary: 80,
  filler_words: 42, // weakest
  pacing: 68,
};

describe("pickRecommendedExercises", () => {
  it("prefers exercises that target the weakest dimension", () => {
    const plan = buildWeekPlan({
      userId: "test-user-1",
      scores: lowFillers,
      goalId: "professional",
      now: new Date("2026-05-12T12:00:00Z"),
    });
    const picks = pickRecommendedExercises({ scores: lowFillers, weekPlan: plan, count: 3 });
    expect(picks.length).toBeGreaterThan(0);
    // The very first pick should target the weakest dimension (filler_words) if such a template exists
    // anywhere in the plan, since the picker exhausts the weakest dim before moving on.
    const targetsWeakDim = picks[0]!.focus === "filler_words";
    const planHasWeakDim = plan.days.some((d) => d.exercises.some((e) => e.focus === "filler_words"));
    if (planHasWeakDim) {
      expect(targetsWeakDim).toBe(true);
    }
  });

  it("falls back to EXERCISE_LIBRARY when no week plan is supplied", () => {
    const picks = pickRecommendedExercises({ scores: lowFillers, weekPlan: null, count: 2 });
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) {
      expect(EXERCISE_LIBRARY.some((t) => t.id === p.id)).toBe(true);
    }
  });

  it("excludes the just-completed exercise", () => {
    const plan = buildWeekPlan({
      userId: "test-user-2",
      scores: lowFillers,
      goalId: "general",
      now: new Date("2026-05-12T12:00:00Z"),
    });
    const justDid = plan.days[0]?.exercises[0];
    if (!justDid) throw new Error("week plan produced an empty first day");
    const picks = pickRecommendedExercises({
      scores: lowFillers,
      weekPlan: plan,
      excludeIds: [justDid.id],
      count: 3,
    });
    for (const p of picks) {
      expect(p.id).not.toBe(justDid.id);
    }
  });

  it("returns a non-empty preview prompt for each pick", () => {
    const picks = pickRecommendedExercises({ scores: lowFillers, weekPlan: null, count: 3 });
    for (const p of picks) {
      expect(p.promptPreview.length).toBeGreaterThan(20);
      expect(p.promptPreview.length).toBeLessThanOrEqual(220);
    }
  });
});

describe("isValidRecommendationSet", () => {
  it("rejects ids not in the candidate pool", () => {
    const pool = pickRecommendedExercises({ scores: lowFillers, weekPlan: null, count: 3 });
    expect(isValidRecommendationSet([pool[0]!.id], pool)).toBe(true);
    expect(isValidRecommendationSet(["nonexistent-id-12345"], pool)).toBe(false);
    expect(isValidRecommendationSet([pool[0]!.id, "nonexistent"], pool)).toBe(false);
  });

  it("rejects empty arrays", () => {
    const pool = pickRecommendedExercises({ scores: lowFillers, weekPlan: null, count: 2 });
    expect(isValidRecommendationSet([], pool)).toBe(false);
  });
});
