import "server-only";

import { z } from "zod";
import { groqChatStructured } from "@/lib/groq/chat-json";
import { getGroqCoachTimeoutMs } from "@/lib/groq/env";
import { finalizeSpokenGrammarAnalysis } from "@/lib/analysis/spoken-grammar-filter";

export type GrammarErrorType =
  | "tense"
  | "article"
  | "preposition"
  | "agreement"
  | "word_choice"
  | "other";

export interface GrammarError {
  error: string;
  correction: string;
  type: GrammarErrorType;
  explanation: string;
}

export interface GrammarAnalysisResult {
  errors: GrammarError[];
  score: number;
  summary: string;
  strengths: string[];
}

const grammarErrorTypeSchema = z.enum([
  "tense",
  "article",
  "preposition",
  "agreement",
  "word_choice",
  "other",
]);

const grammarErrorSchema = z.object({
  error: z.string().min(1),
  correction: z.string().min(1),
  type: grammarErrorTypeSchema,
  explanation: z.string().min(1),
});

const grammarResponseSchema = z.object({
  errors: z.array(grammarErrorSchema).default([]),
  strengths: z.array(z.string()).default([]),
  summary: z.string().min(1),
});

function normalizeErrorType(raw: unknown): GrammarErrorType {
  const t = String(raw ?? "other")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  if (t.includes("tense")) return "tense";
  if (t.includes("article")) return "article";
  if (t.includes("preposition") || t.includes("prep")) return "preposition";
  if (t.includes("agreement") || t.includes("subject")) return "agreement";
  if (t.includes("word") || t.includes("choice")) return "word_choice";
  if (
    grammarErrorTypeSchema.options.includes(t as GrammarErrorType)
  ) {
    return t as GrammarErrorType;
  }
  return "other";
}

/** Coerce common Groq shape drift before Zod (extra keys, wrong casing, alternate field names). */
function normalizeGrammarPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;

  const errorsRaw = Array.isArray(o.errors) ? o.errors : [];
  const errors: z.infer<typeof grammarErrorSchema>[] = [];
  for (const item of errorsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const error = String(row.error ?? row.phrase ?? row.text ?? "").trim();
    const correction = String(row.correction ?? row.fix ?? row.suggestion ?? "").trim();
    if (!error || !correction) continue;
    const explanation =
      String(row.explanation ?? row.reason ?? row.note ?? "").trim() ||
      `Use "${correction}" instead of "${error}".`;
    errors.push({
      error,
      correction,
      type: normalizeErrorType(row.type ?? row.category),
      explanation,
    });
  }

  const strengths = Array.isArray(o.strengths)
    ? o.strengths.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];

  const summary =
    typeof o.summary === "string" && o.summary.trim()
      ? o.summary.trim()
      : typeof o.overall === "string" && o.overall.trim()
        ? o.overall.trim()
        : errors.length > 0
          ? `Found ${errors.length} grammar pattern${errors.length === 1 ? "" : "s"} to polish.`
          : "No major grammar issues stood out in this transcript.";

  return { errors, strengths, summary };
}

function computeGrammarScore(errorCount: number, wordCount: number): number {
  if (wordCount < 1) return 75;
  const errorsPerHundredWords = (errorCount / wordCount) * 100;
  return Math.max(0, Math.min(100, Math.round(100 - errorsPerHundredWords * 8)));
}

/**
 * Groq-powered grammar review of a speech transcript (tense, articles, agreement, etc.).
 * Returns null when Groq is down or the response cannot be parsed — caller should use regex fallback.
 */
export async function analyzeGrammarWithGroq(
  transcript: string,
): Promise<GrammarAnalysisResult | null> {
  const trimmed = transcript.trim();
  if (trimmed.length < 8) {
    return {
      errors: [],
      score: 75,
      summary: "Not enough speech to assess grammar reliably.",
      strengths: [],
    };
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  const prompt = `You are a professional English grammar coach analyzing a SPEECH transcript from automatic speech recognition (ASR).

The text usually has NO punctuation marks (no commas, semicolons, or periods). Only flag mistakes the speaker actually said — wrong words, tense, articles, agreement, prepositions.

Focus on:
- Tense errors (e.g. "I was go", "he have done", "we will went")
- Article errors (e.g. "I have meeting", "she is engineer", "I went to hospital")
- Subject-verb agreement (e.g. "he don't", "they was", "she have")
- Preposition errors (e.g. "working since 5 years", "good in English", "discuss about")
- Word choice errors (e.g. "could of", "should of", "make a research")

Do NOT flag or mention:
- Missing or wrong punctuation (semicolons, commas, periods, capitalization)
- "Independent clauses", "run-on sentences", or how to join clauses with punctuation
- Informal spoken style or contractions
- Filler words
- Incomplete sentences caused by natural speech patterns

Every "error" field MUST be an exact substring copied from the transcript (spoken words only).
Every "correction" MUST be spoken words the learner can say aloud — not punctuation edits.

Return JSON only with this exact shape:
{
  "errors": [
    {
      "error": "exact phrase from transcript that is wrong",
      "correction": "what it should be",
      "type": "tense",
      "explanation": "one sentence explaining the rule"
    }
  ],
  "strengths": ["one thing they did grammatically well"],
  "summary": "one sentence overall grammar assessment"
}

Use type exactly one of: tense, article, preposition, agreement, word_choice, other.

Transcript:
${trimmed.slice(0, 4000)}`;

  try {
    const parsed = await groqChatStructured({
      messages: [{ role: "user", content: prompt }],
      schema: grammarResponseSchema,
      maxTokens: 1200,
      temperature: 0.1,
      timeoutMs: getGroqCoachTimeoutMs(),
      normalize: normalizeGrammarPayload,
    });

    return finalizeSpokenGrammarAnalysis(
      {
        errors: parsed.errors,
        score: computeGrammarScore(parsed.errors.length, wordCount),
        summary: parsed.summary,
        strengths: parsed.strengths,
      },
      trimmed,
      wordCount,
      computeGrammarScore,
    );
  } catch (e) {
    console.error("[grammar-analysis] Groq failed:", e);
    return null;
  }
}
