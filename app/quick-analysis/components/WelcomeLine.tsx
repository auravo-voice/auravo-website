"use client";

import { cn } from "@/lib/utils";

export function WelcomeLine({
  text,
  delay,
  active,
}: {
  text: string;
  delay: number;
  active: boolean;
}) {
  return (
    <p
      className={cn(
        "text-center text-base leading-relaxed text-foreground transition-all duration-700 sm:text-lg",
        active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
      style={{ transitionDelay: active ? `${delay}s` : "0s" }}
    >
      {text}
    </p>
  );
}
