import "server-only";

import { ollamaChatStructured, OllamaCoachError } from "@/lib/ollama/chat-json";
import { getCoachOllamaTimeoutMs } from "@/lib/ollama/env";
import {
  buildFallbackTaskReview,
  buildTaskReviewUserPayload,
  exerciseTaskReviewSchema,
  type ExerciseTaskReviewResult,
  type GenerateExerciseTaskReviewInput,
} from "@/lib/coach/exercise-task-review-core";

export * from "@/lib/coach/exercise-task-review-core";

const TASK_REVIEW_SYSTEM = `You are Auravo's exercise task reviewer.

Your job is to judge whether the LEARNER'S TRANSCRIPT actually completes the SPEAKING EXERCISE they were given — not to re-score acoustic or ASR-derived voice metrics.

Hard rules:
- Do NOT invent or recompute WPM, pause counts, filler counts, or dimension scores. Voice metrics in the user JSON are ground truth from deterministic analysis — use them only to inform tone/fluency/delivery comments, and only qualitatively.
- Your ONLY numeric output is taskFitScore (0–100), representing how well they satisfied the exercise prompt, scenario, and coaching goal together.
- Be specific: quote or paraphrase what they said when useful. Avoid generic speaking advice that could apply to any recording.
- If the transcript is very short or off-topic, say so plainly in promptCompletion and keep taskFitScore low.
- Output a single JSON object matching the schema (no markdown, no commentary).`;

/**
 * Structured exercise-vs-transcript review via local Ollama, with deterministic fallback.
 */
export async function generateExerciseTaskReview(
  input: GenerateExerciseTaskReviewInput,
): Promise<ExerciseTaskReviewResult> {
  try {
    const data = await ollamaChatStructured({
      messages: [
        { role: "system", content: TASK_REVIEW_SYSTEM },
        { role: "user", content: buildTaskReviewUserPayload(input) },
      ],
      schema: exerciseTaskReviewSchema,
      numPredict: 900,
      timeoutMs: getCoachOllamaTimeoutMs(),
    });
    return { ...data, taskReviewSource: "ollama" as const };
  } catch (e) {
    const msg = e instanceof OllamaCoachError ? e.message : e instanceof Error ? e.message : String(e);
    console.error("[task-review] Ollama task review failed, using fallback:", msg);
    return buildFallbackTaskReview(input);
  }
}
