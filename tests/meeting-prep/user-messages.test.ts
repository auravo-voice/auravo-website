import { describe, expect, it } from "vitest";

import { meetingPrepErrorMessage } from "@/lib/meeting-prep/user-messages";

describe("meetingPrepErrorMessage", () => {
  it("maps Groq developer errors to friendly copy", () => {
    expect(
      meetingPrepErrorMessage(
        "Groq HTTP 429: rate limit exceeded. Set GROQ_API_KEY in .env.local",
      ),
    ).toBe("Our AI coach is busy right now. Please wait a minute and try again.");
    expect(
      meetingPrepErrorMessage("Groq did not finish within 45s. Check GROQ_API_KEY"),
    ).toBe("The AI coach took too long to respond. Try again in a moment.");
  });

  it("keeps short validation messages from the API", () => {
    expect(meetingPrepErrorMessage("Invalid meeting type.")).toBe("Invalid meeting type.");
  });

  it("hides generic HTTP failure strings", () => {
    expect(meetingPrepErrorMessage("Plan failed (500)", "Could not generate the plan.")).toBe(
      "Could not generate the plan.",
    );
  });
});
