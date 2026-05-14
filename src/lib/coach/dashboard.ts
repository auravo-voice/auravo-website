import "server-only";
import { ONBOARDING_GOALS } from "@/data/onboarding-goals";

const GOAL_IDS = new Set<string>(ONBOARDING_GOALS.map((g) => g.id));

export type OnboardingGoalId = (typeof ONBOARDING_GOALS)[number]["id"];

export function isOnboardingGoalId(id: string | undefined): id is OnboardingGoalId {
  return id != null && GOAL_IDS.has(id);
}

export function getOnboardingGoalLabel(goalId: string | null | undefined): string | undefined {
  if (!goalId || !GOAL_IDS.has(goalId)) return undefined;
  return ONBOARDING_GOALS.find((g) => g.id === goalId)?.title;
}
