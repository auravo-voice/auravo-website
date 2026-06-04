import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_USER_ID_COOKIE,
  AURAVO_USER_COOKIE_MAX_AGE_SEC,
} from "@/lib/auth/auravo-user-cookie-constants";

/** Must match `PB_AUTH_COOKIE` in `@/lib/pocketbase` (duplicated here for Edge bundle). */
const PB_AUTH_COOKIE = "pb_auth";

/**
 * Keep this file self-contained for the Edge bundle (Vercel + Next 16): avoid importing
 * modules that pull in Node-only code (PocketBase, SQLite, etc.).
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

function isPocketBaseStorageMode(): boolean {
  const raw = process.env.AURAVO_STORAGE?.trim().toLowerCase();
  return raw === "pocketbase" || raw === "pb";
}

export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // Quick Analysis demo + public APIs (analyze, submit, tts)
  if (
    pathname.startsWith("/quick-analysis") ||
    pathname.startsWith("/api/quick-analysis")
  ) {
    return res;
  }

  if (pathname.startsWith("/api/session/attach") || pathname === "/api/session/baseline-handoff") {
    return res;
  }
  if (pathname === "/api/assessment/complete" && request.method === "POST") {
    return res;
  }

  // Full PocketBase storage: auth is required via `pb_auth` — do not mint anonymous ids.
  if (isPocketBaseStorageMode()) {
    return res;
  }

  const hasPbAuth = Boolean(request.cookies.get(PB_AUTH_COOKIE)?.value);
  const hasUserCookie = Boolean(request.cookies.get(AURAVO_USER_ID_COOKIE)?.value);
  if (!hasUserCookie && !hasPbAuth) {
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
