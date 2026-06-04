import "server-only";
import type { GrammarAnalysisResult } from "@/lib/analysis/grammar-analysis";
import { filterSpokenGrammarErrors } from "@/lib/analysis/spoken-grammar-filter";
import type {
  AsrWordHint,
  BaselineAnalysis,
  GrammarErrorType,
  GrammarFlag,
  PronunciationTip,
} from "@/lib/assessment/baseline-analysis-types";

const GRAMMAR_RULES: { label: string; re: RegExp; suggestion: string }[] = [
  {
    label: "Non-standard phrase",
    re: /\bcould of\b/gi,
    suggestion: "Use “could have” (often spoken as “could’ve”), not “could of”.",
  },
  {
    label: "Non-standard phrase",
    re: /\bshould of\b/gi,
    suggestion: "Use “should have” (“should’ve”), not “should of”.",
  },
  {
    label: "Non-standard phrase",
    re: /\bwould of\b/gi,
    suggestion: "Use “would have” (“would’ve”), not “would of”.",
  },
  {
    label: "Spelling / usage",
    re: /\balot\b/gi,
    suggestion: "For “many”, write “a lot” (two words). “Alot” is not standard English.",
  },
  {
    label: "Agreement",
    re: /\btheir\s+is\b/gi,
    suggestion: "Use “there is” for existence, or rewrite possession: “they have a …” instead of “their is …”.",
  },
  {
    label: "Capitalization",
    re: /(^|[.!?]\s+)i\b(?=[\s'’.,;:!?]|$)/gm,
    suggestion: "Capitalize the pronoun “I”.",
  },
];

function stripPunctEdges(s: string): string {
  return s.replace(/^[\s"'“”‘’.,;:!?()[\]{}]+|[\s"'“”‘’.,;:!?()[\]{}]+$/g, "");
}

function pronunciationTipForWord(raw: string): string {
  const w = stripPunctEdges(raw);
  if (!w) return "Practice this chunk slowly with clear consonants.";
  return `“${w}” was less clear in this take — listen to a reference pronunciation, then say it slowly in two or three pieces before blending it into one smooth delivery.`;
}

function grammarErrorTypeLabel(type: GrammarErrorType): string {
  switch (type) {
    case "tense":
      return "Tense";
    case "article":
      return "Article";
    case "preposition":
      return "Preposition";
    case "agreement":
      return "Agreement";
    case "word_choice":
      return "Word choice";
    default:
      return "Grammar";
  }
}

/**
 * Legacy regex flags — used for UI display only ("Writing patterns to polish").
 * Grammar SCORE is computed from Groq analysis in grammar-analysis.ts when available.
 */
export function detectLegacyGrammarFlags(text: string): GrammarFlag[] {
  const grammarFlags: GrammarFlag[] = [];
  const seen = new Set<string>();

  for (const rule of GRAMMAR_RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(rule.re.source, rule.re.flags);
    while ((m = re.exec(text)) != null) {
      const excerpt = m[0].trim();
      const key = `${rule.label}:${excerpt}`;
      if (excerpt && !seen.has(key)) {
        seen.add(key);
        grammarFlags.push({
          label: rule.label,
          excerpt,
          suggestion: rule.suggestion,
          source: "legacy",
        });
      }
      if (!re.global) break;
    }
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  for (const s of sentences) {
    if (s.length > 220 && !/[.!?]/.test(s)) {
      const key = `runon:${s.slice(0, 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        grammarFlags.push({
          label: "Sentence length",
          excerpt: `${s.slice(0, 80)}${s.length > 80 ? "…" : ""}`,
          suggestion:
            "This block is one long spoken thought. Try pausing between ideas — two or three shorter phrases with a breath between each.",
          source: "legacy",
        });
      }
      break;
    }
  }

  return grammarFlags;
}

function groqErrorsToFlags(analysis: GrammarAnalysisResult, transcript: string): GrammarFlag[] {
  return filterSpokenGrammarErrors(analysis.errors, transcript).map((e) => ({
    label: grammarErrorTypeLabel(e.type),
    excerpt: e.error,
    correction: e.correction,
    suggestion: e.explanation,
    errorType: e.type,
    source: "groq" as const,
  }));
}

function mergeGrammarFlags(legacy: GrammarFlag[], groq: GrammarFlag[]): GrammarFlag[] {
  const merged = [...legacy];
  const seen = new Set(legacy.map((f) => `${f.excerpt.toLowerCase()}|${f.suggestion}`));
  for (const flag of groq) {
    const key = `${flag.excerpt.toLowerCase()}|${flag.suggestion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(flag);
  }
  return merged.slice(0, 20);
}

/**
 * Heuristic grammar flags + ASR-confidence pronunciation hints (not clinical phonetic analysis).
 * When Groq grammar analysis is available, merges those errors into the display list.
 */
export function analyzeTranscriptDeep(
  text: string,
  asrWordHints?: AsrWordHint[],
  grammarAnalysis?: GrammarAnalysisResult | null,
): BaselineAnalysis {
  const legacyGrammarFlags = detectLegacyGrammarFlags(text);
  const groqGrammarFlags = grammarAnalysis ? groqErrorsToFlags(grammarAnalysis, text) : [];
  const grammarFlags = mergeGrammarFlags(legacyGrammarFlags, groqGrammarFlags);

  const pronunciationTips: PronunciationTip[] = [];
  const hints = asrWordHints ?? [];
  const sorted = [...hints].sort((a, b) => a.probability - b.probability);
  for (const h of sorted) {
    const core = stripPunctEdges(h.token).replace(/[^a-zA-Z'-]/g, "");
    if (core.length < 3) continue;
    if (h.probability >= 0.42) continue;
    if (pronunciationTips.length >= 18) break;
    const dup = pronunciationTips.some((p) => p.heardAs.toLowerCase() === h.token.toLowerCase());
    if (dup) continue;
    pronunciationTips.push({
      heardAs: h.token.trim(),
      confidence: Math.round(h.probability * 1000) / 1000,
      tip: pronunciationTipForWord(h.token),
    });
  }

  return {
    grammarFlags,
    pronunciationTips,
    grammarAnalysis: grammarAnalysis
      ? {
          errors: filterSpokenGrammarErrors(grammarAnalysis.errors, text),
          score: grammarAnalysis.score,
          summary: grammarAnalysis.summary,
          strengths: grammarAnalysis.strengths,
        }
      : undefined,
  };
}
