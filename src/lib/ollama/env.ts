import "server-only";

export function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
}

/** Default coach model; override with OLLAMA_MODEL (use qwen2.5:3b locally for speed). */
export function getOllamaModel(): string {
  const raw = process.env.OLLAMA_MODEL?.trim();
  return raw && raw.length > 0 ? raw : "qwen2.5:3b";
}

const COACH_TIMEOUT_MIN = 30_000;
const COACH_TIMEOUT_MAX = 600_000;

/**
 * Max wait for each Ollama `/api/chat` call used by coach pages (dashboard, APIs, etc.).
 * Cold models and first token can exceed 30s; default 120s is a practical local-dev default.
 */
export function getCoachOllamaTimeoutMs(): number {
  const raw = process.env.AURAVO_COACH_TIMEOUT_MS ?? process.env.OLLAMA_TIMEOUT_MS;
  const parsed = raw != null && raw !== "" ? Number.parseInt(raw, 10) : NaN;
  const ms = Number.isFinite(parsed) ? parsed : 120_000;
  return Math.min(COACH_TIMEOUT_MAX, Math.max(COACH_TIMEOUT_MIN, ms));
}
