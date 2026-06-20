import { describe, expect, it } from "vitest";

import { displayWordConfidencesWithPolishedTranscript } from "@/app/quick-analysis/lib/polished-word-display";

describe("displayWordConfidencesWithPolishedTranscript", () => {
  it("applies polished spellings when word counts match", () => {
    const wordConfidences = [
      { word: "i", confidence: 0.95, start: 0, end: 0.1 },
      { word: " live", confidence: 0.9, start: 0.1, end: 0.3 },
      { word: " in", confidence: 0.92, start: 0.3, end: 0.4 },
      { word: " bangalore", confidence: 0.5, start: 0.4, end: 0.8 },
    ];
    const polished = "I live in Bangalore.";
    const out = displayWordConfidencesWithPolishedTranscript(wordConfidences, polished);
    expect(out[0]?.word).toBe("I");
    expect(out[1]?.word).toBe(" live");
    expect(out[3]?.word).toBe(" Bangalore.");
  });

  it("keeps whisper tokens when polish changes word count", () => {
    const wordConfidences = [{ word: "hello", confidence: 0.9, start: 0, end: 0.2 }];
    const out = displayWordConfidencesWithPolishedTranscript(wordConfidences, "Hello there.");
    expect(out).toEqual(wordConfidences);
  });
});
