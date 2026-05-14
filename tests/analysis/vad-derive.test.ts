import { describe, expect, it } from "vitest";
import { computeDerivedMetrics } from "@/lib/analysis/derive";
import type { VadFeatures } from "@/lib/audio/vad";

describe("computeDerivedMetrics — VAD-grounded pauses", () => {
  it("falls back to word-gap heuristics when VAD is unavailable", () => {
    const wordTimings = [
      { word: "Hello", start: 0.2, end: 0.6, probability: 0.95 },
      { word: "world", start: 0.8, end: 1.3, probability: 0.93 },
      { word: "again", start: 3.5, end: 3.9, probability: 0.9 }, // 2.2s gap before this
    ];
    const m = computeDerivedMetrics({
      transcript: "Hello world. Again.",
      wordTimings,
      durationSec: 4.0,
    });
    expect(m.vadProvider).toBeNull();
    expect(m.pauseCount).toBeGreaterThanOrEqual(1);
    expect(m.longestPauseMs).toBeNull(); // only filled when VAD is present
  });

  it("uses VAD output to override pause stats and exposes longestPauseMs", () => {
    const vad: VadFeatures = {
      provider: "silero",
      sampleRateHz: 16000,
      durationSec: 12,
      speakingSec: 8,
      silenceSec: 4,
      speakingRatio: 8 / 12,
      voicedSegments: [
        { start: 0.5, end: 3.0 }, // 2.5s of speech
        { start: 4.5, end: 8.0 }, // 1.5s pause → counted
        { start: 9.5, end: 12.0 }, // 1.5s pause → counted, also long
      ],
    };
    const m = computeDerivedMetrics({
      transcript: "alpha beta gamma delta epsilon",
      wordTimings: [
        { word: "alpha", start: 0.6, end: 1.0, probability: 0.95 },
        { word: "beta", start: 1.2, end: 1.6, probability: 0.95 },
        { word: "gamma", start: 5.0, end: 5.4, probability: 0.95 },
        { word: "delta", start: 6.8, end: 7.4, probability: 0.95 },
        { word: "epsilon", start: 10.5, end: 11.2, probability: 0.95 },
      ],
      durationSec: 12,
      vad,
    });
    expect(m.vadProvider).toBe("silero");
    expect(m.pauseCount).toBe(2);
    expect(m.longPauseCount).toBe(2);
    expect(m.longestPauseMs).toBeGreaterThanOrEqual(1500);
    expect(m.preSpeechSilenceMs).toBe(500);
    expect(m.speakingRatio).toBeCloseTo(8 / 12, 2);
  });

  it("handles an all-silence VAD result without crashing", () => {
    const vad: VadFeatures = {
      provider: "webrtcvad",
      sampleRateHz: 16000,
      durationSec: 5,
      speakingSec: 0,
      silenceSec: 5,
      speakingRatio: 0,
      voicedSegments: [],
    };
    const m = computeDerivedMetrics({ transcript: "", durationSec: 5, vad });
    expect(m.pauseCount).toBe(0);
    expect(m.preSpeechSilenceMs).toBe(5000);
  });
});
