import { describe, expect, it } from "vitest";

import {
  distributeWordConfidencesToSegments,
  ensureSegmentWordHighlights,
} from "@/lib/quick-analysis/word-confidences";

describe("distributeWordConfidencesToSegments", () => {
  it("fills missing per-segment confidences from the full session list", () => {
    const allWords = [
      { word: "I", confidence: 0.95, start: 0, end: 0.1 },
      { word: " love", confidence: 0.4, start: 0.1, end: 0.3 },
      { word: " and", confidence: 0.5, start: 0.3, end: 0.4 },
      { word: " bang", confidence: 0.35, start: 0.4, end: 0.6 },
    ];
    const segments = distributeWordConfidencesToSegments(
      [
        { label: "Q1", transcript: "I love and bang", wordConfidences: [] },
      ],
      allWords,
    );
    expect(segments[0]?.wordConfidences).toHaveLength(4);
    expect(segments[0]?.wordConfidences[3]?.confidence).toBe(0.35);
  });

  it("force re-slices after polish when word counts still align", () => {
    const allWords = [
      { word: "I", confidence: 0.95, start: 0, end: 0.1 },
      { word: " love", confidence: 0.4, start: 0.1, end: 0.3 },
      { word: " it.", confidence: 0.88, start: 0.3, end: 0.5 },
    ];
    const segments = distributeWordConfidencesToSegments(
      [{ label: "Q1", transcript: "I love it.", wordConfidences: [] }],
      allWords,
      { force: true },
    );
    expect(segments[0]?.wordConfidences).toHaveLength(3);
  });

  it("does not wipe per-segment confidences when the global list is empty", () => {
    const existing = [
      { word: "hello", confidence: 0.9, start: 0, end: 0.2 },
    ];
    const segments = distributeWordConfidencesToSegments(
      [{ label: "Q1", transcript: "hello", wordConfidences: existing }],
      [],
      { force: true },
    );
    expect(segments[0]?.wordConfidences).toEqual(existing);
  });
});

describe("ensureSegmentWordHighlights", () => {
  it("fills only segments missing word confidences", () => {
    const allWords = [
      { word: "I", confidence: 0.95, start: 0, end: 0.1 },
      { word: " live", confidence: 0.4, start: 0.1, end: 0.3 },
      { word: " here.", confidence: 0.88, start: 0.3, end: 0.5 },
      { word: "Nice", confidence: 0.7, start: 0.5, end: 0.7 },
      { word: " city.", confidence: 0.55, start: 0.7, end: 0.9 },
    ];
    const segments = ensureSegmentWordHighlights(
      [
        {
          label: "Q1",
          transcript: "I live here.",
          wordConfidences: [
            { word: "I", confidence: 0.95, start: 0, end: 0.1 },
            { word: " live", confidence: 0.4, start: 0.1, end: 0.3 },
            { word: " here.", confidence: 0.88, start: 0.3, end: 0.5 },
          ],
        },
        { label: "Q2", transcript: "Nice city.", wordConfidences: [] },
      ],
      allWords,
    );
    expect(segments[0]?.wordConfidences).toHaveLength(3);
    expect(segments[1]?.wordConfidences).toHaveLength(2);
    expect(segments[1]?.wordConfidences[1]?.confidence).toBe(0.55);
  });
});
