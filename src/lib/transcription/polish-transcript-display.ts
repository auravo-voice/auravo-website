import "server-only";

import type { QuickAnalysisTranscriptSegment } from "@/app/quick-analysis/pronunciation-types";
import { groqChatStructured } from "@/lib/groq/chat-json";
import { getGroqApiKey, getGroqCoachTimeoutMs, getGroqModel } from "@/lib/groq/env";
import { z } from "zod";

const polishedSchema = z.object({
  text: z.string(),
});

const POLISH_SYSTEM_PROMPT =
  "You fix English speech transcripts for readability. Add standard punctuation and sentence capitalization. Do not paraphrase, omit, or add words. Preserve paragraph breaks (double newlines). Return only the polished transcript text — no JSON, no commentary.";

const POLISH_JSON_SYSTEM_PROMPT =
  "You fix English speech transcripts for readability. Add standard punctuation and sentence capitalization. Do not paraphrase, omit, or add words. Preserve paragraph breaks (double newlines). Return a single JSON object only: {\"text\":\"your polished transcript here\"}";

/** Coerce common Groq JSON shapes into { text }. */
export function normalizePolishedPayload(parsed: unknown): unknown {
  if (typeof parsed === "string" && parsed.trim()) {
    return { text: parsed.trim() };
  }
  if (Array.isArray(parsed)) {
    const lines = parsed.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
    if (lines.length > 0) return { text: lines.join("\n\n") };
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;
    if (typeof o.text === "string") return parsed;
    for (const key of ["polished", "transcript", "output", "content", "result"]) {
      if (typeof o[key] === "string") return { text: o[key] };
    }
  }
  return parsed;
}

/** Primary path — plain Groq text (reliable; avoids json_validate_failed on long transcripts). */
async function polishViaPlainGroq(text: string): Promise<string | null> {
  const model = getGroqModel();
  const timeoutMs = getGroqCoachTimeoutMs();
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getGroqApiKey()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: POLISH_SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 2048,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const out = body.choices?.[0]?.message?.content?.trim();
    return out && out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

async function polishViaStructuredGroq(text: string): Promise<string | null> {
  try {
    const result = await groqChatStructured({
      messages: [
        { role: "system", content: POLISH_JSON_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      schema: polishedSchema,
      maxTokens: 2048,
      temperature: 0.1,
      normalize: normalizePolishedPayload,
    });
    const out = result.text.trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Adds punctuation and capitalization for display only. Does not change wording.
 * Plain Groq first (historical default); structured JSON as fallback.
 */
export async function polishTranscriptForDisplay(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const plain = await polishViaPlainGroq(trimmed);
  if (plain) return plain;

  const structured = await polishViaStructuredGroq(trimmed);
  if (structured) return structured;

  return text;
}

/** Polish each segment transcript for per-question display. */
export async function polishTranscriptSegmentsForDisplay(
  segments: QuickAnalysisTranscriptSegment[],
): Promise<QuickAnalysisTranscriptSegment[]> {
  return Promise.all(
    segments.map(async (segment) => {
      if (!segment.transcript.trim()) return segment;
      return {
        ...segment,
        transcript: await polishTranscriptForDisplay(segment.transcript),
      };
    }),
  );
}
