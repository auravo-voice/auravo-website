/** Free Quick Analysis assessments per calendar day (server local timezone). */
export const QUICK_ANALYSIS_FREE_DAILY_LIMIT = 3;

/** Max simultaneous server-side analysis jobs (Whisper + Groq). */
export const QUICK_ANALYSIS_MAX_PARALLEL = 5;

/** Total recording budget per assessment session (discussion + answers). */
export const QUICK_ANALYSIS_SESSION_MAX_RECORDING_MS = 5 * 60 * 1000;

export const QUICK_ANALYSIS_BUSY_MESSAGE =
  "Our servers are busy right now — lots of people are practicing. Please wait a moment and try again.";

export const QUICK_ANALYSIS_PAYWALL_MESSAGE =
  "You've used your 3 free assessments for today. Subscribe to keep practicing with Voca.";

export const SUBSCRIPTION_SESSIONS_EXHAUSTED_MESSAGE =
  "You've used all coach sessions in your plan. Renew to keep practicing with Voca.";
