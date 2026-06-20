import { QUESTIONS, WELCOME_SPEECH } from "@/app/quick-analysis/copy";

/** Fixed coach lines — pre-rendered to MP3 via `npm run generate:qa-tts`. */
export const QUICK_ANALYSIS_TTS_PROMPTS = [
  { id: "welcome", text: WELCOME_SPEECH },
  { id: "q1_city", text: QUESTIONS.q1_city },
  { id: "q2_duration", text: QUESTIONS.q2_duration },
  { id: "q3_about_city", text: QUESTIONS.q3_about_city },
  { id: "midpoint", text: QUESTIONS.midpoint },
  { id: "q4_objects", text: QUESTIONS.q4_objects },
  { id: "q5_visual", text: QUESTIONS.q5_visual },
  { id: "results", text: QUESTIONS.results },
  { id: "thank_you_no", text: QUESTIONS.thank_you_no },
  { id: "thank_you_submit", text: QUESTIONS.thank_you_submit },
  { id: "thank_you_page", text: QUESTIONS.thank_you_page },
] as const;

export type QuickAnalysisTtsPromptId = (typeof QUICK_ANALYSIS_TTS_PROMPTS)[number]["id"];

const TEXT_TO_PATH = new Map(
  QUICK_ANALYSIS_TTS_PROMPTS.map((p) => [p.text.trim(), `/quick-analysis/tts/${p.id}.mp3`]),
);

/** Public URL for a pre-recorded prompt, or null when text is not a known fixed line. */
export function staticTtsUrlForText(text: string): string | null {
  return TEXT_TO_PATH.get(text.trim()) ?? null;
}
