import { Suspense } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Headphones,
  Mic,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VoiceWaveform } from "@/components/voice-waveform";
import { getLocalUserId } from "@/lib/auth/local-user-id";
import { getOnboardingBaselineForUser } from "@/db/queries/baseline";
import { ensureUserProfile } from "@/db/queries/user";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";
import { DIMENSION_LABELS, type DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { CATEGORY_LABELS } from "@/lib/practice/exercises";
import { buildWeekPlan, type WeekDay, type WeekPlan } from "@/lib/practice/week-plan";

export const dynamic = "force-dynamic";

type SearchParams = { regen?: string };

function NoBaselineState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Save a baseline to unlock your week</CardTitle>
        <CardDescription>
          Your weekly plan is generated from your six baseline scores. Record the initial assessment and we&apos;ll
          shape six themed sessions around your weakest dimensions and stated goal.
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

function LearningPathFallback() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="space-y-3">
        <div className="h-4 w-48 rounded-md bg-muted" />
        <div className="h-9 max-w-lg rounded-md bg-muted sm:h-10" />
        <div className="h-4 max-w-2xl rounded-md bg-muted" />
      </header>
      <Card className="border-accent/25">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row">
          <div className="h-24 w-full rounded-md bg-muted sm:w-48" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-40 rounded-md bg-muted" />
            <div className="h-4 w-full rounded-md bg-muted" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-24 rounded-md bg-muted" />
              <div className="h-4 w-40 rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-full rounded-md bg-muted" />
              <div className="h-9 w-full rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">Drafting your week…</p>
    </div>
  );
}

function todayIndexInPlan(plan: WeekPlan, now: Date = new Date()): number {
  if (plan.days.length === 0) return -1;
  const weekdayIdx = (now.getDay() + 6) % 7;
  return Math.min(weekdayIdx, plan.days.length - 1);
}

function DayCard({ day, isToday }: { day: WeekDay; isToday: boolean }) {
  const focusLabel = DIMENSION_LABELS[day.focus];
  return (
    <Card
      className={
        isToday
          ? "relative border-primary/40 bg-gradient-to-b from-primary/10 via-card to-card"
          : "border-border/70"
      }
    >
      {isToday && (
        <span className="absolute right-3 top-3 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Today
        </span>
      )}
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {day.day}
          </Badge>
          <Badge variant="secondary">{CATEGORY_LABELS[day.category]}</Badge>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Target className="size-3" />
            {focusLabel}
          </Badge>
        </div>
        <CardTitle className="text-base leading-snug">{day.title}</CardTitle>
        <CardDescription>{day.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {day.durationMin} minutes · {day.exercises.length} exercise
          {day.exercises.length === 1 ? "" : "s"}
        </div>
        <ol className="space-y-2 text-sm">
          {day.exercises.map((ex, i) => (
            <li
              key={ex.id}
              className="rounded-lg border border-border/60 bg-background/40 p-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
                <p className="font-medium leading-snug">{ex.title}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{ex.subtitle}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
                {ex.promptText}
              </p>
            </li>
          ))}
        </ol>
        {isToday ? (
          <Button variant="glow" size="sm" className="w-full gap-2" asChild>
            <Link href="/practice/today">
              <Headphones className="size-3.5" />
              Start this session
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/practice/today">Preview today&apos;s session</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

async function LearningPathContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const regenerateNonce = (() => {
    const raw = typeof params.regen === "string" ? params.regen.trim() : "";
    const n = raw === "" ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  })();

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

  const goalId = isOnboardingGoalId(baseline.user.onboardingGoalId ?? undefined)
    ? baseline.user.onboardingGoalId
    : null;

  const plan = buildWeekPlan({
    userId,
    scores,
    goalId,
    regenerateNonce,
  });

  const todayIdx = todayIndexInPlan(plan);
  const weakestLabels = plan.weakestDims
    .slice(0, 2)
    .map((d: DimensionKey) => DIMENSION_LABELS[d].toLowerCase())
    .join(" and ");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Adaptive learning path</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your week with Voca
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Six themed sessions tuned to your weakest dimensions ({weakestLabels}) and your goal of{" "}
            <span className="text-foreground">{plan.goalLabel.toLowerCase()}</span>. Each block is voice-first, lands
            in 10–20 minutes, and re-scores the same six dimensions as your baseline.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground lg:items-end">
          <span className="font-mono">{plan.isoWeek}</span>
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
            <Link href={`/learning-path?regen=${regenerateNonce + 1}`} prefetch={false}>
              <RefreshCw className="size-3" />
              Regenerate this week
            </Link>
          </Button>
        </div>
      </header>

      <Card className="border-accent/25 bg-gradient-to-r from-accent/10 via-transparent to-primary/10">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <VoiceWaveform className="shrink-0 sm:w-48" />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Voice-first</Badge>
              <Badge variant="secondary">10–20 min blocks</Badge>
              {plan.days.length > 0 && (
                <Badge variant="outline">
                  Today · {plan.days[todayIdx]?.title ?? plan.days[0]!.title}
                </Badge>
              )}
            </div>
            <h2 className="font-display text-xl">Speak first, read second</h2>
            <p className="text-sm text-muted-foreground">
              Each exercise has a real prompt, a coaching goal, and a target length. Hit start when you have a
              quiet 10 minutes — we save audio locally and only the transcript is scored.
            </p>
          </div>
          <Button className="shrink-0 gap-2" variant="glow" asChild>
            <Link href="/practice/today">
              <Mic className="size-4" />
              Start today&apos;s session
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {plan.days.map((day, i) => (
          <DayCard key={`${day.day}-${day.title}`} day={day} isToday={i === todayIdx} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Adaptation hooks
          </CardTitle>
          <CardDescription>How this plan reshapes itself as you practise</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            "Re-score all six dimensions after every session",
            "Promote categories where the gap to baseline widens",
            "Difficulty climbs once two consecutive sessions land above 75",
            "Plateau breakers (new scenarios + harder pacing reads) when scores flatten for two weeks",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
        <Separator />
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            The week is generated deterministically from your user id, the current ISO week, and a regenerate
            counter — refreshes will not reshuffle the plan unless you tap Regenerate.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LearningPathPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<LearningPathFallback />}>
      <LearningPathContent searchParams={searchParams} />
    </Suspense>
  );
}
