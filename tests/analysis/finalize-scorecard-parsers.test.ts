import { describe, expect, it } from "vitest";
import {
  parseConversationMetricsPayload,
  parseVoiceDeliveryPeek,
} from "@/lib/analysis/finalize-scorecard-parsers";

describe("finalize-scorecard-parsers", () => {
  it("extracts voice peek from finalize-shaped JSON", () => {
    const p = parseVoiceDeliveryPeek({
      voiceAnalysis: {
        acousticFeatures: {},
        vadFeatures: {},
        derivedMetrics: {
          wpm: 142,
          fillerRatePerMin: 2.2,
          pauseCount: 3,
          longPauseCount: 1,
          speakingRatio: 0.72,
        },
      },
    } as Record<string, unknown>);
    expect(p?.wpm).toBe(142);
    expect(p?.acousticGrounded).toBe(true);
    expect(p?.vadGrounded).toBe(true);
  });

  it("parses conversation metrics", () => {
    const c = parseConversationMetricsPayload({
      turnCount: 4,
      userTurns: 2,
      assistantTurns: 2,
      avgUserTurnSec: 12.5,
      longestUserTurnSec: 22,
      userTalkShare: 0.52,
      avgResponseLatencyMs: 1800,
      longestResponseLatencyMs: 4000,
      quickResponseCount: 1,
      longUserTurnsCount: 0,
      userWordCount: 120,
      assistantWordCount: 95,
      userWordsPerTurn: 60,
      incompleteUserTurns: 1,
    });
    expect(c?.turnCount).toBe(4);
    expect(c?.quickResponseCount).toBe(1);
  });
});
