"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { ONBOARDING_GOALS } from "@/data/onboarding-goals";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateOnboardingGoal } from "./actions";

type Props = { initialGoalId: string | null };

export function SettingsGoalForm({ initialGoalId }: Props) {
  const [goalId, setGoalId] = React.useState<string | null>(initialGoalId);
  const [savedGoalId, setSavedGoalId] = React.useState<string | null>(initialGoalId);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const dirty = goalId !== savedGoalId;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!goalId) {
      setError("Pick one of the four primary goals before saving.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("goalId", goalId);
    startTransition(async () => {
      const res = await updateOnboardingGoal(fd);
      if (res.ok) {
        setSavedGoalId(res.goalId);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {ONBOARDING_GOALS.map((g) => {
          const selected = goalId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoalId(g.id)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition",
                selected
                  ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                  : "border-border/70 bg-muted/20 hover:border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{g.title}</span>
                {selected && <Check className="size-4 text-primary" aria-hidden />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="glow" disabled={!dirty || pending} className="gap-2">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : dirty ? "Save goal" : "Saved"}
        </Button>
        {!dirty && savedGoalId && (
          <p className="text-xs text-muted-foreground">
            Saved goal: <span className="font-medium text-foreground">{ONBOARDING_GOALS.find((g) => g.id === savedGoalId)?.title}</span>
          </p>
        )}
      </div>
    </form>
  );
}
