import "server-only";
import { OllamaCoachError } from "@/lib/ollama/chat-json";

export type CoachServeResult<T> = {
  data: T;
  /** User-safe notice when live Ollama output was skipped (timeout, unreachable, etc.). */
  warning: string | null;
};

function isTimeoutLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError";
}

export function coachFailureWarning(error: unknown): string {
  if (error instanceof OllamaCoachError) {
    return error.message;
  }
  if (isTimeoutLike(error)) {
    return "The local coach took too long to respond, so sample content is shown. Try raising AURAVO_COACH_TIMEOUT_MS in .env.local, then reload.";
  }
  return "Sample coach content is shown until the local coach responds successfully.";
}
