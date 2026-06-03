export type GrammarErrorType =
  | "tense"
  | "article"
  | "preposition"
  | "agreement"
  | "word_choice"
  | "other";

export type GrammarFlag = {
  label: string;
  excerpt: string;
  suggestion: string;
  /** Groq-detected correction when available. */
  correction?: string;
  errorType?: GrammarErrorType;
  source?: "legacy" | "groq";
};

export type GrammarAnalysisSnapshot = {
  errors: {
    error: string;
    correction: string;
    type: GrammarErrorType;
    explanation: string;
  }[];
  score: number | null;
  summary: string | null;
  strengths: string[];
};

export type PronunciationTip = {
  heardAs: string;
  confidence: number;
  tip: string;
};

export type BaselineAnalysis = {
  grammarFlags: GrammarFlag[];
  pronunciationTips: PronunciationTip[];
  grammarAnalysis?: GrammarAnalysisSnapshot;
};

export type AsrWordHint = { token: string; probability: number };
