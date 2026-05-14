import { describe, expect, it } from "vitest";
import { evaluateRow, shareEmojiLine } from "@/lib/vocabulary/wordle-stats";
import { getDailyWord, getDailyPuzzleNumber, getUtcDateKey, isAllowedGuess } from "@/lib/vocabulary/words";

describe("getDailyWord", () => {
  it("is deterministic for the same UTC date", () => {
    const d = new Date("2026-06-15T12:00:00.000Z");
    expect(getDailyWord(d)).toBe(getDailyWord(d));
    expect(getUtcDateKey(d)).toBe("2026-06-15");
  });

  it("matches puzzle number helper", () => {
    const d = new Date("2026-06-15T00:00:00.000Z");
    expect(getDailyPuzzleNumber(d)).toBeGreaterThan(0);
  });
});

describe("evaluateRow", () => {
  it("all correct when exact match", () => {
    expect(evaluateRow("crisp", "crisp").every((x) => x === "correct")).toBe(true);
  });

  it("handles absent letters", () => {
    const out = evaluateRow("crisp", "zzzzz");
    expect(out.every((x) => x === "absent")).toBe(true);
  });
});

describe("isAllowedGuess", () => {
  it("allows common English five-letter words from the dictionary list", () => {
    expect(isAllowedGuess("hello")).toBe(true);
    expect(isAllowedGuess("crane")).toBe(true);
  });

  it("rejects non-words and invalid patterns", () => {
    expect(isAllowedGuess("qqqqq")).toBe(false);
    expect(isAllowedGuess("aaaa")).toBe(false);
  });
});

describe("shareEmojiLine", () => {
  it("maps states to emoji", () => {
    expect(shareEmojiLine(["correct", "present", "absent", "absent", "correct"])).toBe("🟩🟨⬛⬛🟩");
  });
});
