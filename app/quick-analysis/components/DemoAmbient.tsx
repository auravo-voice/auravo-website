"use client";

import { cn } from "@/lib/utils";

/** Theme-aware page glow — uses `--glow` from globals.css (light / .dark). */
export function DemoAmbient({ className }: { className?: string }) {
  return (
    <div
      className={cn("ambient-glow pointer-events-none fixed inset-0 -z-10", className)}
      aria-hidden
    />
  );
}
