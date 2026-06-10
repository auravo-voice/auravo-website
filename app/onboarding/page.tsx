"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mic, Sparkles } from "lucide-react";
import { ONBOARDING_GOALS } from "@/data/onboarding-goals";
import { AuthHeaderActions } from "@/components/auth/auth-header-actions";
import { AuravoMark, VocaBadge } from "@/components/brand";
import { PublicPageThemeToggle } from "@/components/public-page-theme-toggle";
import { VoiceWaveform } from "@/components/voice-waveform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const steps = ["Goal", "Assessment", "Plan"] as const;

export default function OnboardingPage() {
  const [step, setStep] = React.useState(0);
  const [goal, setGoal] = React.useState<string | null>(null);

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <AuravoMark className="h-10 w-auto sm:h-11" />
          <div className="leading-tight">
            <VocaBadge className="w-fit scale-90 origin-left" />
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <PublicPageThemeToggle />
          <AuthHeaderActions />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-16 sm:px-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Step {step + 1} of {steps.length}
            </span>
            <span>{steps[step]}</span>
          </div>
          <Progress value={progress} />
        </div>

        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Choose your north star</h1>
              <p className="mt-2 text-muted-foreground">
                Pick a goal to shape your plan. You can change this later from settings.
              </p>
            </div>
            <div className="grid gap-3">
              {ONBOARDING_GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className={cn(
                    "rounded-xl border px-4 py-4 text-left transition hover:border-primary/50",
                    goal === g.id ? "border-primary bg-primary/10 shadow-sm shadow-primary/15" : "border-border/80 bg-card/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-base font-semibold">{g.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
                    </div>
                    {goal === g.id && <CheckCircle2 className="size-5 shrink-0 text-primary" />}
                  </div>
                </button>
              ))}
            </div>
            <Button
              className="gap-2"
              size="lg"
              disabled={!goal}
              onClick={() => setStep(1)}
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Quick Analysis</h1>
              <p className="mt-2 text-muted-foreground">
                A five-minute voice snapshot with Voca — five short spoken prompts and a visual description. Finish the
                full path to unlock your dashboard baseline.
              </p>
            </div>
            <Card className="border-dashed border-primary/40 bg-primary/5">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <VoiceWaveform className="h-16" />
                <div className="space-y-1">
                  <p className="font-medium">We&apos;ll listen, not judge</p>
                <p className="text-sm text-muted-foreground">
                  Waveform-first UI during capture; baseline scores for six dimensions appear once your speaking
                  pipeline is connected.
                </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge variant="secondary">Microphone access</Badge>
                  <Badge variant="outline">Pause & resume</Badge>
                </div>
                <Button className="gap-2" variant="glow" size="lg" onClick={() => setStep(2)}>
                  <Mic className="size-4" />
                  Start assessment
                </Button>
              </CardContent>
            </Card>
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your first plan is ready</h1>
              <p className="mt-2 text-muted-foreground">
                When you continue, you&apos;ll record a short spoken baseline. After it is saved, the dashboard shows
                your measured dimensions (not model-invented scores).
              </p>
            </div>
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="size-4" />
                  Today&apos;s focus
                </div>
                <p className="font-display text-xl">Reduce filler words during structured answers</p>
                <p className="text-sm text-muted-foreground">
                  Your goal shapes coaching copy after we capture a real baseline from your voice in the next step.
                </p>
                <Button className="w-full gap-2" size="lg" variant="glow" asChild>
                  <Link href={goal ? `/quick-analysis?goal=${encodeURIComponent(goal)}` : "/quick-analysis"}>
                    Start Quick Analysis
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
