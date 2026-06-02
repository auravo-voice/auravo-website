import "server-only";

export function getGroqApiKey(): string {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env.local or .env.production.local on the server.");
  }
  return key;
}

export function getGroqModel(): string {
  const raw = process.env.GROQ_MODEL?.trim();
  return raw && raw.length > 0 ? raw : "llama-3.1-8b-instant";
}

const COACH_TIMEOUT_MIN = 15_000;
const COACH_TIMEOUT_MAX = 120_000;

/** Max wait for Groq chat completion calls (coach UI, task review, simulations). */
export function getGroqCoachTimeoutMs(): number {
  const raw = process.env.AURAVO_COACH_TIMEOUT_MS ?? process.env.GROQ_TIMEOUT_MS;
  const parsed = raw != null && raw !== "" ? Number.parseInt(raw, 10) : NaN;
  const ms = Number.isFinite(parsed) ? parsed : 60_000;
  return Math.min(COACH_TIMEOUT_MAX, Math.max(COACH_TIMEOUT_MIN, ms));
}
