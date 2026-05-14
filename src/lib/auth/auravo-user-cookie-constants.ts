/** Shared between server and client (no `server-only`, no `process.env`). */
export const AURAVO_USER_ID_COOKIE = "auravo_user_id";

/** Short-lived handoff after POST /api/assessment/complete so `/dashboard` can resolve baseline without relying on `?session=` (RSC prefetch can omit search params). */
export const AURAVO_PENDING_BASELINE_SESSION_COOKIE = "auravo_pending_baseline_session";

/** ~400 days, matches server `maxAge`. */
export const AURAVO_USER_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

/** Long enough to survive a slow transcription; cleared on dashboard handoff. */
export const AURAVO_PENDING_BASELINE_SESSION_MAX_AGE_SEC = 60 * 30;

/** Client-only: survives Safari quirks with `Set-Cookie` on multipart `fetch` before navigation. */
export const AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY = "auravo_baseline_handoff_v1";
