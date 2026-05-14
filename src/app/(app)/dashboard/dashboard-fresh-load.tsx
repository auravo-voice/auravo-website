"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

/** Legacy `?from=assessment` (without `session`) — hard navigation so RSC does not soft-refresh with a stale cookie. */
export function DashboardFreshLoad() {
  const searchParams = useSearchParams();
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return;
    if (searchParams.get("from") !== "assessment") return;
    if (searchParams.get("session")) return;
    ran.current = true;
    window.location.replace("/dashboard");
  }, [searchParams]);

  return null;
}
