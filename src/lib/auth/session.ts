import "server-only";

import { getServerPocketBase } from "@/lib/pocketbase/server";

/** Authenticated PocketBase user id, or null when logged out. */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const pb = await getServerPocketBase();
  if (!pb.authStore.isValid || !pb.authStore.record?.id) return null;
  return pb.authStore.record.id;
}

/** @deprecated Use {@link getAuthenticatedUserId}. */
export async function getLocalUserId(): Promise<string | null> {
  return getAuthenticatedUserId();
}
