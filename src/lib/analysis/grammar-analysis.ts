import "server-only";

import { z } from "zod";
import { getGroqApiKey, getGroqCoachTimeoutMs, getGroqModel } from "@/lib/groq/env";

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

const grammarErrorSchema = z.object({
  error: z.string().min(1),
  correction: z.string().min(1),
  type: z.enum(["tense", "article", "preposition", "agreement", "word_choice", "other"]),
  explanation: z.string().min(1),
});

const grammarResponseSchema = z.object({
  errors: z.array(grammarErrorSchema).default([]),
  strengths: z.array(z.string()).default([]),
  summary: z.string().default(""),
});

function extractJsonBlock(raw: string): string {
  const t = raw.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) return t.slice(start, end + 1);
  return t;
}

function computeGrammarScore(errorCount: number, wordCount: number): number {
  if (wordCount < 1) return 75;
  const errorsPerHundredWords = (errorCount / wordCount) * 100;
  return Math.max(0, Math.min(100, Math.round(100 - errorsPerHundredWords * 8)));
}

export const EMPTY_GRAMMAR_ANALYSIS: GrammarAnalysisResult = {
  errors: [],
  score: 75,
  summary: "Grammar analysis unavailable.",
  strengths: [],
};

/**
 * Groq-powered grammar review of a speech transcript (tense, articles, agreement, etc.).
 */
export async function analyzeGrammarWithGroq(transcript: string): Promise<GrammarAnalysisResult> {
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

  const prompt = `You are a professional English grammar coach analyzing a speech transcript.

Identify ALL grammar errors in this transcript. Focus on:
- Tense errors (e.g. "I was go", "he have done", "we will went")
- Article errors (e.g. "I have meeting", "she is engineer", "I went to hospital")
- Subject-verb agreement (e.g. "he don't", "they was", "she have")
- Preposition errors (e.g. "working since 5 years", "good in English", "discuss about")
- Word choice errors (e.g. "could of", "should of", "make a research")

Do NOT flag:
- Informal spoken style or contractions
- Filler words
- Incomplete sentences caused by natural speech patterns

Return JSON only, no preamble, no markdown:
{
  "errors": [
    {
      "error": "exact phrase from transcript that is wrong",
      "correction": "what it should be",
      "type": "tense|article|preposition|agreement|word_choice|other",
      "explanation": "one sentence explaining the rule"
    }
  ],
  "strengths": ["one thing they did grammatically well", "another strength if present"],
  "summary": "one sentence overall grammar assessment"
}

Transcript:
${trimmed.slice(0, 4000)}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getGroqApiKey()}`,
    },
    body: JSON.stringify({
      model: getGroqModel(),
      max_tokens: 1000,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(getGroqCoachTimeoutMs()),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Groq grammar analysis failed: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = grammarResponseSchema.parse(JSON.parse(extractJsonBlock(text)));
    const errorCount = parsed.errors.length;
    return {
      errors: parsed.errors,
      score: computeGrammarScore(errorCount, wordCount),
      summary: parsed.summary,
      strengths: parsed.strengths,
    };
  } catch (e) {
    console.error("Failed to parse Groq grammar response:", text.slice(0, 500), e);
    return EMPTY_GRAMMAR_ANALYSIS;
  }
}
