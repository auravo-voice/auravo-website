import "server-only";

import { mapUserRecord } from "@/db/pocketbase-map";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getAuthUserDisplayName } from "@/lib/auth/user-display-name";
import { getServerPocketBase } from "@/lib/pocketbase/server";
import { isPocketBaseAuthEnabled } from "@/lib/storage/env";

export type AuthSessionUser = {
  id: string;
  displayName: string;
  email: string | null;
};

export type AuthSessionSnapshot = {
  user: AuthSessionUser | null;
  /** True when a valid PocketBase `pb_auth` cookie is present (email/OAuth sign-in). */
  pocketBaseAuth: boolean;
};

/** Canonical server-side auth state for layouts and `/api/auth/session`. */
export async function getAuthSessionSnapshot(): Promise<AuthSessionSnapshot> {
  if (isPocketBaseAuthEnabled()) {
    try {
      const pb = await getServerPocketBase();
      const record = pb.authStore.isValid ? pb.authStore.record : null;
      if (record?.id) {
        const mapped = mapUserRecord(record);
        const displayName = mapped.displayName || (await getAuthUserDisplayName()) || "Learner";
        const email = typeof record.email === "string" ? record.email : null;
        return {
          user: { id: record.id, displayName, email },
          pocketBaseAuth: true,
        };
      }
    } catch {
      /* PB unreachable — fall through to local cookie */
    }
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { user: null, pocketBaseAuth: false };
  }

  const displayName = (await getAuthUserDisplayName()) ?? "Learner";
  return {
    user: { id: userId, displayName, email: null },
    pocketBaseAuth: false,
  };
}
