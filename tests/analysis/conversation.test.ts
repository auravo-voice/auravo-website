import { describe, expect, it } from "vitest";
import {
  computeConversationMetrics,
  describeConversation,
  type ConversationTurnInput,
} from "@/lib/analysis/conversation";

function turn(
  role: "user" | "assistant",
  text: string,
  durationMs: number | null,
  createdAt: number,
): ConversationTurnInput {
  return { role, text, durationMs, createdAt };
}

describe("computeConversationMetrics — turn balance", () => {
  it("reports a balanced talk share when both sides speak similar amounts", () => {
    const turns = [
      turn("assistant", "How would you describe the project?", 5000, 1_000),
      turn(
        "user",
        "It's a customer onboarding revamp that ships next quarter.",
        5000,
        8_000,
      ),
      turn("assistant", "What is the biggest risk?", 4000, 14_000),
      turn("user", "Vendor latency — we are mitigating with a cache.", 4500, 22_000),
    ];
    const m = computeConversationMetrics(turns);
    expect(m.turnCount).toBe(4);
    expect(m.userTurns).toBe(2);
    expect(m.assistantTurns).toBe(2);
    expect(m.userTalkShare).not.toBeNull();
    expect(m.userTalkShare!).toBeGreaterThan(0.4);
    expect(m.userTalkShare!).toBeLessThan(0.6);
  });

  it("flags user dominance when one side talks much more", () => {
    const turns = [
      turn("assistant", "hi", 500, 1_000),
      turn("user", "thanks for hosting me today, let me walk you through it...", 40_000, 50_000),
    ];
    const m = computeConversationMetrics(turns);
    expect(m.userTalkShare).not.toBeNull();
    expect(m.userTalkShare!).toBeGreaterThan(0.9);
  });
});

describe("computeConversationMetrics — response latency", () => {
  it("subtracts user audio duration from wall-clock delta to get think time", () => {
    // Assistant ends at t=1000. User ends at t=10000 with a 3s recording → think time = 6s.
    const turns = [
      turn("assistant", "Why did you leave your previous role?", 4000, 1_000),
      turn(
        "user",
        "I wanted broader product ownership and a smaller team.",
        3_000,
        10_000,
      ),
    ];
    const m = computeConversationMetrics(turns);
    expect(m.avgResponseLatencyMs).toBe(6_000);
    expect(m.longestResponseLatencyMs).toBe(6_000);
  });

  it("counts quick responses under 1.5 seconds", () => {
    const turns = [
      turn("assistant", "yes?", 500, 1_000),
      turn("user", "Right here.", 1_000, 2_500), // think time 0.5s → quick
      turn("assistant", "and after?", 600, 4_000),
      turn("user", "And after we shipped, we ran a retro.", 5_000, 12_000), // think 3s → not quick
    ];
    const m = computeConversationMetrics(turns);
    expect(m.quickResponseCount).toBe(1);
  });

  it("ignores latency when the user has no audio duration", () => {
    const turns = [
      turn("assistant", "hi", 500, 1_000),
      turn("user", "no audio recorded here", null, 5_000),
    ];
    const m = computeConversationMetrics(turns);
    expect(m.avgResponseLatencyMs).toBeNull();
  });
});

describe("computeConversationMetrics — content signals", () => {
  it("counts incomplete user turns that do not end with a terminator", () => {
    const turns = [
      turn("user", "I think the answer is", 2_000, 1_000),
      turn("user", "Yes, that's the plan.", 2_000, 5_000),
      turn("user", "We should also consider", 2_000, 9_000),
    ];
    const m = computeConversationMetrics(turns);
    expect(m.incompleteUserTurns).toBe(2);
  });

  it("computes user words per turn", () => {
    const turns = [
      turn("user", "Hello world.", 1_000, 1_000),
      turn("user", "Three more words here.", 1_000, 3_000),
    ];
    const m = computeConversationMetrics(turns);
    expect(m.userWordsPerTurn).toBeGreaterThanOrEqual(2);
  });
});

describe("describeConversation", () => {
  it("returns a bullet about quick reactivity when latency is very short", () => {
    const turns = [
      turn("assistant", "what?", 500, 1_000),
      turn("user", "Right.", 1_000, 2_300),
    ];
    const m = computeConversationMetrics(turns);
    const notes = describeConversation(m);
    expect(notes.some((n) => /reactivity|quick/i.test(n))).toBe(true);
  });

  it("calls out very long think times", () => {
    const turns = [
      turn("assistant", "Walk me through the architecture.", 5_000, 1_000),
      turn("user", "We have a monolith.", 1_000, 12_000), // think time 10s
    ];
    const m = computeConversationMetrics(turns);
    const notes = describeConversation(m);
    expect(notes.some((n) => n.includes("think-before-speaking"))).toBe(true);
  });
});
