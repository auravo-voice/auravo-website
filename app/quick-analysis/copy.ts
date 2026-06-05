/** Spoken copy for the demo — browser TTS reads these; UI shows captions, not duplicate headings. */

export const WELCOME_LINES = [
  "Welcome to Auravo.",
  "We'd like to spend about five minutes with you to understand your strengths on your English journey.",
  "You'll answer a few short questions out loud — no account needed.",
  "When you're ready, tap the microphone and speak naturally.",
] as const;

export const WELCOME_SPEECH = WELCOME_LINES.join(" ");

export const QUESTIONS = {
  q1_city: "So tell me — which city do you live in?",
  q2_duration: "And for how long have you been living there?",
  q3_about_city:
    "Awesome! Would you like to speak five or six sentences about your city? Tell me what you love about it, what it's known for — anything at all.",
  midpoint:
    "Great job! We've already done a fair amount of analysis. Would you like to spend a couple more minutes for a fuller picture?",
  q4_objects:
    "Great! Can you name five things that are around you right now? For example, a desk, a window, a phone.",
  q5_visual: "Almost done! Please describe what you see in this image in a few sentences.",
  results:
    "Here's your full English profile snapshot. You're doing well in some areas, and there's exciting room to grow in others. We'd love to create a personalised lesson plan for you.",
  thank_you_no: "Thank you so much for your time!",
  thank_you_submit: "Thank you! We'll be in touch soon with your personalised plan.",
  thank_you_page:
    "Thank you! We'll be in touch soon with a personalised plan. You can also sign in to Auravo for the full coaching experience.",
} as const;

/** Ordered question keys sent to full analysis (Q1–Q5 audio + transcript segments). */
export const ANALYSIS_QUESTION_KEYS = [
  "q1_city",
  "q2_duration",
  "q3_about_city",
  "q4_objects",
  "q5_visual",
] as const;

export type AnalysisQuestionKey = (typeof ANALYSIS_QUESTION_KEYS)[number];

/** Short labels for per-question transcript sections in results. */
export const QUESTION_SEGMENT_LABELS: Record<AnalysisQuestionKey, string> = {
  q1_city: "Where do you live",
  q2_duration: "How long you've lived there",
  q3_about_city: "About your city",
  q4_objects: "Objects around you",
  q5_visual: "Describe the scene",
};

/** Q3 is index 2 in {@link ANALYSIS_QUESTION_KEYS} (midpoint scoring). */
export const Q3_ANALYSIS_SEGMENT_INDEX = 2;

export const STEP_PROGRESS: Record<string, { current: number; total: number }> = {
  q1_city: { current: 1, total: 6 },
  q2_duration: { current: 2, total: 6 },
  q3_about_city: { current: 3, total: 6 },
  q4_objects: { current: 4, total: 6 },
  q5_visual: { current: 5, total: 6 },
};
