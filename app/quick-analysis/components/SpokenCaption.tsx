"use client";

import { cn } from "@/lib/utils";

export function SpokenCaption({
  text,
  hint,
  className,
}: {
  text: string | null;
  hint?: string;
  className?: string;
}) {
  if (!text && !hint) return null;
  return (
    <div
      className={cn(
        "w-full max-w-lg rounded-3xl border border-white/12 bg-white/5 px-6 py-5 text-center shadow-[0_8px_40px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl",
        className,
      )}
    >
      {hint ? (
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-primary/80">{hint}</p>
      ) : null}
      {text ? (
        <p className={cn("text-base leading-relaxed text-foreground/95 sm:text-lg", hint && "mt-2")}>
          {text}
        </p>
      ) : null}
    </div>
  );
}
