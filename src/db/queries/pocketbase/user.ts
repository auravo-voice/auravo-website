import "server-only";

import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";
import { mapUserRecord } from "@/db/pocketbase-map";
import type { UserProfileRow } from "@/db/types";

export async function ensureUserProfile(
  userId: string,
  partial?: { displayName?: string; onboardingGoalId?: string | null },
): Promise<UserProfileRow> {
  const pb = await getServerPocketBase();
  const patch: Record<string, unknown> = {};
  if (partial?.displayName != null) {
    patch.display_name = partial.displayName;
    patch.name = partial.displayName;
  }
  if (partial?.onboardingGoalId !== undefined) {
    patch.onboarding_goal_id = partial.onboardingGoalId;
  }

  let record;
  try {
    record = await pb.collection(PB.users).getOne(userId);
    if (Object.keys(patch).length > 0) {
      record = await pb.collection(PB.users).update(userId, patch);
    }
  } catch {
    record = await pb.collection(PB.users).getOne(userId);
  }
  return mapUserRecord(record);
}
