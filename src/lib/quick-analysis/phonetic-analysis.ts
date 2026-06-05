import "server-only";

import { z } from "zod";

import { groqChatStructured } from "@/lib/groq/chat-json";
import { PLAIN_LANGUAGE_COACH_RULES } from "@/lib/coach/plain-language-style";

const phoneticResponseSchema = z.object({
  pronunciations: z.record(z.string(), z.string()).default({}),
});

/**
 * Simple syllable-style pronunciation guides for low-confidence words (Quick Analysis only).
 */
export async function getPhoneticPronunciations(
  flaggedWords: string[],
): Promise<Record<string, string>> {
  if (flaggedWords.length === 0 || !process.env.GROQ_API_KEY?.trim()) return {};

  const uniqueWords = [...new Set(flaggedWords.map((w) => w.trim()).filter(Boolean))].slice(0, 15);

  const prompt = `For each word below, give a simple way to say it using plain English sounds.
Use syllables separated by middle dots (·). No IPA symbols.

Examples:
particularly → per·tik·yuh·ler·lee
entrepreneurial → on·truh·pruh·nur·ee·ul

${PLAIN_LANGUAGE_COACH_RULES}

Words:
${uniqueWords.join("\n")}

Return JSON only:
{
  "pronunciations": {
    "word": "syllable·guide"
  }
}`;

  try {
    const parsed = await groqChatStructured({
      messages: [{ role: "user", content: prompt }],
      schema: phoneticResponseSchema,
      maxTokens: 400,
      temperature: 0.1,
    });
    return parsed.pronunciations ?? {};
  } catch (e) {
    console.warn("[phonetic] Groq phonetic lookup failed:", e);
    return {};
  }
}
