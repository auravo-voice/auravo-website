import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardBaselineHandoffBootstrap } from "./dashboard-baseline-handoff-bootstrap";
import { DashboardCoachNarrativeIntro, DashboardCoachNarrativeTodaySession } from "./dashboard-coach-narrative";
import { DashboardFreshLoad } from "./dashboard-fresh-load";
import { DashboardSessionUrlCleanup } from "./dashboard-session-url-cleanup";
import { Flame, Keyboard, Play } from "lucide-react";
import type { OnboardingGoalId } from "@/lib/coach/dashboard";
import { getOnboardingGoalLabel, isOnboardingGoalId } from "@/lib/coach/dashboard";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getAuthUserDisplayName } from "@/lib/auth/user-display-name";
import { AURAVO_PENDING_BASELINE_SESSION_COOKIE } from "@/lib/auth/auravo-user-cookie-constants";
import { getBaselineBundleForPracticeSession, getOnboardingBaselineForUser, type BaselineBundle } from "@/db/queries/baseline";
import { getUserSessionStats } from "@/db/queries/sessions";
import { isRecordId } from "@/lib/util/is-uuid-like";
import { ensureUserProfile } from "@/db/queries/user";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { SkillRadar } from "@/components/skill-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

function DashboardNarrativeIntroFallback() {
  return (
    <div className="mt-2 space-y-2">
      <div className="h-4 w-full max-w-xl rounded-md bg-muted animate-pulse" />
      <div className="h-4 w-[90%] max-w-xl rounded-md bg-muted animate-pulse" />
    </div>
  );
}

function DashboardNarrativeTodayFallback() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-24 rounded-md bg-muted animate-pulse" />
      <div className="h-7 w-full max-w-md rounded-md bg-muted animate-pulse" />
      <div className="h-4 w-full max-w-lg rounded-md bg-muted animate-pulse" />
    </div>
  );
}

function DashboardCoachFallback() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded-md bg-muted" />
          <div className="h-9 w-64 max-w-full rounded-md bg-muted sm:h-10" />
          <div className="h-4 max-w-xl rounded-md bg-muted" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-7 w-28 rounded-full bg-muted" />
          <div className="h-7 w-40 rounded-full bg-muted" />
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="pb-2">
            <div className="h-5 w-40 rounded-md bg-muted" />
            <div className="mt-2 h-4 w-full max-w-md rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-4 w-3/4 rounded-md bg-muted" />
            <div className="h-2 w-full rounded-full bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-5 w-32 rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-28 rounded-md bg-muted" />
                  <div className="h-4 w-8 rounded-md bg-muted" />
                </div>
                <div className="h-2 w-full rounded-full bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <p className="text-center text-sm text-muted-foreground">Loading your dashboard…</p>
    </div>
  );
}

function DashboardEmptyState({ displayName }: { displayName: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
        <DashboardGreeting
          displayName={displayName}
          className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
        />
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Complete Quick Analysis</CardTitle>
          <CardDescription>
            Skill scores and the radar chart only appear after you finish the full Quick Analysis path. The app stores
            transcripts locally and derives scores from your voice — your coach model is not asked to invent numbers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button variant="glow" asChild>
            <Link href="/quick-analysis">Start Quick Analysis</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/onboarding">Return to onboarding</Link>
          </Button>
        </CardContent>
        <CardContent className="border-t border-border/60 pt-0">
          <p className="text-center text-sm text-muted-foreground">
            Want a quick habit?{" "}
            <Link href="/wordle" className="font-medium text-primary underline-offset-4 hover:underline">
              Try today&apos;s vocabulary challenge
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

async function DashboardCoachContent({
  onboardingGoalId,
  sessionIdFromUrl,
}: {
  onboardingGoalId?: OnboardingGoalId;
  sessionIdFromUrl: string | null;
}) {
  let baseline: BaselineBundle | null = null;

  const cookieStore = await cookies();
  const pendingSessionRaw = cookieStore.get(AURAVO_PENDING_BASELINE_SESSION_COOKIE)?.value?.trim() ?? null;

  let resolvedSessionId: string | null = null;
  if (sessionIdFromUrl && isRecordId(sessionIdFromUrl)) {
    resolvedSessionId = sessionIdFromUrl;
  } else if (pendingSessionRaw && isRecordId(pendingSessionRaw)) {
    resolvedSessionId = pendingSessionRaw;
  }

  const authUserId = await getAuthenticatedUserId();
  if (!authUserId) {
    const displayName = (await getAuthUserDisplayName()) ?? "Learner";
    return <DashboardEmptyState displayName={displayName} />;
  }

  const baselineFromSession = resolvedSessionId
    ? await getBaselineBundleForPracticeSession(resolvedSessionId)
    : null;

  const [baselineFromUser, stats, profile] = await Promise.all([
    baselineFromSession ? Promise.resolve(null) : getOnboardingBaselineForUser(authUserId),
    getUserSessionStats(authUserId),
    ensureUserProfile(authUserId),
  ]);

  baseline =
    baselineFromSession && baselineFromSession.user.id === authUserId
      ? baselineFromSession
      : baselineFromUser;

  if (!baseline) {
    const displayName = profile.displayName || ((await getAuthUserDisplayName()) ?? "Learner");
    return <DashboardEmptyState displayName={displayName} />;
  }

  const needsHandoffCleanup =
    (sessionIdFromUrl && isRecordId(sessionIdFromUrl)) ||
    (pendingSessionRaw != null && pendingSessionRaw !== "" && isRecordId(pendingSessionRaw));

  const scores: SixDimensionScores = {
    pronunciation: baseline.scores.pronunciation,
    grammar: baseline.scores.grammar,
    fluency: baseline.scores.fluency,
    vocabulary: baseline.scores.vocabulary,
    filler_words: baseline.scores.fillerWords,
    pacing: baseline.scores.pacing,
  };

  const ordered = scoresToRadarDimensions(scores);
  const avgRaw = ordered.length
    ? ordered.reduce((a, d) => a + d.score, 0) / ordered.length
    : 0;
  const avg = Number.isFinite(avgRaw) ? Math.round(avgRaw) : 0;

  const storedGoalId = isOnboardingGoalId(baseline.user.onboardingGoalId ?? undefined)
    ? baseline.user.onboardingGoalId
    : undefined;
  const goalForNarrative = storedGoalId ?? onboardingGoalId ?? null;

  const goalLabel = getOnboardingGoalLabel(storedGoalId) ?? getOnboardingGoalLabel(onboardingGoalId) ?? "Your goals";

  const narrativeProps = {
    scores,
    displayName: baseline.user.displayName,
    onboardingGoalId: goalForNarrative,
  };

  const streakLabel = stats.streakDays === 1 ? "1 day streak" : `${stats.streakDays} day streak`;
  const sessionsLabel = stats.totalSessions === 1 ? "1 session" : `${stats.totalSessions} sessions`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {needsHandoffCleanup ? (
        <Suspense fallback={null}>
          <DashboardSessionUrlCleanup userId={baseline.user.id} active />
        </Suspense>
      ) : null}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
          <DashboardGreeting
            displayName={baseline.user.displayName}
            className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          />
          <Suspense fallback={<DashboardNarrativeIntroFallback />}>
            <DashboardCoachNarrativeIntro input={narrativeProps} />
          </Suspense>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent" className="gap-1">
            <Flame className="size-3.5" />
            {streakLabel}
          </Badge>
          <Badge variant="secondary">{sessionsLabel} saved</Badge>
          <Badge variant="outline">Goal · {goalLabel}</Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Today&apos;s session</CardTitle>
            <CardDescription>
              15 min · 3 speaking blocks · coaching updates after you finish each block
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex-1 space-y-4">
              <Suspense fallback={<DashboardNarrativeTodayFallback />}>
                <DashboardCoachNarrativeTodaySession input={narrativeProps} />
              </Suspense>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Baseline average</span>
                  <span>{avg}%</span>
                </div>
                <Progress value={avg} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="lg" className="gap-2" variant="glow" asChild>
                  <Link href="/practice/today">
                    <Play className="size-4" />
                    Start today&apos;s practice
                  </Link>
                </Button>
                {/* <Button size="lg" variant="outline" className="gap-2" asChild>
                  <Link href="/meeting-prep">
                    Meeting prep
                    <ArrowRight className="size-4" />
                  </Link>
                </Button> */}
              </div>
            </div>
            <SkillRadar dimensions={ordered} className="mx-auto w-full max-w-[280px] opacity-95" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skill mix</CardTitle>
            <CardDescription>
              Six dimensions from your saved initial assessment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ordered.map((d) => (
              <div key={d.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{d.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {Number.isFinite(d.score) ? Math.round(d.score) : 0}
                  </span>
                </div>
                <Progress value={d.score} />
              </div>
            ))}
            <Separator />
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/assessment/results">View full baseline results</Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Re-run Quick Analysis from the sidebar to refresh your baseline.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed border-primary/25 bg-muted/15">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Quick win</p>
            <p className="font-display text-lg font-semibold">Try today&apos;s vocabulary challenge</p>
            <p className="text-sm text-muted-foreground">
              Auravord — same five-letter answer for everyone each day. You get six guesses.
            </p>
          </div>
          <Button variant="outline" className="shrink-0 gap-2 sm:min-w-[11rem]" asChild>
            <Link href="/wordle">
              <Keyboard className="size-4" />
              Open Auravord
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

type DashboardPageProps = {
  searchParams?: Promise<{ goal?: string | string[]; session?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const raw = sp.goal;
  const fromQuery = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const onboardingGoalId: OnboardingGoalId | undefined = isOnboardingGoalId(fromQuery) ? fromQuery : undefined;

  const rawSession = sp.session;
  const sessionIdFromUrl =
    typeof rawSession === "string" ? rawSession : Array.isArray(rawSession) ? rawSession[0] : null;

  return (
    <>
      <Suspense fallback={null}>
        <DashboardBaselineHandoffBootstrap />
      </Suspense>
      <Suspense fallback={null}>
        <DashboardFreshLoad />
      </Suspense>
      <Suspense fallback={<DashboardCoachFallback />}>
        <DashboardCoachContent onboardingGoalId={onboardingGoalId} sessionIdFromUrl={sessionIdFromUrl} />
      </Suspense>
    </>
  );
}
