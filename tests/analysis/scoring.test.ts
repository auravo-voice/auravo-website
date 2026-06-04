import { describe, expect, it } from "vitest";
import {
  scorePace,
  scoreFluency,
  scoreClarity,
  scoreConfidence,
  scorePronunciationApprox,
  scoreGrammar,
  scoresFromAnalysis,
} from "@/lib/analysis/scoring";
import { computeDerivedMetrics } from "@/lib/analysis/derive";
import type { WordTiming } from "@/lib/transcription/types";
import type { AcousticFeatures } from "@/lib/audio/acoustic";

function timings(wpm: number, n: number): WordTiming[] {
  const gap = 60 / wpm;
  const out: WordTiming[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ word: `w${i}`, start: i * gap, end: i * gap + gap * 0.7, probability: 0.9 });
  }
  return out;
}

const SAMPLE_ACOUSTIC: AcousticFeatures = {
  pitch: { mean: 145, range: 85, isMonotone: false, timeline: [] },
  intensity: { mean: 65, collapseSegments: [] },
  rhythm: { tempoVariation: 120, clarityScore: 18 },
};

describe("scorePace", () => {
  it("returns a high score at the target WPM band", () => {
    const d = computeDerivedMetrics({
      transcript: "alpha beta gamma delta epsilon zeta eta",
      wordTimings: timings(150, 200),
      durationSec: (200 * 60) / 150,
    });
    const r = scorePace(d);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.qualityFlag).toBe("audio_grounded");
    expect(r.explanation.toLowerCase()).toContain("wpm");
  });

  it("penalises very fast speech", () => {
    const d = computeDerivedMetrics({
      transcript: "fast",
      wordTimings: timings(230, 200),
      durationSec: (200 * 60) / 230,
    });
    const r = scorePace(d);
    expect(r.score).toBeLessThan(80);
    expect(r.explanation.toLowerCase()).toContain("faster");
  });

  it("falls back gracefully without timings", () => {
    const d = computeDerivedMetrics({ transcript: "no timings here." });
    const r = scorePace(d);
    expect(r.qualityFlag).toBe("transcript_only");
    expect(r.score).toBeGreaterThanOrEqual(40);
  });

  it("penalises energy collapse segments", () => {
    const acoustic: AcousticFeatures = {
      ...SAMPLE_ACOUSTIC,
      intensity: {
        mean: 60,
        collapseSegments: [
          { start: 1, end: 2 },
          { start: 2.5, end: 3.5 },
          { start: 4, end: 5 },
          { start: 5.5, end: 6.5 },
        ],
      },
    };
    const d = computeDerivedMetrics({
      transcript: "one two three four five six seven eight nine ten eleven twelve",
      wordTimings: timings(150, 12),
      durationSec: 10,
      acoustic,
    });
    const withCollapse = scorePace(d, acoustic);
    const without = scorePace(d, null);
    expect(withCollapse.score).toBeLessThanOrEqual(without.score);
    expect(withCollapse.explanation.toLowerCase()).toContain("noticeable");
  });
});

describe("scoreFluency", () => {
  it("rewards clean transcripts with no long pauses or fillers", () => {
    const d = computeDerivedMetrics({
      transcript: "I think the new approach will work well for our team.",
      wordTimings: timings(150, 11),
      durationSec: 60 / 150 * 11,
    });
    const r = scoreFluency(d);
    expect(r.score).toBeGreaterThan(70);
  });

  it("penalises filler-heavy speech", () => {
    const d = computeDerivedMetrics({
      transcript: "um like you know basically uh so like actually um",
      wordTimings: timings(140, 10),
      durationSec: (10 * 60) / 140,
    });
    const r = scoreFluency(d);
    expect(r.score).toBeLessThan(60);
  });
});

describe("scoreClarity", () => {
  it("uses acoustic features when available", () => {
    const d = computeDerivedMetrics({
      transcript: "test",
      acoustic: SAMPLE_ACOUSTIC,
      durationSec: 5,
    });
    const r = scoreClarity(d, SAMPLE_ACOUSTIC);
    expect(r.qualityFlag).toBe("audio_grounded");
  });

  it("notes the transcript-only fallback when acoustic is absent", () => {
    const d = computeDerivedMetrics({ transcript: "test" });
    const r = scoreClarity(d, null);
    expect(r.qualityFlag).toBe("transcript_only");
    expect(r.explanation.toLowerCase()).toContain("acoustic");
  });
});

describe("scoreConfidence", () => {
  it("uses stable loudness when acoustic features present", () => {
    const stable: AcousticFeatures = {
      ...SAMPLE_ACOUSTIC,
      intensity: { mean: 70, collapseSegments: [] },
    };
    const d = computeDerivedMetrics({ transcript: "hello world.", acoustic: stable, durationSec: 5 });
    const r = scoreConfidence(d, stable);
    expect(r.qualityFlag).toBe("audio_grounded");
    expect(r.score).toBeGreaterThan(60);
  });

  it("falls back to transcript-only with disclaimer", () => {
    const d = computeDerivedMetrics({ transcript: "hello world." });
    const r = scoreConfidence(d, null);
    expect(r.qualityFlag).toBe("transcript_only");
  });
});

describe("scorePronunciationApprox", () => {
  it("marks the score as approximate when only Whisper confidence is available", () => {
    const wt: WordTiming[] = timings(150, 20).map((w, i) => ({
      ...w,
      probability: i % 5 === 0 ? 0.4 : 0.85,
    }));
    const d = computeDerivedMetrics({
      transcript: "twenty word transcript",
      wordTimings: wt,
      durationSec: (20 * 60) / 150,
    });
    const r = scorePronunciationApprox(d, null);
    expect(r.qualityFlag).toBe("approximate");
  });

  it("upgrades to audio_grounded when acoustic clarity is also present", () => {
    const wt: WordTiming[] = timings(150, 20).map((w) => ({ ...w, probability: 0.92 }));
    const d = computeDerivedMetrics({
      transcript: "twenty word transcript",
      wordTimings: wt,
      durationSec: (20 * 60) / 150,
      acoustic: SAMPLE_ACOUSTIC,
    });
    const r = scorePronunciationApprox(d, SAMPLE_ACOUSTIC);
    expect(r.qualityFlag).toBe("audio_grounded");
  });
});

describe("scoreGrammar", () => {
  it("uses Groq grammar analysis score when available", () => {
    const d = computeDerivedMetrics({ transcript: "I was go to the meeting yesterday." });
    const r = scoreGrammar(d, "I was go to the meeting yesterday.", {
      errors: [
        {
          error: "I was go",
          correction: "I went",
          type: "tense",
          explanation: "Past tense requires the simple past form.",
        },
      ],
      score: 88,
      summary: "Mostly solid grammar with one tense slip.",
      strengths: ["Clear subject-verb structure in most clauses."],
    });
    expect(r.score).toBe(88);
    expect(r.explanation).toContain("Mostly solid grammar");
    expect(r.qualityFlag).toBe("transcript_only");
  });

  it("falls back to heuristic scoring without Groq analysis", () => {
    const d = computeDerivedMetrics({ transcript: "I could of done it better." });
    const r = scoreGrammar(d, "I could of done it better.");
    expect(r.explanation.toLowerCase()).toContain("non-standard");
    expect(r.qualityFlag).toBe("transcript_only");
  });
});

describe("scoresFromAnalysis", () => {
  it("returns the same shape regardless of whether acoustic features are present", () => {
    const transcript = "I think the new approach will work well for the team.";
    const without = scoresFromAnalysis({ transcript });
    const with_ = scoresFromAnalysis({ transcript, acoustic: { available: true, features: SAMPLE_ACOUSTIC } });
    expect(Object.keys(without.scores).sort()).toEqual(Object.keys(with_.scores).sort());
    expect(Object.keys(without.explanations).sort()).toEqual(Object.keys(with_.explanations).sort());
  });
});
