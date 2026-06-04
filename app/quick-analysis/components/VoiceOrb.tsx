"use client";

import { Loader2, Mic, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type OrbMode = "idle" | "speaking" | "listening" | "thinking";

export function VoiceOrb({ mode, className }: { mode: OrbMode; className?: string }) {
  const listening = mode === "listening";
  const speaking = mode === "speaking";
  const thinking = mode === "thinking";

  return (
    <div className={cn("relative flex size-44 items-center justify-center sm:size-52", className)}>
      <span
        className={cn(
          "absolute inset-0 rounded-full transition-opacity duration-500",
          speaking && "animate-ping bg-primary/15 opacity-70",
          listening && "animate-ping bg-destructive/15 opacity-70",
          thinking && "animate-ping bg-amber-400/15 opacity-70",
          mode === "idle" && "opacity-0",
        )}
        style={{ animationDuration: "3s" }}
      />
      <span
        className={cn(
          "absolute inset-4 rounded-full transition-all duration-700",
          speaking && "animate-pulse bg-primary/20 shadow-[0_0_80px_-8px_rgba(255,102,0,0.7)]",
          listening && "animate-pulse bg-destructive/20 shadow-[0_0_80px_-8px_rgba(239,68,68,0.6)]",
          thinking && "animate-pulse bg-amber-400/20 shadow-[0_0_80px_-8px_rgba(251,191,36,0.5)]",
          mode === "idle" && "bg-primary/8 shadow-[0_0_40px_-8px_rgba(255,102,0,0.3)]",
        )}
        style={{ animationDuration: speaking ? "2s" : "1.6s" }}
      />
      <span
        className={cn(
          "absolute inset-8 rounded-full border border-white/15 backdrop-blur-md transition-all duration-500",
          speaking && "bg-gradient-to-br from-primary/50 via-primary/25 to-transparent",
          listening && "bg-gradient-to-br from-destructive/45 via-destructive/20 to-transparent",
          thinking && "bg-gradient-to-br from-amber-400/40 via-amber-400/15 to-transparent",
          mode === "idle" && "bg-gradient-to-br from-primary/30 via-background/20 to-transparent",
        )}
      />
      <span className="relative flex size-16 items-center justify-center rounded-full border border-white/20 bg-background/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
        {listening ? (
          <Mic className="size-7 text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        ) : thinking ? (
          <Loader2 className="size-7 animate-spin text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
        ) : (
          <Volume2
            className={cn(
              "size-7 drop-shadow-[0_0_8px_rgba(255,102,0,0.8)]",
              speaking ? "text-primary" : "text-primary/70",
            )}
          />
        )}
      </span>
    </div>
  );
}
