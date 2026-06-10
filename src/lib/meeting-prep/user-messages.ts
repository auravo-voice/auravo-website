/** Shown when the plan API returns a deterministic fallback instead of Groq output. */
export const MEETING_PREP_PLAN_FALLBACK_NOTICE =
  "We couldn't reach the AI coach in time, so we filled in a starter plan you can edit and rehearse with.";

const FRIENDLY_API_ERRORS = new Set([
  "Paste an agenda or topic (at least one sentence).",
  "Invalid meeting type.",
  "Invalid audience.",
  "Missing agenda.",
  "Plan shape is invalid.",
  "Invalid difficulty.",
  "Invalid mode.",
  "Expected JSON body.",
  "No active session.",
  "Session not found.",
  "Not your session.",
  "Session is not an open rehearsal draft.",
  "Audio file is required.",
  "Invalid sessionId.",
]);

/** Map API / thrown errors to copy safe for learners (never expose Groq, env vars, or HTTP bodies). */
export function meetingPrepErrorMessage(
  raw: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const msg = raw.trim();
  if (FRIENDLY_API_ERRORS.has(msg)) return msg;
  if (msg.startsWith("Paste at least") || msg.startsWith("Generate a plan")) return msg;
  if (msg.startsWith("No audio") || msg.startsWith("Microphone")) return msg;

  const lower = msg.toLowerCase();
  if (lower.includes("429") || lower.includes("rate limit")) {
    return "Our AI coach is busy right now. Please wait a minute and try again.";
  }
  if (lower.includes("timeout") || lower.includes("did not finish within") || lower.includes("abort")) {
    return "The AI coach took too long to respond. Try again in a moment.";
  }
  if (
    lower.includes("groq") ||
    lower.includes("grok") ||
    lower.includes(".env") ||
    lower.includes("auravo_coach") ||
    lower.includes("schema") ||
    lower.includes("valid json") ||
    lower.includes("empty message")
  ) {
    return "AI coaching isn't available right now. Try again later.";
  }
  if (/failed \(\d{3}\)/.test(msg) || lower.includes("http ")) {
    return fallback;
  }
  if (msg.length > 120) return fallback;

  return fallback;
}
