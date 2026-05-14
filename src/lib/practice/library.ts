/**
 * Back-compat shim. The original `PRACTICE_LIBRARY` + `pickTodaysPrompts` lived here; the rich template pool now
 * lives in `./exercises.ts` and the deterministic per-user week plan in `./week-plan.ts`. This module exists only
 * so existing imports (most importantly `/api/practice/exercise/route.ts`) keep resolving without churn.
 *
 * Prefer importing from `./exercises` or `./week-plan` directly in new code.
 */
export {
  EXERCISE_LIBRARY as PRACTICE_LIBRARY,
  getExerciseById,
  isPracticeGoalId,
  type ExerciseTemplate as PracticePrompt,
  type ExerciseCategory,
  type ExerciseDifficulty,
  type PracticeGoalId,
} from "./exercises";

export { buildWeekPlan, todaysExercises, isoWeekKey, type WeekDay, type WeekPlan } from "./week-plan";
