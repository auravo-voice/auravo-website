import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { EXERCISE_LIBRARY, type ExerciseTemplate } from "./exercises";
import type { WeekPlan } from "./week-plan";

/**
 * Recommendation payload passed to the final-summary LLM. Only structured fields go in — the model
 * must reference these exercises by `id`, it cannot invent new names.
 */
export type RecommendedExercise = Pick<
  ExerciseTemplate,
  "id" | "title" | "subtitle" | "category" | "focus" | "coachingGoal"
> & {
  /** Trimmed prompt preview so the LLM can phrase a rationale without bloating its context window. */
  promptPreview: string;
};

const PROMPT_PREVIEW_CHARS = 220;

function toRecommended(t: ExerciseTemplate): RecommendedExercise {
  return {
    id: t.id,
    title: t.title,
    subtitle: t.subtitle,
    category: t.category,
    focus: t.focus,
    coachingGoal: t.coachingGoal,
    promptPreview:
      t.promptText.length <= PROMPT_PREVIEW_CHARS
        ? t.promptText
        : `${t.promptText.slice(0, PROMPT_PREVIEW_CHARS - 1).trimEnd()}…`,
  };
}

/** Rank dimensions by score, ascending (weakest first). Ties resolved by a stable order. */
export function rankWeakestDimensions(scores: SixDimensionScores): DimensionKey[] {
  const STABLE_ORDER: DimensionKey[] = [
    "pronunciation",
    "grammar",
    "fluency",
    "vocabulary",
    "filler_words",
    "pacing",
  ];
  return STABLE_ORDER.slice().sort((a, b) => scores[a] - scores[b]);
}

/**
 * Pick 2–3 exercises that address the weakest dimensions. Preference order:
 *   1. Exercises already in this week's plan that target the weakest dim.
 *   2. Exercises in the plan that target the second-weakest dim.
 *   3. Library exercises focused on the weakest dim (if the plan covered none).
 *   4. Library exercises focused on the second/third-weakest dim.
 *
 * Always returns at least one entry as long as `EXERCISE_LIBRARY` is non-empty.
 */
export function pickRecommendedExercises(input: {
  scores: SixDimensionScores;
  weekPlan: WeekPlan | null;
  /** Skip these IDs (e.g. ones the user just completed). */
  excludeIds?: string[];
  count?: number;
}): RecommendedExercise[] {
  const desired = Math.max(2, Math.min(4, input.count ?? 3));
  const excluded = new Set(input.excludeIds ?? []);
  const weakest = rankWeakestDimensions(input.scores);

  const fromPlan: ExerciseTemplate[] = [];
  if (input.weekPlan) {
    for (const day of input.weekPlan.days) {
      for (const ex of day.exercises) {
        if (excluded.has(ex.id)) continue;
        if (fromPlan.some((x) => x.id === ex.id)) continue;
        fromPlan.push(ex);
      }
    }
  }

  const picked: ExerciseTemplate[] = [];
  const seen = new Set<string>();

  for (const dim of weakest) {
    if (picked.length >= desired) break;
    const planMatches = fromPlan.filter((t) => t.focus === dim && !seen.has(t.id));
    for (const t of planMatches) {
      if (picked.length >= desired) break;
      picked.push(t);
      seen.add(t.id);
    }
  }

  if (picked.length < desired) {
    for (const dim of weakest) {
      if (picked.length >= desired) break;
      const libMatches = EXERCISE_LIBRARY.filter(
        (t) => t.focus === dim && !seen.has(t.id) && !excluded.has(t.id),
      );
      for (const t of libMatches) {
        if (picked.length >= desired) break;
        picked.push(t);
        seen.add(t.id);
      }
    }
  }

  if (picked.length === 0 && EXERCISE_LIBRARY.length > 0) {
    picked.push(EXERCISE_LIBRARY[0]!);
  }

  return picked.map(toRecommended);
}

/**
 * Validates that every supplied id exists in the pool. Used after the LLM returns its recommendation set
 * — if any id is unknown we reject the entire response and fall back to the deterministic picker so the
 * UI never shows a non-clickable exercise card.
 */
export function isValidRecommendationSet(ids: string[], pool: RecommendedExercise[]): boolean {
  if (!Array.isArray(ids) || ids.length === 0) return false;
  const allowed = new Set(pool.map((p) => p.id));
  for (const id of ids) {
    if (typeof id !== "string" || !allowed.has(id)) return false;
  }
  return true;
}
