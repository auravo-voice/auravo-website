import "server-only";
import type { z } from "zod";
import { getOllamaBaseUrl, getOllamaModel } from "./env";

export type OllamaMessage = { role: "system" | "user" | "assistant"; content: string };

export class OllamaCoachError extends Error {
  constructor(
    message: string,
    public readonly causeDetail?: unknown,
  ) {
    super(message);
    this.name = "OllamaCoachError";
  }
}

function extractJsonBlock(raw: string): string {
  const t = raw.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) return t.slice(start, end + 1);
  return t;
}

export async function ollamaChatStructured<T>(options: {
  messages: OllamaMessage[];
  schema: z.ZodType<T>;
  /** Ollama `num_predict` ceiling; use a lower value for short JSON to finish faster. */
  numPredict?: number;
  /** Abort the HTTP request after this many milliseconds (default 3 minutes). */
  timeoutMs?: number;
}): Promise<T> {
  const { messages, schema, numPredict = 4096, timeoutMs = 180_000 } = options;
  const url = `${getOllamaBaseUrl()}/api/chat`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getOllamaModel(),
        messages,
        stream: false,
        format: "json",
        options: { temperature: 0.35, num_predict: numPredict },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut =
      e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    if (timedOut) {
      const sec = Math.round(timeoutMs / 1000);
      throw new OllamaCoachError(
        `The local coach did not finish within ${sec}s (AbortSignal.timeout). Increase AURAVO_COACH_TIMEOUT_MS in .env.local or use a smaller/faster model (e.g. qwen2.5:3b).`,
        e,
      );
    }
    throw new OllamaCoachError(
      "Could not reach the local coach runtime. Start Ollama locally and install a model (for example: ollama pull qwen2.5:3b).",
      e,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OllamaCoachError(`Ollama HTTP ${res.status}: ${text.slice(0, 240)}`);
  }

  const body = (await res.json()) as { message?: { content?: string } };
  const raw = body.message?.content;
  if (raw == null || raw === "") {
    throw new OllamaCoachError("Ollama returned an empty message.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonBlock(raw));
  } catch (e) {
    throw new OllamaCoachError("The model did not return valid JSON.", e);
  }

  const out = schema.safeParse(parsed);
  if (!out.success) {
    throw new OllamaCoachError(`Model JSON did not match the expected schema: ${out.error.message}`);
  }
  return out.data;
}
