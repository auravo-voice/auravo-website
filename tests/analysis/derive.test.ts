import { describe, expect, it } from "vitest";
import { computeDerivedMetrics, MIN_PAUSE_MS, LONG_PAUSE_MS } from "@/lib/analysis/derive";
import type { WordTiming } from "@/lib/transcription/types";

function evenly(words: string[], wpm: number, startSec = 0): WordTiming[] {
  const gap = 60 / wpm; // seconds per word with zero pause
  const out: WordTiming[] = [];
  let t = startSec;
  for (const w of words) {
    const dur = gap * 0.7;
    out.push({ word: w, start: t, end: t + dur, probability: 0.92 });
    t += gap;
  }
  return out;
}

describe("computeDerivedMetrics — filler detection", () => {
  it("counts inline um/uh/like even when adjacent to other words", () => {
    const m = computeDerivedMetrics({
      transcript: "Um, so basically I, like, kind of think it's actually fine. You know?",
    });
    // "um", "so basically", "like", "kind of", "actually", "you know" → 6 fillers
    expect(m.fillerCount).toBe(6);
  });

  it("returns 0 fillers on a clean transcript", () => {
    const m = computeDerivedMetrics({
      transcript: "I disagree because the trade-offs differ for remote workers. Here is why.",
    });
    expect(m.fillerCount).toBe(0);
  });
});

describe("computeDerivedMetrics — WPM", () => {
  it("computes WPM from word timings and duration", () => {
    const words = ["the", "quick", "brown", "fox", "jumps", "over", "ten", "lazy", "dogs"];
    // 9 words in 4.5 seconds → 120 WPM
    const timings = evenly(words, 120);
    const m = computeDerivedMetrics({
      transcript: words.join(" "),
      wordTimings: timings,
      durationSec: 60 / 120 * words.length,
    });
    expect(m.wpm).not.toBeNull();
    expect(Math.round(m.wpm!)).toBe(120);
  });

  it("returns null WPM when no timings are provided", () => {
    const m = computeDerivedMetrics({ transcript: "Sample text without timings." });
    expect(m.wpm).toBeNull();
    expect(m.pauseCount).toBeNull();
  });
});

describe("computeDerivedMetrics — pause math", () => {
  it("counts pauses ≥ MIN_PAUSE_MS but not shorter gaps", () => {
    const timings: WordTiming[] = [
      { word: "ok", start: 0, end: 0.3, probability: 0.95 },
      // gap of MIN_PAUSE_MS - 50 (shouldn't count)
      { word: "go", start: 0.3 + (MIN_PAUSE_MS - 50) / 1000, end: 0.7, probability: 0.95 },
      // gap of MIN_PAUSE_MS + 100 (counts)
      { word: "now", start: 0.7 + (MIN_PAUSE_MS + 100) / 1000, end: 1.1, probability: 0.95 },
      // long pause: end=1.1, next.start = 1.1 + LONG_PAUSE_MS+50 / 1000
      {
        word: "wait",
        start: 1.1 + (LONG_PAUSE_MS + 50) / 1000,
        end: 1.1 + (LONG_PAUSE_MS + 50) / 1000 + 0.3,
        probability: 0.95,
      },
    ];
    const m = computeDerivedMetrics({
      transcript: "ok go now wait",
      wordTimings: timings,
      durationSec: timings[timings.length - 1]!.end,
    });
    expect(m.pauseCount).toBe(2);
    expect(m.longPauseCount).toBe(1);
    expect(m.avgPauseMs).toBeGreaterThan(0);
  });
});

describe("computeDerivedMetrics — restarts and repeats", () => {
  it("catches duplicated short words", () => {
    const m = computeDerivedMetrics({ transcript: "the the meeting is at three" });
    expect(m.repeatedWordCount).toBeGreaterThan(0);
  });

  it("catches dash-style restarts", () => {
    const m = computeDerivedMetrics({ transcript: "I— I think it's important." });
    expect(m.restartCount).toBeGreaterThan(0);
  });
});
