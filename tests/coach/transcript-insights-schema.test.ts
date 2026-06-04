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
});
