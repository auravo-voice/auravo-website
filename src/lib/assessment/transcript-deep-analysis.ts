import "server-only";
import type { AsrWordHint, BaselineAnalysis, GrammarFlag, PronunciationTip } from "@/lib/assessment/baseline-analysis-types";

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
    label: "Punctuation",
    re: /[.!?][A-Za-z]/g,
    suggestion: "Add a space after sentence-ending punctuation before the next word.",
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

/**
 * Heuristic grammar flags + ASR-confidence pronunciation hints (not clinical phonetic analysis).
 */
export function analyzeTranscriptDeep(text: string, asrWordHints?: AsrWordHint[]): BaselineAnalysis {
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
        grammarFlags.push({ label: rule.label, excerpt, suggestion: rule.suggestion });
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
            "This block reads like a very long run-on. Try splitting into two or three shorter sentences with periods, then read aloud with a breath between each.",
        });
      }
      break;
    }
  }

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

  return { grammarFlags: grammarFlags.slice(0, 14), pronunciationTips };
}
