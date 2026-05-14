import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "@/db/client";
import { isUuidLike } from "@/lib/util/is-uuid-like";

const REL = ".baseline-handoff";

function tokenPath(sessionId: string): string {
  return path.join(getDataDir(), REL, `${sessionId}.json`);
}

/** Written after a successful assessment save so `/api/session/baseline-handoff` can bind cookies even if SQLite reads race across dev workers. */
export function writeBaselineHandoffToken(sessionId: string, userId: string): void {
  if (!isUuidLike(sessionId) || !isUuidLike(userId)) return;
  const dir = path.join(getDataDir(), REL);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokenPath(sessionId), JSON.stringify({ userId, ts: Date.now() }), "utf8");
}

/** Returns `userId` and deletes the token file (one-shot). */
export function consumeBaselineHandoffUserId(sessionId: string): string | null {
  if (!isUuidLike(sessionId)) return null;
  const p = tokenPath(sessionId);
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    const o = JSON.parse(raw) as { userId?: unknown };
    const userId = typeof o.userId === "string" ? o.userId.trim() : "";
    try {
      fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
    return isUuidLike(userId) ? userId : null;
  } catch {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
    return null;
  }
}
