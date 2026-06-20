import { describe, expect, it } from "vitest";

import {
  analysisJsonWithQuickAnalysisDisplay,
  parseQuickAnalysisDisplaySnapshot,
  quickAnalysisDisplayFromPersistedJson,
} from "@/lib/quick-analysis/display-snapshot";

describe("quickAnalysisDisplaySnapshot", () => {
  const display = {
    version: 1 as const,
    scores: {
      pronunciation: 80,
      grammar: 70,
      fluency: 75,
      vocabulary: 85,
      filler_words: 72,
      pacing: 78,
    },
    transcriptSegments: [
      {
        label: "About yourself",
        transcript: "I live in Bangalore.",
        wordConfidences: [{ word: "Bangalore", confidence: 0.5, start: 0.2, end: 0.8 }],
      },
    ],
    phoneticMap: { Bangalore: "BANG-guh-lohr" },
    pronunciationHighlightSource: "groq" as const,
    coachSummary: {
      biggestIssue: "Trailing off mid-sentence",
      strength: "Clear enthusiasm",
      patterns: [],
      acousticPatterns: [],
      vocabularySuggestions: [],
    },
    grammar: {
      summary: "Mostly clear spoken grammar with a couple of tense slips.",
      strengths: ["Articles used correctly throughout."],
      flags: [
        {
          label: "Grammar",
          excerpt: "I am living in Bagla right now",
          correction: "I live in Bangalore right now",
          suggestion: "Use simple present for where you live now.",
          errorType: "tense",
          source: "groq",
        },
      ],
    },
  };

  it("round-trips wordConfidences through analysis_json", () => {
    const withWords = {
      ...display,
      wordConfidences: [{ word: "Bangalore", confidence: 0.5, start: 0.2, end: 0.8 }],
    };
    const merged = analysisJsonWithQuickAnalysisDisplay('{"coachSummary":{}}', withWords);
    const loaded = quickAnalysisDisplayFromPersistedJson(merged);
    expect(loaded?.wordConfidences).toEqual(withWords.wordConfidences);
  });

  it("round-trips through analysis_json", () => {
    const merged = analysisJsonWithQuickAnalysisDisplay('{"coachSummary":{}}', display);
    const loaded = quickAnalysisDisplayFromPersistedJson(merged);
    expect(loaded).toEqual(display);
  });

  it("rejects invalid version", () => {
    expect(parseQuickAnalysisDisplaySnapshot({ version: 2, scores: display.scores })).toBeNull();
  });
});
