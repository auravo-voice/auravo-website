import "server-only";

import { z } from "zod";

import { groqChatStructured } from "@/lib/groq/chat-json";

const polishedSchema = z.object({
  text: z.string(),
});

/**
 * Adds punctuation and capitalization for display only. Does not change wording.
 * Falls back to the input when Groq is unavailable or fails.
 */
export async function polishTranscriptForDisplay(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  try {
    const result = await groqChatStructured({
      messages: [
        {
          role: "system",
          content:
            "You fix English speech transcripts for readability. Add standard punctuation and sentence capitalization. Do not paraphrase, omit, or add words. Preserve paragraph breaks (double newlines). Return JSON only.",
        },
        { role: "user", content: trimmed },
      ],
      schema: polishedSchema,
      maxTokens: 2048,
      temperature: 0.1,
    });
    const out = result.text.trim();
    return out.length > 0 ? out : text;
  } catch (e) {
    console.warn("[polish-transcript-display] Groq failed, using raw transcript:", e);
    return text;
  }
}
