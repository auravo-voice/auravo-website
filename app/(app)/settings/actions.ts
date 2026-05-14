"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AURAVO_USER_ID_COOKIE, auravoUserIdCookieOptions } from "@/lib/auth/auravo-user-cookie";
import { isUuidLike } from "@/lib/util/is-uuid-like";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";
import { ensureUserProfile } from "@/db/queries/user";
import { randomUUID } from "node:crypto";

export type UpdateOnboardingGoalResult =
  | { ok: true; goalId: string }
  | { ok: false; error: string };

/**
 * Persists the learner's primary goal (Step 1 of the onboarding flow) to `user_profile`.
 * Minted anonymous id is created on the fly if the visitor lands on Settings before onboarding.
 */
export async function updateOnboardingGoal(formData: FormData): Promise<UpdateOnboardingGoalResult> {
  const rawGoal = formData.get("goalId");
  const goalId = typeof rawGoal === "string" ? rawGoal.trim() : "";
  if (!isOnboardingGoalId(goalId)) {
    return { ok: false, error: "Pick one of the four primary goals before saving." };
  }

  const cookieStore = await cookies();
  let userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value ?? "";
  if (!isUuidLike(userId)) {
    userId = randomUUID();
    cookieStore.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  }

  await ensureUserProfile(userId, { onboardingGoalId: goalId });
  // Dashboard reads the goal for narrative + radar context; clear its cache so the new goal lands immediately.
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true, goalId };
}
