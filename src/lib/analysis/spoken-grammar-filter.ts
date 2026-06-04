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
