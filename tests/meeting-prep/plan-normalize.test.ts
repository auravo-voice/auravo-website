import { describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizeMeetingPlanJson } from "@/lib/meeting-prep/plan";

const talkingPointSchema = z.object({
  label: z.string().min(3),
  hint: z.string().min(4),
});

const miniPlanSchema = z.object({
  opening: z.string().min(8),
  talkingPoints: z.array(talkingPointSchema).min(3),
  transitions: z.array(z.string().min(4)).min(1),
  closing: z.string().min(8),
  anticipatedQuestions: z.array(z.string().min(4)).min(3),
  pushback: z.string().min(8),
});

describe("normalizeMeetingPlanJson", () => {
  it("coerces pushback array to string", () => {
    const raw = {
      opening: "Hello team, thanks for joining today.",
      talkingPoints: [
        { label: "Status", hint: "Share the headline metric." },
        { label: "Ask", hint: "State budget and owner." },
        { label: "Risk", hint: "Name one delivery risk." },
      ],
      transitions: ["Next topic.", "Wrapping up."],
      closing: "Thanks — I will send notes and follow up Friday.",
      anticipatedQuestions: ["What is the timeline?", "Who signs off?", "What if we slip?"],
      pushback: ["They may say it costs too much.", "Answer with ROI first."],
    };
    const out = miniPlanSchema.safeParse(normalizeMeetingPlanJson(raw));
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.pushback).toContain("ROI");
      expect(out.data.pushback).not.toMatch(/^\[/);
    }
  });
});
