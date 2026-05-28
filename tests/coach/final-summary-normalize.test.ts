import { describe, expect, it } from "vitest";
import { normalizeFinalSummaryJson } from "@/lib/coach/final-summary";

const fallback = {
  summary: "Your strongest signal was Fluency. The largest gap right now is Pacing.",
  strengths: ["Fluency: steady delivery."],
  improvementAreas: ["Pacing: tempo below target."],
  recommendedExerciseIds: ["pace-drill-1"],
  recommendationRationale: "Short rationale for exercises.",
};

describe("normalizeFinalSummaryJson", () => {
  it("clamps overlong recommendationRationale instead of throwing", () => {
    const long = "x".repeat(500);
    const out = normalizeFinalSummaryJson(
      {
        summary: fallback.summary,
        strengths: fallback.strengths,
        improvementAreas: fallback.improvementAreas,
        recommendedExerciseIds: fallback.recommendedExerciseIds,
        recommendationRationale: long,
      },
      fallback,
    );
    expect(out.recommendationRationale.length).toBeLessThanOrEqual(420);
    expect(out.recommendationRationale.endsWith("...")).toBe(true);
    expect(out.recommendationRationale).not.toBe(long);
  });

  it("clamps overlong summary and list items", () => {
    const out = normalizeFinalSummaryJson(
      {
        summary: "a".repeat(800),
        strengths: ["b".repeat(200)],
        improvementAreas: ["c".repeat(200)],
        recommendedExerciseIds: ["ex-1"],
        recommendationRationale: "Enough rationale here for the plan.",
      },
      fallback,
    );
    expect(out.summary.length).toBeLessThanOrEqual(700);
    expect(out.strengths[0]!.length).toBeLessThanOrEqual(140);
    expect(out.improvementAreas[0]!.length).toBeLessThanOrEqual(140);
  });
});
