import { describe, expect, it } from "vitest";
import { scoresFromAnalysis } from "@/lib/analysis/scoring";
import {
  DEFEND_UNPOPULAR_EXERCISE_ID,
  buildFallbackTaskReview,
  exerciseTaskReviewResultSchema,
  exerciseTaskReviewSchema,
  parseExerciseTaskReviewResult,
  promptTranscriptOverlap,
  rubricInstructionsForExercise,
  type ExerciseContextForTaskReview,
} from "@/lib/coach/exercise-task-review-core";

const baseExercise = (over: Partial<ExerciseContextForTaskReview> = {}): ExerciseContextForTaskReview => ({
  exerciseId: "filler-three-beat-status",
  title: "Status update in three beats",
  subtitle: "Replace fillers with deliberate pauses",
  category: "filler_control",
  focus: "filler_words",
  coachingGoal: "Cut filler words below 4 per minute.",
  promptText: "Your manager just pinged: 'Quick status on the migration?' Reply out loud.",
  targetDurationSec: 55,
  ...over,
});

describe("exerciseTaskReviewSchema", () => {
  it("accepts a valid payload", () => {
    const raw = {
      taskFitScore: 72,
      promptCompletion: "You addressed the manager ping and outlined status, blockers, and next step.",
      scenarioRelevance: "The workplace scenario reads clearly and matches the prompt stakes.",
      structureFeedback: "You used a three-part arc; tighten transitions between beats two and three.",
      toneFeedback: "Tone stayed professional; a touch more calm on the second beat would read as senior.",
      communicationEffectiveness: "Listeners can follow the narrative and the ask without re-listening.",
      whatWorked: "Clear opening line and explicit next step at the end.",
      whatToImprove: "Name owners earlier so accountability is obvious mid-answer.",
      revisedNextAttemptStrategy: "Start with the headline outcome, then blockers, then one named owner and date.",
    };
    expect(exerciseTaskReviewSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects invalid LLM-style output (short strings / bad score)", () => {
    const bad = {
      taskFitScore: 900,
      promptCompletion: "short",
      scenarioRelevance: "short",
      structureFeedback: "short",
      toneFeedback: "short",
      communicationEffectiveness: "short",
      whatWorked: "x",
      whatToImprove: "x",
      revisedNextAttemptStrategy: "short",
    };
    expect(exerciseTaskReviewSchema.safeParse(bad).success).toBe(false);
  });
});

describe("exerciseTaskReviewResultSchema", () => {
  it("requires taskReviewSource", () => {
    const ok = exerciseTaskReviewResultSchema.safeParse({
      taskFitScore: 60,
      promptCompletion: "Adequate alignment with the prompt and enough detail to evaluate progress meaningfully.",
      scenarioRelevance: "Scenario fit is reasonable and the stakes of the prompt are reflected in the answer.",
      structureFeedback: "Structure is acceptable; add a clearer closing beat so the listener knows you finished.",
      toneFeedback: "Tone is mostly steady; reduce rushed phrases in the middle third of the response.",
      communicationEffectiveness: "Overall message lands; sharpen the listener takeaway in the final sentence.",
      whatWorked: "You engaged with the exercise and produced substantive spoken content.",
      whatToImprove: "Tie examples more explicitly back to the coaching goal line by line.",
      revisedNextAttemptStrategy: "Open with thesis, add one concrete example, then close with the action the prompt requests.",
      taskReviewSource: "fallback",
    });
    expect(ok.success).toBe(true);
  });
});

describe("parseExerciseTaskReviewResult", () => {
  it("returns null when missing or malformed", () => {
    expect(parseExerciseTaskReviewResult(undefined)).toBeNull();
    expect(parseExerciseTaskReviewResult({ taskFitScore: 5 })).toBeNull();
  });

  it("parses a persisted-shaped object", () => {
    const tr = parseExerciseTaskReviewResult({
      taskFitScore: 61,
      promptCompletion:
        "You mostly followed the instructions and referenced the migration context with enough specificity to grade.",
      scenarioRelevance: "The workplace scenario is recognizable and aligned with the stated manager ping.",
      structureFeedback: "Three-part thinking shows up; make beat boundaries crisper with verbal signposting.",
      toneFeedback: "Professional and direct; reduce filler-adjacent hedging in the middle section.",
      communicationEffectiveness: "A busy listener could extract status, risk, and next step without confusion.",
      whatWorked: "Concrete nouns around the migration and a credible next step.",
      whatToImprove: "Spell out ownership earlier and tighten the final sentence.",
      revisedNextAttemptStrategy: "Use headline → evidence → owner/date, then invite one clarifying question.",
      taskReviewSource: "ollama",
    });
    expect(tr?.taskReviewSource).toBe("ollama");
    expect(tr?.taskFitScore).toBe(61);
  });
});

describe("rubricInstructionsForExercise", () => {
  it("selects interview rubric with STAR language", () => {
    const text = rubricInstructionsForExercise(baseExercise({ category: "interview" }));
    expect(text.toLowerCase()).toContain("star");
  });

  it("selects defend-unpopular rubric by exercise id", () => {
    const text = rubricInstructionsForExercise(
      baseExercise({ exerciseId: DEFEND_UNPOPULAR_EXERCISE_ID, category: "confidence" }),
    );
    expect(text).toContain("unpopular");
    expect(text.toLowerCase()).toContain("change their mind");
  });
});

describe("buildFallbackTaskReview", () => {
  it("returns fallback source and bounded taskFitScore", () => {
    const voice = scoresFromAnalysis({
      transcript: "hello world ".repeat(30),
      durationSec: 45,
    });
    const out = buildFallbackTaskReview({
      exercise: baseExercise(),
      transcript: "hello world ".repeat(30),
      voice,
    });
    expect(out.taskReviewSource).toBe("fallback");
    expect(out.taskFitScore).toBeGreaterThanOrEqual(28);
    expect(out.taskFitScore).toBeLessThanOrEqual(78);
  });
});

describe("promptTranscriptOverlap", () => {
  it("returns higher overlap when transcript echoes prompt terms", () => {
    const p = "migration vendor redesign analytics sprint";
    const low = promptTranscriptOverlap(p, "I like pizza and cats");
    const high = promptTranscriptOverlap(p, "We paused migration while redesigning analytics for the sprint");
    expect(high).toBeGreaterThan(low);
  });
});
