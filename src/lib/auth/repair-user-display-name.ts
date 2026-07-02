import "server-only";

import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import { PB } from "@/db/collections";
import { ensureUserProfile } from "@/db/queries/user";
import { resolveOAuthDisplayNameUpdate } from "@/lib/auth/display-name";
import { isSqliteStorage } from "@/lib/storage/env";

type UserRecord = RecordModel & {
  name?: string;
  display_name?: string;
  email?: string;
};

/**
 * OAuth callback: upgrade replaceable display names from Google profile metadata,
 * or repair numeric-only values. Syncs SQLite `user_profile` when applicable.
 */
export async function repairUserDisplayNameIfNeeded(
  pb: PocketBase,
  record: UserRecord,
  options?: { googleProfileName?: string | null },
): Promise<UserRecord> {
  const repaired = resolveOAuthDisplayNameUpdate({
    name: record.name,
    display_name: record.display_name,
    email: record.email,
    googleProfileName: options?.googleProfileName,
  });
  if (!repaired) return record;

  try {
    await pb.collection(PB.users).update(record.id, {
      name: repaired,
      display_name: repaired,
    });
  } catch (e) {
    console.error("[auth] failed to repair display name for user", record.id, e);
    return record;
  }

  const updated: UserRecord = { ...record, name: repaired, display_name: repaired };
  if (isSqliteStorage()) {
    await ensureUserProfile(record.id, { displayName: repaired });
  }
  return updated;
}
