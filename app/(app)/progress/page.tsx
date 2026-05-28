import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, GitCompareArrows, Mic, Play } from "lucide-react";
import { getLocalUserId } from "@/lib/auth/local-user-id";
import {
  listUserSessionsWithAnalysis,
  trendSessionsFromRows,
} from "@/db/queries/sessions-analytics";
import { buildProgressSnapshot, type ProgressSnapshot } from "@/lib/coach/progress-stats";
import { buildTrendInsights, type TrendInsight } from "@/lib/analysis/trends";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

function ProgressFallback() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-3">
        <div className="h-4 w-40 rounded-md bg-muted animate-pulse" />
        <div className="h-9 max-w-md rounded-md bg-muted animate-pulse sm:h-10" />
        <div className="h-4 max-w-2xl rounded-md bg-muted animate-pulse" />
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="h-5 w-48 rounded-md bg-muted animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-5 w-32 rounded-md bg-muted animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProgressEmptyState() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">No sessions yet</CardTitle>
          <CardDescription>
            Record the baseline assessment to start your progress journal. Every saved session lands here with date, duration, and per-dimension scores.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button variant="glow" asChild className="gap-2">
            <Link href="/assessment">
              <Mic className="size-4" />
              Start initial assessment
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TrendChart({ values }: { values: ProgressSnapshot["weeklyTrend"] }) {
  return (
    <div className="flex h-48 items-end justify-between gap-2 rounded-xl border border-border/60 bg-gradient-to-b from-primary/10 via-transparent to-transparent px-4 pb-4 pt-6">
      {values.map((v, i) => {
        const safe = v == null ? 0 : v;
        const px = Math.round((safe / 100) * 72) + 12;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={
                v == null
                  ? "w-full max-w-[28px] rounded-md bg-muted/40"
                  : "w-full max-w-[28px] rounded-md bg-gradient-to-t from-primary to-accent/90"
              }
              style={{ height: `${px}px` }}
              aria-label={v == null ? "No sessions this week" : `Week ${i + 1} average ${v}`}
            />
            <span className="text-[10px] text-muted-foreground">
              W{i + 1}
              {v == null ? "" : ` · ${v}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrendInsightTone({ insight }: { insight: TrendInsight }) {
  const border =
    insight.tone === "positive"
      ? "border-emerald-500/35 bg-emerald-500/[0.06]"
      : insight.tone === "regression"
        ? "border-amber-500/35 bg-amber-500/[0.06]"
        : "border-border/60 bg-muted/25";
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm leading-relaxed ${border}`}>
      <p>{insight.message}</p>
      {typeof insight.deltaPct === "number" ? (
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          Δ {insight.deltaPct > 0 ? "+" : ""}
          {Math.round(insight.deltaPct)}%
        </p>
      ) : null}
    </div>
  );
}

async function ProgressContent() {
  const userId = await getLocalUserId();
  if (!userId) {
    return <ProgressEmptyState />;
  }

  const rows = await listUserSessionsWithAnalysis(userId, { limit: 60 });
  const snapshot = buildProgressSnapshot(rows);
  const trends = buildTrendInsights(trendSessionsFromRows(rows));

  if (!snapshot.hasBaseline) {
    return <ProgressEmptyState />;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Progress journal</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Proof you sound sharper</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{snapshot.summary}</p>
      </header>

      {snapshot.baselineOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add a daily practice session</CardTitle>
            <CardDescription>
              Timeline charts compare to your baseline. Log even one daily practice and the trend, milestones, and dimension deltas start appearing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="glow" asChild className="gap-2">
              <Link href="/dashboard">
                Start today&apos;s practice
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {trends.insights.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery trends</CardTitle>
            <CardDescription>
              Grounded in your saved sessions — richer cues appear once you have several practices with transcripts and metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {trends.insights.map((insight) => (
              <TrendInsightTone key={insight.id} insight={insight} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">Session timeline</CardTitle>
              <CardDescription>Every saved session, newest first.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.timeline.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.title}</p>
                    <Badge variant="secondary">{row.scenario}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.date} · {row.durationSec === 0 ? "duration unknown" : `${(row.durationSec / 60).toFixed(1)} min`} · score {row.score}
                  </p>
                </div>
                {row.kind === "onboarding_assessment" ? (
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link href={`/assessment/results?session=${encodeURIComponent(row.id)}`}>View results</Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Milestones</CardTitle>
            <CardDescription>Computed from your real session deltas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.milestones.map((m) => (
              <div key={m.id} className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.date}</p>
              </div>
            ))}
            <Separator />
            <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <GitCompareArrows className="size-3.5" />
                Side-by-side replay
              </p>
              <p>
                Audio replay and two-session compare ship in Phase F. Until then, the timeline above lists every recorded session and its average score.
              </p>
              <p className="flex items-center gap-1 text-[11px]">
                <Play className="size-3" />
                Recordings remain in <code className="rounded bg-muted px-1">data/uploads</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trend (last 7 weeks)</CardTitle>
          <CardDescription>Weekly average across all six dimensions. Empty bars mean no sessions that week.</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart values={snapshot.weeklyTrend} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<ProgressFallback />}>
      <ProgressContent />
    </Suspense>
  );
}
