"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  stepLabel?: string;
  question: string;
  recording: boolean;
  analyzing?: boolean;
  analysisStatus?: string | null;
  onToggleRecord: () => void;
  transcript?: string | null;
  lowConfidenceWords?: string[];
  maxDurationSec?: number;
  children?: React.ReactNode;
};

export function QuestionStep({
  stepLabel,
  question,
  recording,
  analyzing = false,
  analysisStatus,
  onToggleRecord,
  transcript,
  lowConfidenceWords,
  children,
}: Props) {
  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
      {stepLabel ? (
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{stepLabel}</p>
      ) : null}
      <h2 className="font-display text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
        {question}
      </h2>
      {children}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onToggleRecord}
          disabled={analyzing}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={cn(
            "relative flex size-24 items-center justify-center rounded-full border-2 transition-all",
            recording
              ? "border-destructive bg-destructive/15 shadow-[0_0_32px_-4px_rgba(239,68,68,0.5)]"
              : "border-primary/50 bg-primary/10 hover:border-primary hover:bg-primary/20",
            analyzing && "pointer-events-none opacity-60",
          )}
        >
          {recording ? (
            <span className="absolute right-6 top-6 flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-destructive" />
            </span>
          ) : null}
          <Mic className={cn("size-10", recording ? "text-destructive" : "text-primary")} />
        </button>
        <p className="text-sm text-muted-foreground">
          {analyzing
            ? analysisStatus ?? "Analyzing your answer…"
            : recording
              ? "Tap again to stop"
              : "Tap to start speaking"}
        </p>
      </div>
      {transcript ? (
        <div className="w-full rounded-xl border border-border/60 bg-muted/15 p-4 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">We heard</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{transcript}</p>
          {lowConfidenceWords && lowConfidenceWords.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Less clear words: {lowConfidenceWords.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
