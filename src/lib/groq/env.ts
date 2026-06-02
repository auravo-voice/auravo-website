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
