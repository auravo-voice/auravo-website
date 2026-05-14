import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AURAVO_PENDING_BASELINE_SESSION_COOKIE } from "@/lib/auth/auravo-user-cookie-constants";
import { AURAVO_USER_ID_COOKIE, auravoUserIdCookieOptions } from "@/lib/auth/auravo-user-cookie";

export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // Never mint `auravo_user_id` on these requests — the route handler sets the real id (or Safari handoff POST).
  if (pathname.startsWith("/api/session/attach") || pathname === "/api/session/baseline-handoff") {
    return res;
  }
  if (pathname === "/api/assessment/complete" && request.method === "POST") {
    return res;
  }

  const hasUserCookie = Boolean(request.cookies.get(AURAVO_USER_ID_COOKIE)?.value);
  if (!hasUserCookie) {
    // Do not mint a throwaway id on the assessment → dashboard handoff: baseline is resolved from `?session=` or
    // `auravo_pending_baseline_session`, then the client mirrors `auravo_user_id`.
    const hasPendingBaseline = Boolean(request.cookies.get(AURAVO_PENDING_BASELINE_SESSION_COOKIE)?.value);
    const dashboardBaselineHandoff =
      pathname === "/dashboard" &&
      (request.nextUrl.searchParams.has("session") || hasPendingBaseline);
    if (!dashboardBaselineHandoff) {
      res.cookies.set(AURAVO_USER_ID_COOKIE, crypto.randomUUID(), auravoUserIdCookieOptions());
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
