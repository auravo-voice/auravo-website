"use client";

import * as React from "react";
import { clearClientPendingBaselineSession, setClientAuravoUserId } from "@/lib/auth/set-auravo-user-cookie-client";

/**
 * After baseline handoff, mirror the learner id into `document.cookie`, clear the short-lived pending-session cookie,
 * then **full**-navigate to `/dashboard` (no query). Avoids soft router refresh racing the cookie jar.
 */
export function DashboardSessionUrlCleanup({ userId, active }: { userId: string; active: boolean }) {
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (!active) return;
    if (ran.current) return;
    ran.current = true;
    setClientAuravoUserId(userId);
    clearClientPendingBaselineSession();
    window.setTimeout(() => {
      window.location.assign("/dashboard");
    }, 80);
  }, [userId, active]);

  return null;
}
