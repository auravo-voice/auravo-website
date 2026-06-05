import "server-only";
import type { z } from "zod";
import { getGroqApiKey, getGroqCoachTimeoutMs, getGroqModel } from "@/lib/groq/env";

export type GroqMessage = { role: "system" | "user" | "assistant"; content: string };

export class GroqCoachError extends Error {
  constructor(
    message: string,
    public readonly causeDetail?: unknown,
  ) {
    super(message);
    this.name = "GroqCoachError";
  }
}

const GROQ_MAX_RETRIES = 3;

/** Parse "Please try again in 5.18s" from Groq 429 bodies. */
function groqRetryDelayMs(status: number, body: string): number | null {
  if (status !== 429) return null;
  const match = body.match(/try again in ([\d.]+)s/i);
  if (match?.[1]) {
    const sec = Number.parseFloat(match[1]);
    if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec * 1000) + 250;
  }
  return 6000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * Structured JSON chat via Groq OpenAI-compatible API.
 */
export async function groqChatStructured<T>(options: {
  messages: GroqMessage[];
  schema: z.ZodType<T>;
  maxTokens?: number;
  timeoutMs?: number;
  temperature?: number;
  normalize?: (parsed: unknown) => unknown;
}): Promise<T> {
  const {
    messages,
    schema,
    maxTokens = 4096,
    timeoutMs = getGroqCoachTimeoutMs(),
    temperature = 0.35,
    normalize,
  } = options;

  const model = getGroqModel();
  const requestBody = JSON.stringify({
    model,
    messages,
    stream: false,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  let lastError: GroqCoachError | null = null;

  for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.warn(`[groq] retry ${attempt}/${GROQ_MAX_RETRIES}`);
    } else {
      console.log(`Groq chat call: model=${model}, messages=${messages.length}`);
    }

    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getGroqApiKey()}`,
        },
        body: requestBody,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const timedOut =
        e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      if (timedOut) {
        const sec = Math.round(timeoutMs / 1000);
        throw new GroqCoachError(
          `Groq did not finish within ${sec}s. Check GROQ_API_KEY and network, or raise AURAVO_COACH_TIMEOUT_MS.`,
          e,
        );
      }
      throw new GroqCoachError(
        "Could not reach Groq. Set GROQ_API_KEY in .env.local (or .env.production.local on the server).",
        e,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const retryMs = groqRetryDelayMs(res.status, text);
      if (retryMs != null && attempt < GROQ_MAX_RETRIES) {
        console.warn(`[groq] rate limited, waiting ${retryMs}ms before retry`);
        await sleep(retryMs);
        continue;
      }
      throw new GroqCoachError(`Groq HTTP ${res.status}: ${text.slice(0, 240)}`);
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = body.choices?.[0]?.message?.content;
    if (raw == null || raw === "") {
      lastError = new GroqCoachError("Groq returned an empty message.");
      if (attempt < GROQ_MAX_RETRIES) {
        await sleep(2000);
        continue;
      }
      throw lastError;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonBlock(raw));
    } catch (e) {
      throw new GroqCoachError("Groq did not return valid JSON.", e);
    }

    if (normalize) {
      parsed = normalize(parsed);
    }

    const out = schema.safeParse(parsed);
    if (!out.success) {
      throw new GroqCoachError(`Groq JSON did not match the expected schema: ${out.error.message}`);
    }
    return out.data;
  }

  throw lastError ?? new GroqCoachError("Groq request failed after retries.");
}

/** @deprecated Use {@link groqChatStructured}. */
export const ollamaChatStructured = groqChatStructured;

/** @deprecated Use {@link GroqMessage}. */
export type OllamaMessage = GroqMessage;
