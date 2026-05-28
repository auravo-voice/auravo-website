import { describe, expect, it } from "vitest";
import { scoresFromAnalysis } from "@/lib/analysis/scoring";
import {
  DEFEND_UNPOPULAR_EXERCISE_ID,
  buildFallbackTaskReview,
  exerciseTaskReviewResultSchema,
  exerciseTaskReviewSchema,
  normalizeTaskReviewJson,
  parseExerciseTaskReviewResult,
  promptTranscriptOverlap,
  rubricInstructionsForExercise,
  type ExerciseContextForTaskReview,
  type ExerciseTaskReviewPayload,
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

function fallbackPayloadFromInput(
  over: Partial<ExerciseContextForTaskReview> = {},
  transcript = "hello world ".repeat(30),
): ExerciseTaskReviewPayload {
  const voice = scoresFromAnalysis({ transcript, durationSec: 45 });
  const full = buildFallbackTaskReview({ exercise: baseExercise(over), transcript, voice });
  return {
    taskFitScore: full.taskFitScore,
    promptCompletion: full.promptCompletion,
    scenarioRelevance: full.scenarioRelevance,
    structureFeedback: full.structureFeedback,
    toneFeedback: full.toneFeedback,
    communicationEffectiveness: full.communicationEffectiveness,
    whatWorked: full.whatWorked,
    whatToImprove: full.whatToImprove,
    revisedNextAttemptStrategy: full.revisedNextAttemptStrategy,
  };
}

describe("normalizeTaskReviewJson", () => {
  it("fills missing Qwen fields from fallback (partial JSON bug)", () => {
    const fallback = fallbackPayloadFromInput();
    const partial = {
      taskFitScore: 65,
      promptCompletion:
        "You addressed the manager ping and gave enough substance to evaluate prompt coverage meaningfully.",
    };
    const out = normalizeTaskReviewJson(partial, fallback);
    expect(exerciseTaskReviewSchema.safeParse(out).success).toBe(true);
    expect(out.taskFitScore).toBe(65);
    expect(out.promptCompletion).toBe(partial.promptCompletion);
    expect(out.scenarioRelevance).toBe(fallback.scenarioRelevance);
    expect(out.structureFeedback.length).toBeGreaterThanOrEqual(20);
  });

  it("unwraps nested review object and snake_case keys", () => {
    const fallback = fallbackPayloadFromInput();
    const nested = {
      review: {
        task_fit_score: 80,
        prompt_completion:
          "Strong alignment with the migration status prompt and clear next-step ownership for the listener.",
        scenario_relevance:
          "The workplace scenario reads clearly and the stakes match what the manager asked for in the ping.",
        structure_feedback:
          "Three-part arc is visible; signpost each beat so the listener knows when you move sections.",
        tone_feedback:
          "Tone stayed professional and calm; reduce rushed connectors in the middle third of the answer.",
        communication_effectiveness:
          "A busy listener could extract status, risk, and next step without needing a repeat.",
        what_worked: "Concrete nouns around migration and a credible owner for the follow-up.",
        what_to_improve: "Name blockers earlier so accountability is obvious mid-answer.",
        revised_next_attempt_strategy:
          "Open with headline outcome, then blockers, then one named owner and date before you invite questions.",
      },
    };
    const out = normalizeTaskReviewJson(nested, fallback);
    expect(out.taskFitScore).toBe(80);
    expect(out.promptCompletion).toContain("Strong alignment");
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
