/** Spoken copy for Quick Analysis — coach TTS reads these; UI shows captions, not duplicate headings. */

export const WELCOME_LINES = [
  "You're about to answer a few short questions to help us understand your communication skills.",
  "There are no right or wrong answers — just speak naturally.",
] as const;

export const WELCOME_SPEECH = WELCOME_LINES.join(" ");

export const QUESTIONS = {
  q1_city:
    "Let's start with something simple. Tell me your name and a little about yourself.",
  q2_duration:
    "Tell me a little about your typical day. What do you usually do from morning to evening?",
  q3_about_city: "Tell me about a hobby, activity, or interest that you enjoy.",
  midpoint:
    "Great job! We've already gathered enough information for a basic snapshot. Would you like to spend a couple more minutes for a more complete analysis?",
  q4_objects:
    "If a friend were visiting your city for the first time, what would you recommend they see or do, and why?",
  q5_visual:
    "Please describe everything you notice in this image. What is happening? What might happen next?",
  results:
    "Here's your full English profile snapshot. You're doing well in some areas, and there's exciting room to grow in others. Head to your dashboard anytime to keep practicing with Auravo.",
  thank_you_no:
    "Thank you so much for your time! Your basic snapshot is saved — visit your dashboard to keep practicing with Auravo.",
  thank_you_submit:
    "Thank you! Your snapshot is saved — keep practicing from your Auravo dashboard.",
  thank_you_page:
    "Thank you for completing Quick Analysis. Your snapshot is ready — visit your dashboard to keep building with daily practice and coaching.",
} as const;

/** Optional ideas shown under Q1 — not spoken by the coach. */
export const Q1_ANSWER_STARTERS = [
  "My name is...",
  "I am from...",
  "I currently...",
  "One thing I enjoy is...",
] as const;

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
  q1_city: "About yourself",
  q2_duration: "Daily routine",
  q3_about_city: "Interests and hobbies",
  q4_objects: "Open-ended discussion",
  q5_visual: "Describe the scene",
};

/** Q3 is index 2 in {@link ANALYSIS_QUESTION_KEYS} (midpoint scoring). */
export const Q3_ANALYSIS_SEGMENT_INDEX = 2;

export const STEP_PROGRESS: Record<string, { current: number; total: number }> = {
  q1_city: { current: 1, total: 5 },
  q2_duration: { current: 2, total: 5 },
  q3_about_city: { current: 3, total: 5 },
  q4_objects: { current: 4, total: 5 },
  q5_visual: { current: 5, total: 5 },
};

export function stepProgressLabel(step: string): string | undefined {
  const p = STEP_PROGRESS[step];
  if (!p) return undefined;
  return `${p.current} of ${p.total}`;
}
