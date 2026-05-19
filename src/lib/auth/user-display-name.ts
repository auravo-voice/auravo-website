import "server-only";

import { mapUserRecord } from "@/db/pocketbase-map";
import { PB } from "@/db/collections";
import { getServerPocketBase } from "@/lib/pocketbase/server";

/** Display name for the signed-in PocketBase user (`name`, `display_name`, or email local-part). */
export async function getAuthUserDisplayName(): Promise<string | null> {
  const pb = await getServerPocketBase();
  const authRecord = pb.authStore.record;
  if (!pb.authStore.isValid || !authRecord?.id) return null;

  try {
    const record = await pb.collection(PB.users).getOne(authRecord.id);
    return mapUserRecord(record).displayName;
  } catch {
    return mapUserRecord(authRecord).displayName;
  }
}
