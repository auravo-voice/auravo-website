import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RadarDimension } from "@/lib/coach/schemas";
import { ExerciseFeedback, type ExerciseResult } from "@/app/(app)/practice/practice-runner";

const dims: RadarDimension[] = [
  { key: "pronunciation", label: "Speech clarity", score: 70 },
  { key: "grammar", label: "Grammar", score: 70 },
  { key: "fluency", label: "Fluency", score: 70 },
  { key: "vocabulary", label: "Vocabulary", score: 70 },
  { key: "filler_words", label: "Filler control", score: 70 },
  { key: "pacing", label: "Pacing", score: 70 },
];

function baseResult(over: Partial<ExerciseResult> = {}): ExerciseResult {
  return {
    promptId: "test-ex",
    promptTitle: "Test exercise",
    focus: "fluency",
    averageScore: 70,
    dimensions: dims,
    voiceAnalysis: { derivedMetrics: { wpm: 140 }, fillerStats: { count: 2, ratePerMin: 2 } },
    coachSummary: {
      summary:
        "You kept a conversational pace and the arc was easy to follow. Tighten the final beat so the listener knows you finished.",
    },
    taskReview: null,
    recommendedExercises: [],
    ...over,
  };
}

describe("ExerciseFeedback markup", () => {
  it("renders without task-review sections when taskReview is null", () => {
    const html = renderToStaticMarkup(
      <ExerciseFeedback result={baseResult()} onContinue={() => {}} isLast={false} />,
    );
    expect(html).toContain("Session review");
    expect(html).toContain("Delivery notes");
    expect(html).not.toContain("Communication review");
  });

  it("renders task-review sections when taskReview is present", () => {
    const html = renderToStaticMarkup(
      <ExerciseFeedback
        result={baseResult({
          taskReview: {
            taskFitScore: 66,
            promptCompletion:
              "You addressed the core prompt with enough specificity that a listener can tell you answered this exercise.",
            scenarioRelevance: "The scenario framing matches the brief and the stakes feel plausible.",
            structureFeedback: "Structure is clear enough; signpost transitions so each section is obvious.",
            toneFeedback: "Tone is steady and professional without sounding defensive.",
            communicationEffectiveness: "The message lands; sharpen the takeaway in the final sentence.",
            whatWorked: "Concrete details and a credible attempt at the closing move the prompt asked for.",
            whatToImprove: "Name trade-offs earlier so the middle of the answer feels less generic.",
            revisedNextAttemptStrategy: "Open with thesis, add one example, then close with the requested action.",
            taskReviewSource: "groq",
          },
        })}
        onContinue={() => {}}
        isLast={false}
      />,
    );
    expect(html).toContain("Communication review");
    expect(html).toContain("How well you answered the prompt");
    expect(html).toContain("What to try next time");
    expect(html).toContain("Task fit");
  });
});
