import "server-only";
import { GroqCoachError } from "@/lib/groq/chat-json";

export type CoachServeResult<T> = {
  data: T;
  /** User-safe notice when live Groq output was skipped (timeout, unreachable, etc.). */
  warning: string | null;
};

function isTimeoutLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError";
}

export function coachFailureWarning(error: unknown): string {
  if (error instanceof GroqCoachError) {
    return error.message;
  }
  if (isTimeoutLike(error)) {
    return "Groq took too long to respond, so sample content is shown. Try raising AURAVO_COACH_TIMEOUT_MS in .env.local, then reload.";
  }
  return "Sample coach content is shown until Groq responds successfully (check GROQ_API_KEY).";
}
