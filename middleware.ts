import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_USER_ID_COOKIE,
  AURAVO_USER_COOKIE_MAX_AGE_SEC,
} from "@/lib/auth/auravo-user-cookie-constants";

/**
 * Keep this file self-contained for the Edge bundle (Vercel + Next 16): avoid importing
 * `@/lib/auth/auravo-user-cookie` here so the bundler cannot pull extra modules into middleware.
 * Options mirror `auravoUserIdCookieOptions()` in that module.
 */
function userIdCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AURAVO_USER_COOKIE_MAX_AGE_SEC,
  };
}

export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/session/attach") || pathname === "/api/session/baseline-handoff") {
    return res;
  }
  if (pathname === "/api/assessment/complete" && request.method === "POST") {
    return res;
  }

  const hasUserCookie = Boolean(request.cookies.get(AURAVO_USER_ID_COOKIE)?.value);
  if (!hasUserCookie) {
    const hasPendingBaseline = Boolean(request.cookies.get(AURAVO_PENDING_BASELINE_SESSION_COOKIE)?.value);
    const dashboardBaselineHandoff =
      pathname === "/dashboard" &&
      (request.nextUrl.searchParams.has("session") || hasPendingBaseline);
    if (!dashboardBaselineHandoff) {
      res.cookies.set(AURAVO_USER_ID_COOKIE, crypto.randomUUID(), userIdCookieOptions());
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
