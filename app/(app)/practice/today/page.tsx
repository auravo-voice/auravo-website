import Link from "next/link";
import { Suspense } from "react";
import { Mic } from "lucide-react";
import { getLocalUserId } from "@/lib/auth/local-user-id";
import { ensureUserProfile } from "@/db/queries/user";
import { getOnboardingBaselineForUser } from "@/db/queries/baseline";
import { listUserSessions } from "@/db/queries/sessions";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";
import { buildWeekPlan, todaysExercises } from "@/lib/practice/week-plan";
import { CATEGORY_LABELS } from "@/lib/practice/exercises";
import { DIMENSION_LABELS } from "@/lib/assessment/dimensions-from-scores";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PracticeRunner, type ClientPromptSummary } from "../practice-runner";

export const dynamic = "force-dynamic";

function avgScore(s: SixDimensionScores): number {
  return Math.round(
    (s.pronunciation + s.grammar + s.fluency + s.vocabulary + s.filler_words + s.pacing) / 6,
  );
}

function NoBaselineState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Record your baseline first</CardTitle>
        <CardDescription>
          We pick today&apos;s exercises from your two weakest dimensions. Save a baseline assessment so the pick is
          meaningful.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="glow" className="gap-2">
          <Link href="/assessment">
            <Mic className="size-4" />
            Start initial assessment
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function PracticeTodayContent() {
  const userId = await getLocalUserId();
  if (!userId) return <NoBaselineState />;

  await ensureUserProfile(userId);
  const baseline = await getOnboardingBaselineForUser(userId);
  if (!baseline) return <NoBaselineState />;

  const scores: SixDimensionScores = {
    pronunciation: baseline.scores.pronunciation,
    grammar: baseline.scores.grammar,
    fluency: baseline.scores.fluency,
    vocabulary: baseline.scores.vocabulary,
    filler_words: baseline.scores.fillerWords,
    pacing: baseline.scores.pacing,
  };

  // Use latest scored session for baseline-comparison so practitioners see improvement vs their *recent* level too.
  const recent = await listUserSessions(userId, {
    limit: 1,
    kinds: ["onboarding_assessment", "daily_practice"],
  });
  const baselineAverage = recent[0]?.scores
    ? Math.round(
        (recent[0].scores.pronunciation +
          recent[0].scores.grammar +
          recent[0].scores.fluency +
          recent[0].scores.vocabulary +
          recent[0].scores.fillerWords +
          recent[0].scores.pacing) /
          6,
      )
    : avgScore(scores);

  const storedGoal = isOnboardingGoalId(baseline.user.onboardingGoalId ?? undefined)
    ? baseline.user.onboardingGoalId
    : null;

  // Same generator the /learning-path page uses → today's exercises here always match the highlighted day there.
  const plan = buildWeekPlan({ userId, scores, goalId: storedGoal });
  const { day, exercises } = todaysExercises(plan);

  if (!day || exercises.length === 0) {
    // Defensive: if every template were filtered out somehow, fall back to a generic state instead of a blank page.
    return <NoBaselineState />;
  }

  const clientPrompts: ClientPromptSummary[] = exercises.map((p) => ({
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    instructions: p.instructions,
    promptText: p.promptText,
    coachingGoal: p.coachingGoal,
    targetSeconds: p.targetDurationSec,
    focus: p.focus,
    category: p.category,
    categoryLabel: CATEGORY_LABELS[p.category],
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Daily practice · {plan.isoWeek} · {day.day}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {day.title}
        </h1>
        <p className="text-muted-foreground">{day.summary}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">{CATEGORY_LABELS[day.category]}</Badge>
          <Badge variant="outline">Focus · {DIMENSION_LABELS[day.focus]}</Badge>
          <Badge variant="outline">
            {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · ~{day.durationMin} min
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {plan.weakestDims.slice(0, 3).map((d) => (
            <Badge key={d} variant="outline" className="text-xs">
              Weak · {DIMENSION_LABELS[d]} · {Math.round(scores[d])}
            </Badge>
          ))}
        </div>
      </header>
      <PracticeRunner prompts={clientPrompts} baselineAverage={baselineAverage} />
    </div>
  );
}

function PracticeTodaySkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="space-y-3">
        <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-9 max-w-md rounded-md bg-muted animate-pulse" />
        <div className="h-4 max-w-2xl rounded-md bg-muted animate-pulse" />
      </div>
      <div className="h-60 rounded-2xl bg-muted/40 animate-pulse" />
    </div>
  );
}

export default function PracticeTodayPage() {
  return (
    <Suspense fallback={<PracticeTodaySkeleton />}>
      <PracticeTodayContent />
    </Suspense>
  );
}
