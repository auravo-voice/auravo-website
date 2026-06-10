"use client";

import * as React from "react";

import { getTimeOfDayGreeting } from "@/lib/util/time-of-day-greeting";

/** Uses the browser clock so the greeting matches the user's local time zone. */
export function DashboardGreeting({
  displayName,
  className,
}: {
  displayName: string;
  className?: string;
}) {
  const [greeting, setGreeting] = React.useState<string | null>(null);

  React.useEffect(() => {
    setGreeting(getTimeOfDayGreeting(new Date().getHours()));
  }, []);

  return (
    <h1 className={className}>
      {greeting ? `${greeting}, ${displayName}` : `Hello, ${displayName}`}
    </h1>
  );
}
