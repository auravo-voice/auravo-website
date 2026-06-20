import { describe, expect, it } from "vitest";

import {
  derivePronunciationHighlightSource,
  resolvePronunciationHighlightSource,
  resolveWordHighlightColor,
} from "@/app/quick-analysis/lib/word-highlight";

describe("pronunciation highlight source", () => {
  it("uses groq when phonetic map has entries", () => {
    expect(resolvePronunciationHighlightSource({ hello: "heh·loh" }, 3)).toBe("groq");
  });

  it("uses whisper label mode when groq returned empty", () => {
    expect(resolvePronunciationHighlightSource({}, 2)).toBe("whisper");
    expect(resolvePronunciationHighlightSource({}, 0)).toBe("whisper");
  });
});

describe("resolveWordHighlightColor", () => {
  const phoneticMap = { Bangalore: "BANG-guh-lohr", bangalore: "BANG-guh-lohr" };

  it("uses whisper confidence only when a Groq guide exists", () => {
    expect(resolveWordHighlightColor("Bangalore", 0.95, phoneticMap, "groq")).toBe("green");
    expect(resolveWordHighlightColor("Bangalore", 0.75, phoneticMap, "groq")).toBe("yellow");
    expect(resolveWordHighlightColor("Bangalore", 0.5, phoneticMap, "groq")).toBe("red");
    expect(resolveWordHighlightColor("fine", 0.99, {}, "whisper")).toBe("green");
  });

  it("is always green when there is no pronunciation guide", () => {
    expect(resolveWordHighlightColor("unclear", 0.5, {}, "whisper")).toBe("green");
    expect(resolveWordHighlightColor("mostly", 0.75, {}, "whisper")).toBe("green");
    expect(resolveWordHighlightColor("clear", 0.95, {}, "whisper")).toBe("green");
  });

  it("derives source from phonetic map", () => {
    const words = [{ word: "Bangalore", confidence: 0.5, start: 0, end: 1 }];
    expect(derivePronunciationHighlightSource(phoneticMap, words)).toBe("groq");
    expect(derivePronunciationHighlightSource({}, words)).toBe("whisper");
  });
});
