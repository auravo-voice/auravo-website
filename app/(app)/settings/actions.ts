"use server";

import { revalidatePath } from "next/cache";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";
import { ensureUserProfile } from "@/db/queries/user";
import { getAuthenticatedUserId } from "@/lib/auth/session";

export type UpdateOnboardingGoalResult =
  | { ok: true; goalId: string }
  | { ok: false; error: string };

/**
 * Persists the learner's primary goal (Step 1 of the onboarding flow) to `user_profile`.
 */
export async function updateOnboardingGoal(formData: FormData): Promise<UpdateOnboardingGoalResult> {
  const rawGoal = formData.get("goalId");
  const goalId = typeof rawGoal === "string" ? rawGoal.trim() : "";
  if (!isOnboardingGoalId(goalId)) {
    return { ok: false, error: "Pick one of the four primary goals before saving." };
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { ok: false, error: "Sign in to save your goal." };
  }

  await ensureUserProfile(userId, { onboardingGoalId: goalId });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true, goalId };
}
