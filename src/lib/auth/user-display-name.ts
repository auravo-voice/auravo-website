import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { userProfile } from "@/db/schema";
import { mapUserRecord } from "@/db/pocketbase-map";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { isPocketBaseAuthEnabled, isSqliteStorage } from "@/lib/storage/env";
import { getServerPocketBase } from "@/lib/pocketbase/server";

/** Display name for the signed-in learner. */
export async function getAuthUserDisplayName(): Promise<string | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  if (isPocketBaseAuthEnabled() && !isSqliteStorage()) {
    try {
      const pb = await getServerPocketBase();
      if (pb.authStore.isValid && pb.authStore.record?.id === userId) {
        return mapUserRecord(pb.authStore.record).displayName;
      }
    } catch {
      /* fall through */
    }
  }

  if (isSqliteStorage()) {
    const db = getDb();
    const rows = await db
      .select({ displayName: userProfile.displayName })
      .from(userProfile)
      .where(eq(userProfile.id, userId))
      .limit(1);
    const name = rows[0]?.displayName?.trim();
    if (name) return name;
  }

  if (isPocketBaseAuthEnabled()) {
    try {
      const pb = await getServerPocketBase();
      const record = await pb.collection("users").getOne(userId);
      return mapUserRecord(record).displayName;
    } catch {
      /* ignore */
    }
  }

  return "Learner";
}
