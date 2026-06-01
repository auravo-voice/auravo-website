import { describe, expect, it } from "vitest";
import { scoresFromAnalysis } from "@/lib/analysis/scoring";
import { serializeAnalysisForPersistence, type CanonicalAnalysis } from "@/lib/analysis/run-analysis";
import { exerciseTaskReviewResultSchema } from "@/lib/coach/exercise-task-review-core";

function minimalAnalysis(over: Partial<CanonicalAnalysis> = {}): CanonicalAnalysis {
  const transcript = "hello world ".repeat(40);
  const voice = scoresFromAnalysis({ transcript, durationSec: 60 });
  const base: CanonicalAnalysis = {
    transcript: transcript.trim(),
    adapter: "test",
    modelName: null,
    language: "en",
    durationSec: 60,
    scores: voice.scores,
    voice,
    deep: { grammarFlags: [], pronunciationTips: [] },
    conversation: null,
    conversationCoachNotes: [],
    coachSummary: {
      biggestIssue: "Sharpen the closing sentence so the ask is unmistakable.",
      strength: "Steady pace in the middle third of the answer.",
      patterns: [],
      acousticPatterns: [],
      summary: "Good session overall with clear next steps for the learner to practice again tomorrow.",
      strengths: ["Steady pace in the middle third of the answer."],
      improvementAreas: ["Sharpen the closing sentence so the ask is unmistakable."],
      scoreExplanations: { ...voice.explanations },
      recommendedExerciseIds: ["filler-three-beat-status"],
      recommendationRationale: "This session targets filler control gaps visible in the recording.",
      fallbackUsed: false,
      warning: null,
    },
    taskReview: null,
    candidateExercises: [
      {
        id: "filler-three-beat-status",
        title: "Status update in three beats",
        subtitle: "Replace fillers with deliberate pauses",
        category: "filler_control",
        focus: "filler_words",
        coachingGoal: "Cut filler words.",
        promptPreview: "Your manager…",
      },
    ],
    ...over,
  };
  return base;
}

describe("serializeAnalysisForPersistence taskReview", () => {
  it("includes taskReview in persisted JSON when present", () => {
    const taskReview = exerciseTaskReviewResultSchema.parse({
      taskFitScore: 64,
      promptCompletion:
        "You referenced the migration scenario and gave a plausible status update with enough detail to evaluate.",
      scenarioRelevance: "The answer stays in the workplace frame implied by the exercise prompt.",
      structureFeedback: "Structure is acceptable; transitions between beats could be verbally signposted.",
      toneFeedback: "Tone is professional; reduce rushed phrasing in the middle of the response.",
      communicationEffectiveness: "Listeners can follow the gist without replaying the audio.",
      whatWorked: "Concrete nouns tied to the scenario and a credible next step.",
      whatToImprove: "Name owners earlier and tighten the final sentence.",
      revisedNextAttemptStrategy: "Headline outcome, then blockers, then one owner and date.",
      taskReviewSource: "ollama",
    });
    const json = JSON.parse(serializeAnalysisForPersistence(minimalAnalysis({ taskReview })));
    expect(json.taskReview?.taskFitScore).toBe(64);
    expect(json.taskReview?.taskReviewSource).toBe("ollama");
  });

  it("serializes null taskReview for non-practice flows", () => {
    const json = JSON.parse(serializeAnalysisForPersistence(minimalAnalysis()));
    expect(json.taskReview).toBeNull();
  });
});
