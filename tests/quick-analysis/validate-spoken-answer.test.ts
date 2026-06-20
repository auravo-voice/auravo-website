import { describe, expect, it } from "vitest";

import { validateSpokenAnswer } from "@/lib/quick-analysis/validate-spoken-answer";

describe("validateSpokenAnswer", () => {
  it("rejects empty audio", () => {
    expect(validateSpokenAnswer(new Blob([]), "", 0)).toMatch(/didn't catch any speech/i);
  });

  it("accepts browser transcript with words", () => {
    expect(validateSpokenAnswer(new Blob(["x".repeat(900)]), "hello there", 800)).toBeNull();
  });

  it("rejects short tap with no words and tiny blob", () => {
    expect(validateSpokenAnswer(new Blob(["x".repeat(900)]), "", 200)).toMatch(/too short/i);
  });

  it("allows wordless substantial audio for server whisper", () => {
    expect(validateSpokenAnswer(new Blob(["x".repeat(3500)]), "", 2000)).toBeNull();
  });
});
