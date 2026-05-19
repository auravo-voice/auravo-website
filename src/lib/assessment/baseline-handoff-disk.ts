import "server-only";

import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";
import { isUuidLike } from "@/lib/util/is-uuid-like";

/** One-shot handoff token in PocketBase (serverless-safe). */
export async function writeBaselineHandoffToken(sessionId: string, userId: string): Promise<void> {
  if (!isUuidLike(sessionId) || !isUuidLike(userId)) return;
  const pb = await getServerPocketBase();
  try {
    const existing = await pb.collection(PB.baselineHandoffs).getFirstListItem(
      `session = "${sessionId}"`,
    );
    await pb.collection(PB.baselineHandoffs).update(existing.id, { user: userId });
  } catch {
    await pb.collection(PB.baselineHandoffs).create({
      session: sessionId,
      user: userId,
    });
  }
}

export async function consumeBaselineHandoffUserId(sessionId: string): Promise<string | null> {
  if (!isUuidLike(sessionId)) return null;
  const pb = await getServerPocketBase();
  try {
    const row = await pb.collection(PB.baselineHandoffs).getFirstListItem(
      `session = "${sessionId}"`,
    );
    const userId = typeof row.user === "string" ? row.user : null;
    await pb.collection(PB.baselineHandoffs).delete(row.id);
    return userId && isUuidLike(userId) ? userId : null;
  } catch {
    return null;
  }
}
