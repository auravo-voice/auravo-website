import { describe, expect, it } from "vitest";
import { mergeSegmentTranscriptions } from "@/lib/assessment/merge-segment-transcriptions";

describe("mergeSegmentTranscriptions", () => {
  it("returns null when any segment lacks text or word timings", () => {
    expect(
      mergeSegmentTranscriptions([
        { text: "hello", durationMs: 1000, meta: { wordTimings: [{ word: "hello", start: 0, end: 0.5, probability: 0.9 }] } },
        { text: "", durationMs: 1000, meta: { wordTimings: [{ word: "world", start: 0, end: 0.5, probability: 0.9 }] } },
      ]),
    ).toBeNull();
    expect(
      mergeSegmentTranscriptions([
        { text: "hello", durationMs: 1000, meta: null },
      ]),
    ).toBeNull();
  });

  it("offsets word timings by prior segment durationMs", () => {
    const merged = mergeSegmentTranscriptions([
      {
        text: "one two",
        durationMs: 2000,
        meta: {
          wordTimings: [
            { word: "one", start: 0, end: 0.4, probability: 0.9 },
            { word: "two", start: 0.5, end: 0.9, probability: 0.9 },
          ],
        },
      },
      {
        text: "three",
        durationMs: 1000,
        meta: {
          wordTimings: [{ word: "three", start: 0.1, end: 0.6, probability: 0.8 }],
        },
      },
    ]);
    expect(merged?.text).toBe("one two\n\nthree");
    expect(merged?.wordTimings).toEqual([
      { word: "one", start: 0, end: 0.4, probability: 0.9 },
      { word: "two", start: 0.5, end: 0.9, probability: 0.9 },
      { word: "three", start: 2.1, end: 2.6, probability: 0.8 },
    ]);
    expect(merged?.durationSec).toBe(3);
  });
});
