import { describe, expect, it } from "vitest";

import { normalizePolishedPayload } from "@/lib/transcription/polish-transcript-display";

describe("normalizePolishedPayload", () => {
  it("passes through { text } objects", () => {
    expect(normalizePolishedPayload({ text: "Hello." })).toEqual({ text: "Hello." });
  });

  it("joins string arrays into one text block", () => {
    expect(normalizePolishedPayload(["I live in Bangalore.", "I have been here two years."])).toEqual({
      text: "I live in Bangalore.\n\nI have been here two years.",
    });
  });

  it("maps alternate object keys to text", () => {
    expect(normalizePolishedPayload({ transcript: "Hello there." })).toEqual({
      text: "Hello there.",
    });
  });

  it("wraps bare strings", () => {
    expect(normalizePolishedPayload("Hello.")).toEqual({ text: "Hello." });
  });
});
