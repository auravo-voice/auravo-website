import { describe, expect, it } from "vitest";
import {
  groqTranscriptInsightsSchema,
  normalizeGroqTranscriptInsightsPayload,
} from "@/lib/coach/transcript-insights-schema";

describe("groqTranscriptInsightsSchema", () => {
  it("accepts acoustic_patterns without timestamps", () => {
    const raw = normalizeGroqTranscriptInsightsPayload({
      patterns: [
        {
          pattern: "Hedging",
          evidence: "I think maybe",
          impact: "Sounds unsure",
          fix: "State the point directly",
        },
      ],
      acoustic_patterns: [{ pattern: "Monotone delivery", fix: "Vary pitch on key words" }],
      biggest_issue: "Tighten your opening",
      strength: "Clear vocabulary",
    });
    const parsed = groqTranscriptInsightsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.acoustic_patterns?.[0]?.timestamps).toBe("");
  });

  it("coerces Groq drift (numeric evidence, array timestamps)", () => {
    const raw = normalizeGroqTranscriptInsightsPayload({
      patterns: [{ pattern: "Hedging", evidence: 42, impact: true, fix: "Pause" }],
      acoustic_patterns: [{ pattern: "Monotone", timestamps: ["12s", "45s"], fix: "Vary pitch" }],
    });
    const parsed = groqTranscriptInsightsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.patterns?.[0]?.evidence).toBe("42");
    expect(parsed.data.acoustic_patterns?.[0]?.timestamps).toBe("12s, 45s");
  });
});
