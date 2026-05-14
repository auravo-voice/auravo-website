import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import {
  CATEGORY_LABELS,
  EXERCISE_LIBRARY,
  isPracticeGoalId,
  type ExerciseCategory,
  type ExerciseDifficulty,
  type ExerciseTemplate,
  type PracticeGoalId,
} from "./exercises";

/**
 * Day-level shape used by the learning-path UI and the daily-practice runner. One day = one themed session containing
 * 2–3 individual exercises.
 */
export type WeekDay = {
  /** Stable short label (Mon, Tue, …). */
  day: string;
  /** 0-indexed slot in the week so the runner can resolve "today" deterministically. */
  weekdayIndex: number;
  /** Themed category — drives the day-card badge in the learning-path view. */
  category: ExerciseCategory;
  /** Primary dimension this day stresses. Multiple days can repeat the same focus if the learner is very weak on it. */
  focus: DimensionKey;
  /** Mixed difficulty matters less than picking content the learner can actually finish. */
  difficulty: ExerciseDifficulty;
  /** Concrete session title — derived from the day's exercises, not "Voice-led session." */
  title: string;
  /** Short coach-voice summary (one sentence) shown on the learning-path card. */
  summary: string;
  /** Total target minutes for the day (rounded from sum of exercise targetDurationSec / 60 + 1 min recap). */
  durationMin: number;
  /** Concrete exercises the runner will play. Always 2–3 distinct templates. */
  exercises: ExerciseTemplate[];
};

export type WeekPlan = {
  isoWeek: string;
  goalLabel: string;
  weakestDims: DimensionKey[];
  days: WeekDay[];
};

export type BuildWeekPlanInput = {
  /** Stable user id from the cookie — keeps the plan stable across refreshes for the same person. */
  userId: string;
  /** Baseline scores so we can rank weaknesses. */
  scores: Record<DimensionKey, number>;
  /** Stored onboarding goal id; nullable for new learners. */
  goalId: string | null;
  /** Reference date — defaults to "now." Pass an explicit Date in tests for stability. */
  now?: Date;
  /** Bumps when the learner clicks "Regenerate this week" — also rotates content across reloads if desired. */
  regenerateNonce?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// PRNG: FNV-1a hash → mulberry32. Both are tiny, well-known, and deterministic.
// ─────────────────────────────────────────────────────────────────────────────

function fnv1aHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates with a supplied [0,1) RNG. Pure; does not mutate input. */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISO-week helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an ISO-8601 week key like "2026-W20". Stable across refreshes within the same calendar week.
 */
export function isoWeekKey(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty + category planning
// ─────────────────────────────────────────────────────────────────────────────

function difficultyForAverage(avg: number): ExerciseDifficulty {
  if (avg < 55) return "beginner";
  if (avg < 78) return "intermediate";
  return "advanced";
}

function rankWeakest(scores: Record<DimensionKey, number>): DimensionKey[] {
  return (Object.entries(scores) as [DimensionKey, number][])
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
}

/**
 * Map a dimension → the most natural category to coach that dimension. We diverge from a strict 1:1 mapping
 * intentionally (e.g. fluency learners benefit from confidence work, not only fluency drills) so each day feels
 * thematically distinct rather than five "fluency" sessions in a row.
 */
const DIMENSION_TO_CATEGORIES: Record<DimensionKey, ExerciseCategory[]> = {
  pronunciation: ["pronunciation", "pacing"],
  grammar: ["grammar", "vocabulary"],
  fluency: ["fluency", "confidence", "simulation_meeting"],
  vocabulary: ["vocabulary", "interview"],
  filler_words: ["filler_control", "simulation_meeting"],
  pacing: ["pacing", "fluency"],
};

const GOAL_BIASED_CATEGORIES: Record<PracticeGoalId, ExerciseCategory[]> = {
  interview: ["interview", "filler_control", "confidence"],
  professional: ["client_call", "simulation_meeting", "confidence"],
  academic: ["grammar", "vocabulary", "pronunciation"],
  general: ["fluency", "pronunciation", "filler_control"],
};

/**
 * Builds the week-level category rotation. Strategy:
 *   1. Stack the two weakest dimensions across the first three slots (one per slot) so the learner sees their
 *      gap addressed early in the week.
 *   2. Insert one goal-biased slot mid-week (e.g. an interview learner gets a behavioural day on Wed).
 *   3. Sprinkle a pacing slot — pacing is in the spec as an explicit Step-4 focus area and is universally useful.
 *   4. Fill the rest with the third-weakest dimension + a maintenance day.
 * Result: 5–7 themed slots. Order is then deterministically reshuffled by the PRNG so two learners with similar
 * weaknesses don't see the identical week.
 */
function planCategoryRotation({
  weakest,
  goal,
  rng,
  daysInWeek,
}: {
  weakest: DimensionKey[];
  goal: PracticeGoalId;
  rng: () => number;
  daysInWeek: number;
}): { focus: DimensionKey; category: ExerciseCategory }[] {
  const slots: { focus: DimensionKey; category: ExerciseCategory }[] = [];

  function pushFromDim(dim: DimensionKey) {
    const opts = DIMENSION_TO_CATEGORIES[dim];
    const cat = opts[Math.floor(rng() * opts.length)]!;
    slots.push({ focus: dim, category: cat });
  }

  // (1) Weakest-first stacking.
  for (let i = 0; i < Math.min(2, weakest.length); i++) {
    pushFromDim(weakest[i]!);
  }

  // (2) Goal-biased mid-week slot.
  const goalCats = GOAL_BIASED_CATEGORIES[goal];
  const goalCat = goalCats[Math.floor(rng() * goalCats.length)]!;
  const goalFocus =
    weakest.find((d) => DIMENSION_TO_CATEGORIES[d].includes(goalCat)) ?? weakest[0] ?? "fluency";
  slots.push({ focus: goalFocus, category: goalCat });

  // (3) Always include a pacing slot — Step 4 of the core experience explicitly tracks pacing.
  slots.push({ focus: "pacing", category: "pacing" });

  // (4) Third-weakest + a maintenance day.
  if (weakest[2]) pushFromDim(weakest[2]);
  if (slots.length < daysInWeek) pushFromDim(weakest[0] ?? "fluency");
  if (slots.length < daysInWeek) {
    // Maintenance: a confidence or simulation_meeting day, regardless of weakness.
    const cat: ExerciseCategory = rng() < 0.5 ? "confidence" : "simulation_meeting";
    slots.push({ focus: "fluency", category: cat });
  }

  // De-duplicate consecutive identical categories so the week feels varied.
  const trimmed: typeof slots = [];
  for (const slot of slots) {
    const last = trimmed[trimmed.length - 1];
    if (last && last.category === slot.category) continue;
    trimmed.push(slot);
    if (trimmed.length >= daysInWeek) break;
  }
  // If de-duping shrank us below the target, top up with anything not already present.
  if (trimmed.length < daysInWeek) {
    const haveCats = new Set(trimmed.map((s) => s.category));
    for (const dim of weakest) {
      for (const cat of DIMENSION_TO_CATEGORIES[dim]) {
        if (!haveCats.has(cat)) {
          trimmed.push({ focus: dim, category: cat });
          haveCats.add(cat);
          if (trimmed.length >= daysInWeek) break;
        }
      }
      if (trimmed.length >= daysInWeek) break;
    }
  }
  return trimmed.slice(0, daysInWeek);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise picking — pick 2 (or 3 for high-priority) distinct templates per day.
// ─────────────────────────────────────────────────────────────────────────────

function pickDayExercises({
  category,
  focus,
  difficulty,
  goal,
  rng,
  usedIds,
  count,
}: {
  category: ExerciseCategory;
  focus: DimensionKey;
  difficulty: ExerciseDifficulty;
  goal: PracticeGoalId;
  rng: () => number;
  usedIds: Set<string>;
  count: number;
}): ExerciseTemplate[] {
  // Three priority buckets so we always pick the most on-theme templates first.
  const all = EXERCISE_LIBRARY;
  const inCategory = all.filter((t) => t.category === category && !usedIds.has(t.id));
  const goalFiltered = inCategory.filter((t) => t.goalAffinity.length === 0 || t.goalAffinity.includes(goal));
  const difficultyMatched = goalFiltered.filter((t) => t.difficulty === difficulty);

  const buckets: ExerciseTemplate[][] = [difficultyMatched, goalFiltered, inCategory];

  const out: ExerciseTemplate[] = [];
  for (const bucket of buckets) {
    if (out.length >= count) break;
    for (const t of shuffle(bucket, rng)) {
      if (out.length >= count) break;
      if (usedIds.has(t.id)) continue;
      if (out.some((x) => x.id === t.id)) continue;
      out.push(t);
    }
  }

  // Final fallback: matching focus (across any category), if the themed category was thin.
  if (out.length < count) {
    const focusFallback = shuffle(
      all.filter((t) => t.focus === focus && !usedIds.has(t.id) && !out.some((x) => x.id === t.id)),
      rng,
    );
    for (const t of focusFallback) {
      if (out.length >= count) break;
      out.push(t);
    }
  }

  out.forEach((t) => usedIds.add(t.id));
  return out;
}

function dayTitleFor(category: ExerciseCategory, exercises: ExerciseTemplate[]): string {
  if (exercises.length === 0) return CATEGORY_LABELS[category];
  // Use the first exercise's title as the headline — these are written to be card-friendly already.
  return exercises[0]!.title;
}

function daySummaryFor(
  category: ExerciseCategory,
  focus: DimensionKey,
  exercises: ExerciseTemplate[],
): string {
  if (exercises.length === 0) {
    return `${CATEGORY_LABELS[category]} drills focused on ${focus.replace("_", " ")}.`;
  }
  if (exercises.length === 1) {
    return exercises[0]!.subtitle;
  }
  // Two-exercise mash-up: lead with the first subtitle, finish with a teaser of the second's coaching goal.
  return `${exercises[0]!.subtitle}, then ${exercises[1]!.title.toLowerCase()}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the week-shaped plan keyed on (userId, isoWeek, nonce). Same inputs → same plan, deterministically.
 * Bumping `regenerateNonce` (or letting the ISO week roll over) reshuffles content. Two distinct learners with the
 * same baseline scores get different plans because the user-id is mixed into the seed.
 */
export function buildWeekPlan(input: BuildWeekPlanInput): WeekPlan {
  const now = input.now ?? new Date();
  const isoWeek = isoWeekKey(now);
  const nonce = input.regenerateNonce ?? 0;
  const seed = fnv1aHash(`${input.userId}::${isoWeek}::${nonce}`);
  const rng = mulberry32(seed);

  const goal: PracticeGoalId = isPracticeGoalId(input.goalId) ? input.goalId : "general";
  const goalLabel: Record<PracticeGoalId, string> = {
    interview: "Interview prep",
    professional: "Professional speaking",
    academic: "Academic communication",
    general: "General confidence",
  };

  const weakest = rankWeakest(input.scores);
  const avg =
    (input.scores.pronunciation +
      input.scores.grammar +
      input.scores.fluency +
      input.scores.vocabulary +
      input.scores.filler_words +
      input.scores.pacing) /
    6;
  const difficulty = difficultyForAverage(avg);

  // 6-day plan: matches the 5–7-day spec; pairs cleanly with the seven weekday labels minus a rest day.
  const daysInWeek = 6;
  const rotation = planCategoryRotation({ weakest, goal, rng, daysInWeek });
  // Deterministically shuffle the rotation order so two learners with similar weaknesses get different orderings.
  const ordered = shuffle(rotation, rng);

  const usedIds = new Set<string>();
  const days: WeekDay[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const slot = ordered[i]!;
    // The first slot for the user's weakest dimension gets 3 exercises; others get 2 to keep the day under ~20 min.
    const wantCount = i === 0 ? 3 : 2;
    const exercises = pickDayExercises({
      category: slot.category,
      focus: slot.focus,
      difficulty,
      goal,
      rng,
      usedIds,
      count: wantCount,
    });
    if (exercises.length === 0) continue;
    const targetSec = exercises.reduce((a, t) => a + t.targetDurationSec, 0);
    const durationMin = Math.max(10, Math.round(targetSec / 60) + 2);
    days.push({
      day: DAY_LABELS[i % DAY_LABELS.length]!,
      weekdayIndex: i,
      category: slot.category,
      focus: slot.focus,
      difficulty,
      title: dayTitleFor(slot.category, exercises),
      summary: daySummaryFor(slot.category, slot.focus, exercises),
      durationMin,
      exercises,
    });
  }

  return {
    isoWeek,
    goalLabel: goalLabel[goal],
    weakestDims: weakest,
    days,
  };
}

/**
 * Resolves "today's session" out of the week plan. The default mapping uses the current weekday index into the
 * plan's array, so Monday → days[0], Tuesday → days[1], etc. If the plan is shorter than 7 days, weekend days fall
 * back to the closest earlier day so the learner can always practise.
 */
export function todaysExercises(plan: WeekPlan, now: Date = new Date()): {
  day: WeekDay | null;
  exercises: ExerciseTemplate[];
} {
  if (plan.days.length === 0) return { day: null, exercises: [] };
  const weekdayIdx = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const day = plan.days[Math.min(weekdayIdx, plan.days.length - 1)] ?? plan.days[0]!;
  return { day, exercises: day.exercises };
}
