"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

/** Theme switch for marketing/auth/onboarding pages outside the app shell. */
export function PublicPageThemeToggle({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center", className)}>
      <ModeToggle />
    </div>
  );
}
