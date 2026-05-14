"use client";

import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_USER_ID_COOKIE,
  AURAVO_USER_COOKIE_MAX_AGE_SEC,
} from "@/lib/auth/auravo-user-cookie-constants";

/** Mirrors anonymous learner id in the browser (same-origin). Server uses the same cookie name. */
export function setClientAuravoUserId(userId: string): void {
  if (typeof document === "undefined") return;
  const v = encodeURIComponent(userId);
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? ";secure" : "";
  document.cookie = `${AURAVO_USER_ID_COOKIE}=${v};path=/;max-age=${AURAVO_USER_COOKIE_MAX_AGE_SEC};samesite=lax${secure}`;
}

export function clearClientPendingBaselineSession(): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? ";secure" : "";
  document.cookie = `${AURAVO_PENDING_BASELINE_SESSION_COOKIE}=;path=/;max-age=0;samesite=lax${secure}`;
}
