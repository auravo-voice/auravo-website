import { NextResponse } from "next/server";
import { getUserIdForOnboardingPracticeSession } from "@/db/queries/baseline";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_USER_ID_COOKIE,
  auravoPendingBaselineSessionCookieOptions,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { isUuidLike } from "@/lib/util/is-uuid-like";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Binds `auravo_user_id` to the owner of a saved onboarding session. Use after baseline upload so the dashboard
 * always loads the same SQLite user even if the browser never stored the cookie from the POST response.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
  const dest = new URL("/dashboard", url.origin);

  if (!isUuidLike(sessionId)) {
    return NextResponse.redirect(dest);
  }

  const userId = await getUserIdForOnboardingPracticeSession(sessionId);
  if (!userId) {
    return NextResponse.redirect(dest);
  }

  const res = NextResponse.redirect(dest);
  res.cookies.set(AURAVO_PENDING_BASELINE_SESSION_COOKIE, sessionId, auravoPendingBaselineSessionCookieOptions());
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  return res;
}
