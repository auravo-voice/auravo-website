/** Shared vocabulary types/constants — safe for client components (no `server-only`). */

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

/** Cap word-choice rephrases so grammar/pronunciation stay the main focus. */
export const MAX_VOCABULARY_SUGGESTIONS = 4;
