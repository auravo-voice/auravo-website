import "server-only";

import { z } from "zod";

import { groqChatStructured } from "@/lib/groq/chat-json";
import { PLAIN_LANGUAGE_COACH_RULES } from "@/lib/coach/plain-language-style";
import { getGroqCoachTimeoutMs } from "@/lib/groq/env";

export type VocabularySuggestion = {
  /** Exact phrase from the transcript (spoken words). */
  phrase: string;
  /** Clearer or more precise wording the speaker could use. */
  improvement: string;
  reason: string;
};

export type VocabularyAnalysisResult = {
  suggestions: VocabularySuggestion[];
  score: number;
  summary: string;
  strengths: string[];
};

const suggestionSchema = z.object({
  phrase: z.string().min(1),
  improvement: z.string().min(1),
  reason: z.string().min(1),
});

const vocabularyResponseSchema = z.object({
  suggestions: z.array(suggestionSchema).default([]),
  strengths: z.array(z.string()).default([]),
  summary: z.string().min(1),
});

function normalizeVocabularyPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const rawList = Array.isArray(o.suggestions)
    ? o.suggestions
    : Array.isArray(o.improvements)
      ? o.improvements
      : [];
  const suggestions: z.infer<typeof suggestionSchema>[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const phrase = String(row.phrase ?? row.error ?? row.word ?? row.text ?? "").trim();
    const improvement = String(
      row.improvement ?? row.correction ?? row.better ?? row.suggestion ?? "",
    ).trim();
    const reason = String(row.reason ?? row.explanation ?? row.impact ?? "").trim();
    if (!phrase || !improvement) continue;
    suggestions.push({
      phrase,
      improvement,
      reason: reason || `Try “${improvement}” — it sounds clearer than “${phrase}”.`,
    });
  }
  const strengths = Array.isArray(o.strengths)
    ? o.strengths.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  const summary =
    typeof o.summary === "string" && o.summary.trim()
      ? o.summary.trim()
      : suggestions.length > 0
        ? `Found ${suggestions.length} word-choice upgrade${suggestions.length === 1 ? "" : "s"} to sound more precise.`
        : "Word choice was clear and appropriate for the context.";
  return { suggestions, strengths, summary };
}

function computeVocabularyScore(suggestionCount: number, wordCount: number, lexicalDiversity: number): number {
  const diversityComponent = Math.round(45 + lexicalDiversity * 85);
  if (wordCount < 1) return diversityComponent;
  const penalty = Math.min(35, suggestionCount * 7);
  return Math.max(0, Math.min(100, Math.round(diversityComponent - penalty)));
}

/**
 * Groq-powered vocabulary / word-choice review (precision, register, vague words).
 * Grammar analysis handles tense/articles separately.
 */
export async function analyzeVocabularyWithGroq(
  transcript: string,
  lexicalDiversity: number,
): Promise<VocabularyAnalysisResult | null> {
  const trimmed = transcript.trim();
  if (trimmed.length < 8) {
    return {
      suggestions: [],
      score: 75,
      summary: "Not enough speech to assess vocabulary reliably.",
      strengths: [],
    };
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  const prompt = `You help someone speak clearer English from a voice recording transcript (often no punctuation).

Find better word choices only — NOT grammar fixes (tense, a/an/the, he/she vs they, etc.).

Look for:
- Vague words (thing, stuff, nice, good, bad, a lot) → say something more specific
- Weak verbs (get, do, make, go) → use a stronger verb when it fits
- Words that sound too casual or too stiff for the situation
- Saying the same simple word too many times when another word works

Rules:
- "phrase" MUST be copied exactly from the transcript
- "improvement" MUST be words they can say out loud (no adding commas or periods only)
- Max 6 suggestions; skip tiny nitpicks
- Do NOT repeat grammar fixes (could of, their/there, etc.)

${PLAIN_LANGUAGE_COACH_RULES}

For each suggestion, "reason" should be one short simple sentence a friend would say (e.g. "This sounds more specific" not "This enhances lexical precision").

Return JSON only:
{
  "suggestions": [
    { "phrase": "exact words from transcript", "improvement": "better wording", "reason": "one short simple sentence" }
  ],
  "strengths": ["one thing they did well with words — in simple language"],
  "summary": "one short simple sentence about their word choice overall"
}

Transcript:
${trimmed.slice(0, 4000)}`;

  try {
    const parsed = await groqChatStructured({
      messages: [{ role: "user", content: prompt }],
      schema: vocabularyResponseSchema,
      maxTokens: 1200,
      temperature: 0.15,
      timeoutMs: getGroqCoachTimeoutMs(),
      normalize: normalizeVocabularyPayload,
    });
    const suggestions = parsed.suggestions.slice(0, 6);
    return {
      suggestions,
      score: computeVocabularyScore(suggestions.length, wordCount, lexicalDiversity),
      summary: parsed.summary,
      strengths: parsed.strengths,
    };
  } catch (e) {
    console.error("[vocabulary-analysis] Groq failed:", e);
    return null;
  }
}
