import { describe, expect, it } from "vitest";

import { QUESTIONS, WELCOME_SPEECH } from "@/app/quick-analysis/copy";
import {
  QUICK_ANALYSIS_TTS_PROMPTS,
  staticTtsUrlForText,
} from "@/app/quick-analysis/tts-prompts";

describe("quick analysis static TTS", () => {
  it("maps every fixed prompt to a public MP3 path", () => {
    expect(QUICK_ANALYSIS_TTS_PROMPTS.length).toBeGreaterThanOrEqual(10);
    expect(staticTtsUrlForText(WELCOME_SPEECH)).toBe("/quick-analysis/tts/welcome.mp3");
    expect(staticTtsUrlForText(QUESTIONS.q1_city)).toBe("/quick-analysis/tts/q1_city.mp3");
  });

  it("returns null for unknown text", () => {
    expect(staticTtsUrlForText("Something dynamic")).toBeNull();
  });
});
