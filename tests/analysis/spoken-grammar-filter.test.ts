import { describe, expect, it } from "vitest";
import {
  correctionOnlyAddsPunctuation,
  filterSpokenGrammarErrors,
  finalizeSpokenGrammarAnalysis,
  isPunctuationCentricFeedback,
} from "@/lib/analysis/spoken-grammar-filter";

describe("spoken-grammar-filter", () => {
  it("drops punctuation-centric Groq feedback", () => {
    const errors = filterSpokenGrammarErrors(
      [
        {
          error: "I went home and I ate",
          correction: "I went home; I ate",
          type: "other",
          explanation:
            "A semicolon is needed to separate the two independent clauses in this sentence.",
        },
        {
          error: "he don't",
          correction: "he doesn't",
          type: "agreement",
          explanation: "Third-person singular needs doesn't.",
        },
      ],
      "yesterday he don't know I went home and I ate dinner",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.error).toBe("he don't");
  });

  it("detects punctuation-only corrections", () => {
    expect(correctionOnlyAddsPunctuation("hello world", "hello, world")).toBe(true);
    expect(correctionOnlyAddsPunctuation("he don't", "he doesn't")).toBe(false);
    expect(
      isPunctuationCentricFeedback({
        error: "a b",
        correction: "a; b",
        type: "other",
        explanation: "Use a semicolon between clauses.",
      }),
    ).toBe(true);
  });

  it("replaces punctuation-only summaries", () => {
    const out = finalizeSpokenGrammarAnalysis(
      {
        errors: [],
        score: 50,
        summary:
          "A semicolon is needed to separate the two independent clauses in this sentence.",
        strengths: ["Good use of commas between items"],
      },
      "I went home and I ate",
      6,
      () => 88,
    );
    expect(out.summary).not.toMatch(/semicolon/i);
    expect(out.score).toBe(88);
    expect(out.strengths).toHaveLength(0);
  });
});
