export type SpokenGrammarError = {
  error: string;
  correction: string;
  explanation: string;
  type: string;
};

export type SpokenGrammarAnalysis = {
  errors: SpokenGrammarError[];
  score: number;
  summary: string;
  strengths: string[];
};

/** Writing-only feedback that does not apply to speech-to-text transcripts. */
const PUNCTUATION_CENTRIC_RE =
  /\b(semicolons?|commas?|periods?|full stops?|colons?|apostrophes?|hyphens?|en dashes?|em dashes?|quotation marks?|punctuation|capitaliz(e|ing|ation)|independent clauses?|dependent clauses?|run-on sentences?)\b/i;

const CLAUSE_SEPARATION_RE =
  /\b(separate|join|connect)\s+(the\s+)?(two\s+)?(independent\s+)?clauses?\b/i;

function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Expand common contractions so "it is" and "it's" compare equal. */
export function expandSpokenContractions(s: string): string {
  return normalizePhrase(s)
    .replace(/\b(i)'m\b/g, "$1 am")
    .replace(/\b(you|we|they)'re\b/g, "$1 are")
    .replace(/\b(he|she|it)'s\b/g, "$1 is")
    .replace(/\b(i|you|we|they)'ve\b/g, "$1 have")
    .replace(/\b(he|she|it)'s\b/g, "$1 has") // after is — rare; leave as is-expansion first
    .replace(/\b(i|you|he|she|it|we|they)'d\b/g, "$1 would")
    .replace(/\b(i|you|he|she|it|we|they)'ll\b/g, "$1 will")
    .replace(/\b(do|does|did|is|are|was|were|has|have|had|would|could|should|must|can)n't\b/g, "$1 not")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bain't\b/g, "is not")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the only difference is contraction ↔ full form (both grammatically fine).
 * e.g. "it is" → "it's", "do not" → "don't"
 */
export function isContractionOnlyStyleChange(error: string, correction: string): boolean {
  const a = expandSpokenContractions(error);
  const b = expandSpokenContractions(correction);
  if (!a || !b || a !== b) return false;
  // Must actually differ in surface form (otherwise not a "change")
  return normalizePhrase(error) !== normalizePhrase(correction);
}

/** True when correction changes only punctuation/spacing around the same words. */
export function correctionOnlyAddsPunctuation(error: string, correction: string): boolean {
  const a = normalizePhrase(error);
  const b = normalizePhrase(correction);
  return a.length > 0 && a === b;
}

export function isPunctuationCentricFeedback(error: SpokenGrammarError): boolean {
  const blob = `${error.explanation} ${error.correction}`;
  if (correctionOnlyAddsPunctuation(error.error, error.correction)) return true;
  if (PUNCTUATION_CENTRIC_RE.test(blob) || CLAUSE_SEPARATION_RE.test(blob)) return true;
  return false;
}

export function phraseAppearsInTranscript(phrase: string, transcript: string): boolean {
  const p = normalizePhrase(phrase);
  if (p.length < 2) return false;
  const t = normalizePhrase(transcript);
  if (t.includes(p)) return true;
  const words = p.split(" ").filter(Boolean);
  if (words.length < 2) return t.split(" ").includes(words[0]!);
  const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"));
  return re.test(t);
}

export function filterSpokenGrammarErrors<T extends SpokenGrammarError>(
  errors: T[],
  transcript: string,
): T[] {
  return errors.filter((e) => {
    if (isPunctuationCentricFeedback(e)) return false;
    if (isContractionOnlyStyleChange(e.error, e.correction)) return false;
    if (!phraseAppearsInTranscript(e.error, transcript)) return false;
    return true;
  });
}

function summaryIsPunctuationOnly(summary: string): boolean {
  return PUNCTUATION_CENTRIC_RE.test(summary) || CLAUSE_SEPARATION_RE.test(summary);
}

export function filterSpokenGrammarStrengths(strengths: string[]): string[] {
  return strengths.filter((s) => !summaryIsPunctuationOnly(s));
}

export function finalizeSpokenGrammarAnalysis<T extends SpokenGrammarAnalysis>(
  result: T,
  transcript: string,
  wordCount: number,
  computeScore: (errorCount: number, words: number) => number,
): T {
  const errors = filterSpokenGrammarErrors(result.errors, transcript);
  const strengths = filterSpokenGrammarStrengths(result.strengths);
  let summary = result.summary;
  if (summaryIsPunctuationOnly(summary)) {
    summary =
      errors.length > 0
        ? `Found ${errors.length} spoken grammar pattern${errors.length === 1 ? "" : "s"} to polish.`
        : "No major spoken-grammar issues stood out in this transcript.";
  }
  return {
    ...result,
    errors,
    strengths,
    summary,
    score: computeScore(errors.length, wordCount),
  };
}
