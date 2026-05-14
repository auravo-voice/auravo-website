"use client";

import * as React from "react";
import { AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY } from "@/lib/auth/auravo-user-cookie-constants";
import { clearClientPendingBaselineSession, setClientAuravoUserId } from "@/lib/auth/set-auravo-user-cookie-client";
import { isUuidLike } from "@/lib/util/is-uuid-like";

/**
 * After assessment, Safari may drop `Set-Cookie` from the multipart `fetch` before `location.assign`.
 * We stash `sessionId` in `sessionStorage`, POST here to apply `auravo_user_id`, then hard-reload the dashboard.
 */
export function DashboardBaselineHandoffBootstrap() {
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return;
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let sessionId: string | null = null;
    let handoffUserId: string | null = null;
    try {
      const o = JSON.parse(raw) as unknown;
      if (o && typeof o === "object") {
        if (typeof (o as { sessionId?: unknown }).sessionId === "string") {
          sessionId = (o as { sessionId: string }).sessionId.trim();
        }
        if (typeof (o as { userId?: unknown }).userId === "string") {
          handoffUserId = (o as { userId: string }).userId.trim();
        }
      }
    } catch {
      try {
        window.sessionStorage.removeItem(AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    if (!sessionId || !isUuidLike(sessionId)) {
      try {
        window.sessionStorage.removeItem(AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    ran.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/session/baseline-handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sessionId,
            ...(handoffUserId && isUuidLike(handoffUserId) ? { userId: handoffUserId } : {}),
          }),
        });
        if (res.ok) {
          try {
            const payload = (await res.json()) as unknown;
            if (payload && typeof payload === "object" && typeof (payload as { userId?: unknown }).userId === "string") {
              setClientAuravoUserId((payload as { userId: string }).userId);
            }
          } catch {
            /* ignore */
          }
          try {
            window.sessionStorage.removeItem(AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          clearClientPendingBaselineSession();
          window.location.replace("/dashboard");
          return;
        }
        if (res.status === 404) {
          try {
            window.sessionStorage.removeItem(AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* network — leave storage; user can refresh */
      }
      ran.current = false;
    })();
  }, []);

  return null;
}
