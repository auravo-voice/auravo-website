"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { SpokenCaption } from "./SpokenCaption";
import { VoiceOrb } from "./VoiceOrb";
import { cn } from "@/lib/utils";

type Props = {
  stepLabel?: string;
  /** Shown as live caption while coach speaks — not as a static heading. */
  spokenPrompt: string;
  coachSpeaking?: boolean;
  recording: boolean;
  analyzing?: boolean;
  analysisStatus?: string | null;
  onToggleRecord: () => void;
  maxDurationSec?: number;
  children?: React.ReactNode;
};

export function QuestionStep({
  stepLabel,
  spokenPrompt,
  coachSpeaking = false,
  recording,
  analyzing = false,
  analysisStatus,
  onToggleRecord,
  children,
}: Props) {
  const orbMode = analyzing ? "thinking" : recording ? "listening" : coachSpeaking ? "speaking" : "idle";

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-6">
      {stepLabel ? (
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">{stepLabel}</p>
      ) : null}

      <VoiceOrb mode={orbMode} />

      <SpokenCaption
        text={coachSpeaking ? spokenPrompt : recording ? "Listening…" : analyzing ? analysisStatus ?? "Analyzing…" : spokenPrompt}
        hint={coachSpeaking ? "Auravo coach" : recording ? "Your turn" : analyzing ? "Processing" : "Ready when you are"}
      />

      {children}

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onToggleRecord}
          disabled={analyzing || coachSpeaking}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={cn(
            "group relative flex size-20 items-center justify-center rounded-full border-2 transition-all duration-300",
            recording
              ? "border-destructive bg-destructive/20 shadow-[0_0_60px_-4px_rgba(239,68,68,0.7)]"
              : "border-primary/60 bg-primary/15 shadow-[0_0_40px_-8px_rgba(255,102,0,0.5)] hover:border-primary hover:bg-primary/25 hover:shadow-[0_0_60px_-4px_rgba(255,102,0,0.7)]",
            (analyzing || coachSpeaking) && "pointer-events-none opacity-40",
          )}
        >
          {recording ? (
            <>
              <span className="absolute inset-0 animate-ping rounded-full border-2 border-destructive opacity-40" />
              <span className="absolute right-3 top-3 flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-destructive" />
              </span>
            </>
          ) : null}
          <Mic
            className={cn(
              "size-9 transition-transform duration-200 group-hover:scale-110",
              recording ? "text-destructive" : "text-primary",
            )}
          />
        </button>
        <p className="text-sm text-muted-foreground">
          {analyzing
            ? analysisStatus ?? "Building your snapshot…"
            : coachSpeaking
              ? "Wait for the prompt to finish…"
              : recording
                ? "Tap again when you're done"
                : "Tap the mic and answer out loud"}
        </p>
      </div>
    </div>
  );
}
