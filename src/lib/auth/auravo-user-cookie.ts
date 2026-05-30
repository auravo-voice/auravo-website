import {
  AURAVO_PENDING_BASELINE_SESSION_MAX_AGE_SEC,
  AURAVO_USER_COOKIE_MAX_AGE_SEC,
} from "@/lib/auth/auravo-user-cookie-constants";
import { getAuravoCookieDomain } from "@/lib/auth/cookie-domain";

export {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_PENDING_BASELINE_SESSION_MAX_AGE_SEC,
  AURAVO_USER_ID_COOKIE,
  AURAVO_USER_COOKIE_MAX_AGE_SEC,
} from "@/lib/auth/auravo-user-cookie-constants";

function sharedCookieFields() {
  const domain = getAuravoCookieDomain();
  return {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

/** `httpOnly: false` so the browser can mirror this cookie via JS after save (Next `Set-Cookie` on fetch/redirect is flaky). Anonymous id only—do not use for privileged auth. */
export function auravoUserIdCookieOptions() {
  return {
    ...sharedCookieFields(),
    httpOnly: false,
    maxAge: AURAVO_USER_COOKIE_MAX_AGE_SEC,
  };
}

/** Non-httpOnly so the client can clear it after mirroring `auravo_user_id`. */
export function auravoPendingBaselineSessionCookieOptions() {
  return {
    ...sharedCookieFields(),
    httpOnly: false,
    maxAge: AURAVO_PENDING_BASELINE_SESSION_MAX_AGE_SEC,
  };
}
