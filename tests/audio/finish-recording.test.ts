import { describe, expect, it } from "vitest";
import { recordingValidationError } from "@/lib/audio/finish-recording";

describe("recordingValidationError", () => {
  it("rejects very short duration", () => {
    const err = recordingValidationError(new Blob(["x".repeat(500)]), 500, {
      minDurationMs: 2_000,
    });
    expect(err).toMatch(/very short/i);
  });

  it("rejects empty blob when duration is long enough", () => {
    const err = recordingValidationError(new Blob([]), 5_000, { minBytes: 200 });
    expect(err).toMatch(/No audio was captured/i);
  });

  it("accepts normal-sized recording", () => {
    const err = recordingValidationError(new Blob(["x".repeat(500)]), 5_000);
    expect(err).toBeNull();
  });
});
