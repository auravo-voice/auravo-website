import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { userProfile } from "@/db/schema";

export async function ensureUserProfile(userId: string, partial?: { displayName?: string; onboardingGoalId?: string | null }) {
  const db = getDb();
  const now = Date.now();
  const existing = await db.select().from(userProfile).where(eq(userProfile.id, userId)).limit(1);
  if (existing[0]) {
    if (partial?.displayName != null || partial?.onboardingGoalId !== undefined) {
      await db
        .update(userProfile)
        .set({
          ...(partial.displayName != null ? { displayName: partial.displayName } : {}),
          ...(partial.onboardingGoalId !== undefined ? { onboardingGoalId: partial.onboardingGoalId } : {}),
          updatedAt: now,
        })
        .where(eq(userProfile.id, userId));
    }
    const u = await db.select().from(userProfile).where(eq(userProfile.id, userId)).limit(1);
    return u[0]!;
  }
  await db.insert(userProfile).values({
    id: userId,
    displayName: partial?.displayName ?? "Learner",
    onboardingGoalId: partial?.onboardingGoalId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const u = await db.select().from(userProfile).where(eq(userProfile.id, userId)).limit(1);
  return u[0]!;
}
