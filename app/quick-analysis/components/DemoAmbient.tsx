"use client";

import { cn } from "@/lib/utils";

export function DemoAmbient({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)} aria-hidden>
      <div className="absolute -left-1/4 -top-1/4 h-[70vh] w-[70vw] rounded-full bg-primary/25 blur-[120px]" />
      <div className="absolute -right-1/4 top-1/3 h-[55vh] w-[55vw] rounded-full bg-amber-500/20 blur-[140px]" />
      <div className="absolute -bottom-1/4 left-1/4 h-[50vh] w-[50vw] rounded-full bg-red-600/15 blur-[100px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(255,102,0,0.18),transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  );
}
