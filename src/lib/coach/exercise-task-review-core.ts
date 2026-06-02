import { z } from "zod";
import type { VoiceAnalysis } from "@/lib/analysis/scoring";

/** Stable id for the “Defend an unpopular call” template — used for a tighter rubric. */
export const DEFEND_UNPOPULAR_EXERCISE_ID = "confidence-defend-position";

export const exerciseTaskReviewSchema = z.object({
  /** How well the response satisfied the exercise as a whole (0–100). Coach judgment, not voice math. */
  taskFitScore: z.number().int().min(0).max(100),
  promptCompletion: z.string().min(20).max(720),
  scenarioRelevance: z.string().min(20).max(720),
  structureFeedback: z.string().min(20).max(720),
  toneFeedback: z.string().min(20).max(720),
  communicationEffectiveness: z.string().min(20).max(720),
  whatWorked: z.string().min(15).max(520),
  whatToImprove: z.string().min(15).max(520),
  revisedNextAttemptStrategy: z.string().min(20).max(720),
});

export type ExerciseTaskReviewPayload = z.infer<typeof exerciseTaskReviewSchema>;

const TASK_REVIEW_STRING_MIN: Record<
  Exclude<keyof ExerciseTaskReviewPayload, "taskFitScore">,
  number
> = {
  promptCompletion: 20,
  scenarioRelevance: 20,
  structureFeedback: 20,
  toneFeedback: 20,
  communicationEffectiveness: 20,
  whatWorked: 15,
  whatToImprove: 15,
  revisedNextAttemptStrategy: 20,
};

const TASK_REVIEW_FIELD_ALIASES: Record<
  keyof ExerciseTaskReviewPayload,
  readonly string[]
> = {
  taskFitScore: ["taskFitScore", "task_fit_score", "fitScore", "fit_score", "score"],
  promptCompletion: ["promptCompletion", "prompt_completion", "completion", "promptFit"],
  scenarioRelevance: ["scenarioRelevance", "scenario_relevance", "relevance", "scenarioFit"],
  structureFeedback: ["structureFeedback", "structure_feedback", "structure", "structureNotes"],
  toneFeedback: ["toneFeedback", "tone_feedback", "tone", "deliveryFeedback", "delivery"],
  communicationEffectiveness: [
    "communicationEffectiveness",
    "communication_effectiveness",
    "effectiveness",
    "communication",
    "clarity",
  ],
  whatWorked: ["whatWorked", "what_worked", "strengths", "positives", "wins"],
  whatToImprove: ["whatToImprove", "what_to_improve", "improvements", "gaps", "weaknesses"],
  revisedNextAttemptStrategy: [
    "revisedNextAttemptStrategy",
    "revised_next_attempt_strategy",
    "nextStrategy",
    "nextSteps",
    "strategy",
    "nextAttempt",
  ],
};

function asCoachString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asCoachString).filter(Boolean).join(" ").trim();
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return o.text.trim();
    if (typeof o.content === "string") return o.content.trim();
    if (typeof o.feedback === "string") return o.feedback.trim();
  }
  return "";
}

/** Unwrap common Qwen nesting (e.g. `{ "review": { ... } }`). */
function unwrapTaskReviewRoot(parsed: unknown): Record<string, unknown> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  let o = { ...(parsed as Record<string, unknown>) };
  for (const key of ["review", "taskReview", "task_review", "result", "feedback", "evaluation", "data"]) {
    const inner = o[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      o = { ...o, ...(inner as Record<string, unknown>) };
    }
  }
  return o;
}

function pickTaskReviewString(o: Record<string, unknown>, field: keyof ExerciseTaskReviewPayload): string {
  if (field === "taskFitScore") return "";
  const aliases = TASK_REVIEW_FIELD_ALIASES[field];
  return pickTaskReviewStringFromAliases(o, aliases);
}

function pickTaskReviewStringFromAliases(o: Record<string, unknown>, aliases: readonly string[]): string {
  for (const key of aliases) {
    const s = asCoachString(o[key]);
    if (s) return s;
  }
  return "";
}

function coerceTaskFitScore(v: unknown, fallback: number): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number.parseInt(v, 10)
        : NaN;
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  return fallback;
}

/**
 * Coerce partial / mis-shaped Qwen JSON before Zod. Missing or too-short fields are filled from
 * {@link buildFallbackTaskReview} so practice finalize always returns a complete task review.
 */
export function normalizeTaskReviewJson(
  parsed: unknown,
  fallback: ExerciseTaskReviewPayload,
): ExerciseTaskReviewPayload {
  const o = unwrapTaskReviewRoot(parsed);
  let scoreCandidate: unknown;
  for (const key of TASK_REVIEW_FIELD_ALIASES.taskFitScore) {
    if (o[key] != null && o[key] !== "") {
      scoreCandidate = o[key];
      break;
    }
  }
  const taskFitScore = coerceTaskFitScore(scoreCandidate, fallback.taskFitScore);

  const pick = (field: Exclude<keyof ExerciseTaskReviewPayload, "taskFitScore">) => {
    const min = TASK_REVIEW_STRING_MIN[field];
    const fromLlm = pickTaskReviewString(o, field);
    return fromLlm.length >= min ? fromLlm : fallback[field];
  };

  return exerciseTaskReviewSchema.parse({
    taskFitScore,
    promptCompletion: pick("promptCompletion"),
    scenarioRelevance: pick("scenarioRelevance"),
    structureFeedback: pick("structureFeedback"),
    toneFeedback: pick("toneFeedback"),
    communicationEffectiveness: pick("communicationEffectiveness"),
    whatWorked: pick("whatWorked"),
    whatToImprove: pick("whatToImprove"),
    revisedNextAttemptStrategy: pick("revisedNextAttemptStrategy"),
  });
}

export const exerciseTaskReviewResultSchema = exerciseTaskReviewSchema.extend({
  taskReviewSource: z.enum(["groq", "ollama", "fallback"]),
});

export type ExerciseTaskReviewResult = z.infer<typeof exerciseTaskReviewResultSchema>;

/** Parse persisted or API `taskReview` JSON (safe for client components). */
export function parseExerciseTaskReviewResult(value: unknown): ExerciseTaskReviewResult | null {
  const out = exerciseTaskReviewResultSchema.safeParse(value);
  return out.success ? out.data : null;
}

export type ExerciseContextForTaskReview = {
  exerciseId: string;
  title: string;
  subtitle: string;
  category: string;
  focus: string;
  coachingGoal: string;
  promptText: string;
  targetDurationSec: number;
};

function tokenizeMeaningful(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.toLowerCase().split(/\W+/)) {
    if (w.length > 3) out.add(w);
  }
  return out;
}

/** Overlap between prompt vocabulary and transcript (0–1). */
export function promptTranscriptOverlap(promptText: string, transcript: string): number {
  const promptWords = tokenizeMeaningful(promptText);
  const transWords = tokenizeMeaningful(transcript);
  if (promptWords.size === 0) return 0;
  let hits = 0;
  for (const w of promptWords) {
    if (transWords.has(w)) hits++;
  }
  return hits / promptWords.size;
}

/**
 * Scenario-specific evaluation criteria injected into the task-review LLM prompt.
 * Exported for tests.
 */
export function rubricInstructionsForExercise(exercise: ExerciseContextForTaskReview): string {
  if (exercise.exerciseId === DEFEND_UNPOPULAR_EXERCISE_ID) {
    return `RUBRIC — Defend an unpopular decision (this exercise):
- Did the learner clearly describe the disagreement and the decision they are defending?
- Did they defend the decision with reasoning and trade-offs (not slogans or vibes alone)?
- Did they sound composed — direct without aggression or brittle defensiveness?
- Did they address what would change their mind (explicitly or clearly implied), matching the coaching goal?
- Was the conclusion strong and intentional?`;
  }

  switch (exercise.category) {
    case "confidence":
      return `RUBRIC — Confidence / persuasion:
- Conviction: do they sound like they believe what they say?
- Calmness: steady pacing under pressure (use transcript + delivery hints only).
- Assertiveness without aggression.
- Clear recommendation or ask when the prompt calls for it.
- Ownership of reasoning (specific “because” chains, not vague hedging).`;
    case "interview":
      return `RUBRIC — Interview-style answer:
- STAR or comparable structure when the prompt implies a story or example.
- Specificity: names, numbers, constraints — not only generic claims.
- Relevance to the question asked.
- Concise storytelling: beginning/middle/end without rambling.
- Professional tone appropriate to the scenario.`;
    case "client_call":
      return `RUBRIC — Client / stakeholder call:
- Reassurance where appropriate.
- Clarity of situation, impact, and options.
- Empathy without sounding performative.
- Problem framing: root cause vs symptoms.
- Concrete next steps or ownership.`;
    case "filler_control":
      return `RUBRIC — Filler control / structured thinking:
- Evidence of structured thinking (beats, sections, or logical flow the prompt asked for).
- Intentional pauses vs filler crutches (infer from transcript wording and rhythm cues only).
- Avoiding rambling: one idea per sentence where the prompt demands crispness.
- Concise response relative to the prompt’s scope.`;
    case "simulation_meeting":
      return `RUBRIC — Meeting / simulation:
- Alignment with agenda or decision the prompt implies.
- Response relevance to the “room” and stakes described.
- Decision clarity: who does what, by when.
- Professional tone and inclusive framing where appropriate.`;
    case "pronunciation":
    case "pacing":
    case "grammar":
    case "vocabulary":
    case "fluency":
      return `RUBRIC — ${exercise.category}:
- Did the learner address the substantive prompt (not only surface delivery)?
- Structure appropriate to the instructions (lists, comparisons, narrative).
- Tone fits the brief (teaching, explaining, persuading as implied).
- Communication effectiveness for the stated situation.`;
    default:
      return `RUBRIC — General speaking task:
- Prompt alignment and completeness.
- Scenario-appropriate tone and structure.
- Clear, listener-oriented communication.`;
  }
}

export function voiceMetricsForTaskReviewPrompt(voice: VoiceAnalysis): Record<string, unknown> {
  return {
    wpm: voice.derivedMetrics.wpm == null ? null : Math.round(voice.derivedMetrics.wpm),
    fillerCount: voice.fillerStats.count,
    fillerPerMinute: voice.fillerStats.ratePerMin,
    pauseCount: voice.pauseStats.count,
    longPauseCount: voice.pauseStats.longCount,
    meanWordConfidence:
      voice.asrConfidence.mean == null ? null : Number(voice.asrConfidence.mean.toFixed(3)),
    dimensionScores: voice.scores,
    scoreExplanations: voice.explanations,
  };
}

export function buildTaskReviewUserPayload(input: {
  exercise: ExerciseContextForTaskReview;
  transcript: string;
  voice: VoiceAnalysis;
}): string {
  const rubric = rubricInstructionsForExercise(input.exercise);
  const payload = {
    exercise: input.exercise,
    rubric,
    learnerTranscript: input.transcript,
    voiceMetricsReadOnly: voiceMetricsForTaskReviewPrompt(input.voice),
  };
  return `Evaluate this one practice attempt. Compare the transcript to the exercise prompt and coaching goal.\n${JSON.stringify(payload)}`;
}

export function buildFallbackTaskReview(input: {
  exercise: ExerciseContextForTaskReview;
  transcript: string;
  voice: VoiceAnalysis;
}): ExerciseTaskReviewResult {
  const t = input.transcript.trim();
  const words = t ? t.split(/\s+/).length : 0;
  const overlap = promptTranscriptOverlap(input.exercise.promptText, t);
  const wpm = input.voice.derivedMetrics.wpm;
  const targetWordsLo = Math.max(35, Math.round(input.exercise.targetDurationSec * 1.1));
  const targetWordsHi = Math.round(input.exercise.targetDurationSec * 3.2);
  const lengthOk = words >= targetWordsLo * 0.35 && words <= targetWordsHi * 1.4;

  let taskFit = 52;
  if (words < 25) taskFit -= 18;
  if (overlap < 0.08) taskFit -= 12;
  else if (overlap > 0.22) taskFit += 10;
  if (lengthOk) taskFit += 6;
  if (wpm != null && wpm >= 90 && wpm <= 190) taskFit += 4;
  taskFit = Math.max(28, Math.min(78, Math.round(taskFit)));

  const short = words < 40;
  const promptCompletion = short
    ? `The response looks quite short for “${input.exercise.title}.” Aim to fully unpack the prompt on the next attempt — listeners need enough substance to judge your reasoning.`
    : overlap < 0.1
      ? `Parts of the answer drift from the scenario in the prompt. On your next take, mirror the situation in the first sentences so it is obvious you are answering this exact brief.`
      : `You covered enough of the prompt vocabulary and situation to count as on-brief. Tighten the arc so the listener always knows which part of the instructions you are answering.`;

  const scenarioRelevance = short
    ? "There is not enough spoken content yet to sound fully immersed in the scenario — extend the answer with concrete details the prompt asks for."
    : `Scenario fit is ${overlap < 0.12 ? "mixed" : "reasonable"}: keep anchoring to the stakeholders, stakes, or constraints named in the exercise.`;

  const structureFeedback = short
    ? "Add a clear opening (thesis), a middle with one or two supporting moves, and a decisive close that matches the coaching goal."
    : "Check that the first 20 seconds state your position or answer, the middle supports it with specifics, and the ending lands the action the prompt requests.";

  const toneFeedback =
    input.voice.fillerStats.ratePerMin > 5
      ? "Delivery sounded busy — slow slightly and replace filler crutches with short silent beats so conviction reads through."
      : "Aim for steady, conversational conviction — let key claims land without rushing the transitions.";

  const communicationEffectiveness = short
    ? "Overall clarity of intent is limited by length — the listener cannot yet tell what you want them to believe or do."
    : "Intent comes through, but push for sharper listener takeaways tied to the exercise goal line by line.";

  const whatWorked = lengthOk
    ? "You produced enough spoken material to work with — good instinct to keep going rather than stopping ultra-early."
    : "You started responding — use the next attempt to stay in the scenario longer so your reasoning can develop.";

  const whatToImprove = short
    ? "Length and explicit prompt coverage — name the trade-offs, examples, or next steps the prompt demands."
    : "Tie each paragraph back to a line from the coaching goal so the rubric is obviously satisfied.";

  const revisedNextAttemptStrategy = `Open by restating the situation in one sentence, answer the core question in the next 2–3 sentences with one concrete example, then close with exactly what the prompt asks (ask, decision, trade-off, or “what would change my mind”). Target roughly ${input.exercise.targetDurationSec} seconds of focused speech.`;

  return exerciseTaskReviewResultSchema.parse({
    taskFitScore: taskFit,
    promptCompletion,
    scenarioRelevance,
    structureFeedback,
    toneFeedback,
    communicationEffectiveness,
    whatWorked,
    whatToImprove,
    revisedNextAttemptStrategy,
    taskReviewSource: "fallback",
  });
}

export type GenerateExerciseTaskReviewInput = {
  exercise: ExerciseContextForTaskReview;
  transcript: string;
  voice: VoiceAnalysis;
};
