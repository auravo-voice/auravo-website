import "server-only";

import { ensureUserProfile } from "@/db/queries/user";
import { getLocalUserId } from "@/lib/auth/local-user-id";
import { isPocketBaseAuthEnabled, isSqliteStorage } from "@/lib/storage/env";
import { isRecordId } from "@/lib/util/is-uuid-like";
import { getServerPocketBase } from "@/lib/pocketbase/server";
import { mapUserRecord } from "@/db/pocketbase-map";

/**
 * Active learner id for API routes and server components.
 * - PocketBase auth (Google/email) when `NEXT_PUBLIC_POCKETBASE_URL` is set and `pb_auth` is valid.
 * - Otherwise the local `auravo_user_id` cookie (SQLite anonymous or synced after OAuth).
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  if (isPocketBaseAuthEnabled()) {
    try {
      const pb = await getServerPocketBase();
      if (pb.authStore.isValid && pb.authStore.record?.id) {
        const id = pb.authStore.record.id;
        if (isSqliteStorage()) {
          const mapped = mapUserRecord(pb.authStore.record);
          await ensureUserProfile(id, {
            displayName: mapped.displayName,
            onboardingGoalId: mapped.onboardingGoalId,
          });
        }
        return id;
      }
    } catch {
      /* PB unreachable — fall through to local cookie */
    }
  }

  const local = await getLocalUserId();
  if (local && isRecordId(local)) return local;
  return null;
}

/** @deprecated Use {@link getAuthenticatedUserId}. */
export async function getLocalUserIdFromSession(): Promise<string | null> {
  return getAuthenticatedUserId();
}
