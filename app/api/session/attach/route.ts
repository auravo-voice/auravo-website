import { NextResponse } from "next/server";
import { getUserIdForOnboardingPracticeSession } from "@/db/queries/baseline";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  auravoPendingBaselineSessionCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { isUuidLike } from "@/lib/util/is-uuid-like";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * After baseline upload, sets the pending baseline session cookie when the signed-in user owns the session.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
  const dest = new URL("/dashboard", url.origin);

  if (!isUuidLike(sessionId)) {
    return NextResponse.redirect(dest);
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("redirect", `/api/session/attach?sessionId=${encodeURIComponent(sessionId)}`);
    return NextResponse.redirect(login);
  }

  const ownerId = await getUserIdForOnboardingPracticeSession(sessionId);
  if (!ownerId || ownerId !== userId) {
    return NextResponse.redirect(dest);
  }

  const res = NextResponse.redirect(dest);
  res.cookies.set(AURAVO_PENDING_BASELINE_SESSION_COOKIE, sessionId, auravoPendingBaselineSessionCookieOptions());
  return res;
}
