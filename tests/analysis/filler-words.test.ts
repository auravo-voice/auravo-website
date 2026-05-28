import { describe, expect, it } from "vitest";
import { countFillerWords } from "@/lib/analysis/filler-words";
import { computeDerivedMetrics } from "@/lib/analysis/derive";

describe("countFillerWords", () => {
  it("counts stretched um/uh tokens", () => {
    expect(countFillerWords({ transcript: "umm yeah uhhh okay" })).toBeGreaterThanOrEqual(3);
  });

  it("counts multi-word phrases once", () => {
    expect(countFillerWords({ transcript: "you know I mean kind of" })).toBe(3);
  });

  it("uses word timings when um is tokenized separately", () => {
    const n = countFillerWords({
      transcript: "I think it will work",
      wordTimings: [
        { word: "Um", start: 0, end: 0.2, probability: 0.9 },
        { word: "I", start: 0.5, end: 0.6, probability: 0.95 },
        { word: "think", start: 0.6, end: 0.8, probability: 0.95 },
        { word: "it", start: 0.8, end: 0.9, probability: 0.95 },
        { word: "will", start: 0.9, end: 1.0, probability: 0.95 },
        { word: "work", start: 1.0, end: 1.2, probability: 0.95 },
      ],
    });
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it("does not count mid-sentence so when gap is short", () => {
    const n = countFillerWords({
      transcript: "I was so tired",
      wordTimings: [
        { word: "I", start: 0, end: 0.1, probability: 0.9 },
        { word: "was", start: 0.15, end: 0.25, probability: 0.9 },
        { word: "so", start: 0.3, end: 0.4, probability: 0.9 },
        { word: "tired", start: 0.45, end: 0.6, probability: 0.9 },
      ],
    });
    expect(n).toBe(0);
  });

  it("counts sentence-initial so after a pause", () => {
    const n = countFillerWords({
      transcript: "So here is the plan",
      wordTimings: [
        { word: "So", start: 0, end: 0.2, probability: 0.9 },
        { word: "here", start: 0.8, end: 1.0, probability: 0.9 },
        { word: "is", start: 1.0, end: 1.1, probability: 0.9 },
        { word: "the", start: 1.1, end: 1.2, probability: 0.9 },
        { word: "plan", start: 1.2, end: 1.5, probability: 0.9 },
      ],
    });
    expect(n).toBeGreaterThanOrEqual(1);
  });
});

describe("computeDerivedMetrics filler integration", () => {
  it("penalises filler-heavy speech", () => {
    const d = computeDerivedMetrics({
      transcript: "um like you know basically uh so like actually um",
      durationSec: 8,
    });
    expect(d.fillerCount).toBeGreaterThanOrEqual(5);
  });
});
