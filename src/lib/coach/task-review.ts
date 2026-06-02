import "server-only";

import { groqChatStructured, GroqCoachError } from "@/lib/groq/chat-json";
import { getGroqCoachTimeoutMs } from "@/lib/groq/env";
import {
  buildFallbackTaskReview,
  buildTaskReviewUserPayload,
  exerciseTaskReviewSchema,
  normalizeTaskReviewJson,
  type ExerciseTaskReviewPayload,
  type ExerciseTaskReviewResult,
  type GenerateExerciseTaskReviewInput,
} from "@/lib/coach/exercise-task-review-core";

export * from "@/lib/coach/exercise-task-review-core";

const TASK_REVIEW_SYSTEM = `You are Auravo's exercise task reviewer.

Judge whether the LEARNER TRANSCRIPT completes the SPEAKING EXERCISE — not acoustic scores.

Hard rules:
- Do NOT invent WPM, pause counts, filler counts, or dimension scores. Voice metrics are read-only hints.
- Your only number is taskFitScore (integer 0–100).
- Be specific; paraphrase the learner when useful.
- Return JSON only (no markdown). You MUST include every key below — do not omit fields.

Required JSON shape (all string values except taskFitScore):
{
  "taskFitScore": 72,
  "promptCompletion": "2-3 sentences on prompt coverage",
  "scenarioRelevance": "2-3 sentences on scenario fit",
  "structureFeedback": "2-3 sentences on structure",
  "toneFeedback": "2-3 sentences on tone and delivery",
  "communicationEffectiveness": "2-3 sentences on listener impact",
  "whatWorked": "1-2 sentences on strengths",
  "whatToImprove": "1-2 sentences on gaps",
  "revisedNextAttemptStrategy": "2-3 sentences with a concrete plan for the next take"
}`;

/**
 * Structured exercise-vs-transcript review via Groq, with deterministic fallback.
 */
export async function generateExerciseTaskReview(
  input: GenerateExerciseTaskReviewInput,
): Promise<ExerciseTaskReviewResult> {
  const fallbackFull = buildFallbackTaskReview(input);
  const fallbackPayload: ExerciseTaskReviewPayload = {
    taskFitScore: fallbackFull.taskFitScore,
    promptCompletion: fallbackFull.promptCompletion,
    scenarioRelevance: fallbackFull.scenarioRelevance,
    structureFeedback: fallbackFull.structureFeedback,
    toneFeedback: fallbackFull.toneFeedback,
    communicationEffectiveness: fallbackFull.communicationEffectiveness,
    whatWorked: fallbackFull.whatWorked,
    whatToImprove: fallbackFull.whatToImprove,
    revisedNextAttemptStrategy: fallbackFull.revisedNextAttemptStrategy,
  };

  try {
    const data = await groqChatStructured({
      messages: [
        { role: "system", content: TASK_REVIEW_SYSTEM },
        { role: "user", content: buildTaskReviewUserPayload(input) },
      ],
      schema: exerciseTaskReviewSchema,
      normalize: (parsed) => normalizeTaskReviewJson(parsed, fallbackPayload),
      maxTokens: 1_200,
      temperature: 0.2,
      timeoutMs: getGroqCoachTimeoutMs(),
    });
    return { ...data, taskReviewSource: "groq" as const };
  } catch (e) {
    const msg = e instanceof GroqCoachError ? e.message : e instanceof Error ? e.message : String(e);
    console.error("[task-review] Groq task review failed, using fallback:", msg);
    return fallbackFull;
  }
}
