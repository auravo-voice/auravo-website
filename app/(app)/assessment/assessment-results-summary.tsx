"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SkillRadar } from "@/components/skill-radar";
import type { RadarDimension } from "@/lib/coach/schemas";
import type { AssessmentBaselinePayload } from "@/lib/assessment/baseline-results-payload";
import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";
import {
  ASSESSMENT_DIMENSION_LABEL,
  buildClarityCheckpoints,
  buildCoachPlanNarrative,
  executiveHighlights,
  explanationForDimension,
  firstTrainingFocusLine,
} from "@/lib/assessment/assessment-results-ui";

export type { AssessmentBaselinePayload };

function displayLabelForDimension(d: RadarDimension): string {
  return ASSESSMENT_DIMENSION_LABEL[d.key as DimensionKey] ?? d.label;
}

function radarDimensionsForDisplay(dimensions: RadarDimension[]): RadarDimension[] {
  return dimensions.map((d) => ({
    ...d,
    label: displayLabelForDimension(d),
  }));
}

function overallHeadline(score: number): string {
  if (score >= 78) return "Strong overall baseline";
  if (score >= 62) return "Solid foundation with clear next steps";
  return "A strong starting point — plenty of room to grow with practice";
}

export function AssessmentResultsSummary({ results }: { results: AssessmentBaselinePayload }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const radarDims = React.useMemo(() => radarDimensionsForDisplay(results.dimensions), [results.dimensions]);
  const highlights = React.useMemo(() => executiveHighlights(radarDims), [radarDims]);
  const coachNarrative = React.useMemo(
    () => buildCoachPlanNarrative(radarDims, results.coachSummary, highlights),
    [radarDims, results.coachSummary, highlights],
  );
  const firstFocus = React.useMemo(
    () => firstTrainingFocusLine(highlights.opportunity, results.coachSummary?.improvementAreas),
    [highlights.opportunity, results.coachSummary?.improvementAreas],
  );
  const clarityItems = React.useMemo(
    () => buildClarityCheckpoints(results.analysis.pronunciationTips),
    [results.analysis.pronunciationTips],
  );

  return (
    <div ref={ref} className="flex flex-col gap-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.06]">
        <CardHeader className="space-y-2 pb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Voice assessment</p>
          <CardTitle className="font-display text-2xl sm:text-3xl">Your speaking baseline</CardTitle>
          <CardDescription className="text-base leading-relaxed text-muted-foreground">
            We analyzed your recording across six communication skills to build your personalized practice plan.
            {results.goalLabel ? (
              <>
                {" "}
                <span className="text-foreground">Focus:</span> {results.goalLabel}
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-5">
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
              <p className="text-sm font-medium text-foreground">{overallHeadline(results.averageScore)}</p>
              <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-primary">
                {results.averageScore}%
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                A blended snapshot across the six skills Auravo coaches — not a single-number grade of who you are as a
                speaker.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
                At a glance
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Strongest skill: </span>
                  {highlights.strongest ? highlights.strongest.label : "—"}
                </li>
                <li>
                  <span className="font-medium text-foreground">Biggest opportunity: </span>
                  {highlights.opportunity ? highlights.opportunity.label : "—"}
                </li>
                <li>
                  <span className="font-medium text-foreground">First training focus: </span>
                  {firstFocus}
                </li>
              </ul>
            </div>
          </div>
          <SkillRadar dimensions={radarDims} className="mx-auto w-full max-w-[300px] opacity-[0.97] lg:mx-0" />
        </CardContent>
      </Card>

      {results.degraded ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          We used a simplified analysis path for this result. Your plan still works — you may get richer detail on your
          next full-length recording.
        </p>
      ) : null}

      <Card className="border-primary/15">
        <CardHeader>
          <CardTitle className="text-lg">Your coaching plan is ready</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Here is how we are thinking about your first week of practice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">{coachNarrative}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your six skills</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Here&apos;s how your speaking baseline breaks down across the skills Auravo will train.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {radarDims.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{d.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(d.score)}</span>
              </div>
              <Progress value={d.score} className="h-2" />
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {explanationForDimension(d.key, results.voiceExplanations, d.score)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {results.recommendedExercises && results.recommendedExercises.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Exercises that match this baseline</CardTitle>
            <CardDescription>Your plan may start with sessions like these.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.recommendedExercises.slice(0, 5).map((ex) => (
              <div key={ex.id} className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
                <p className="font-medium text-foreground">{ex.title}</p>
                {ex.subtitle ? <p className="mt-1 text-sm text-muted-foreground">{ex.subtitle}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Writing patterns to polish</CardTitle>
          <CardDescription>
            Quick flags from your wording — useful nudges, not a full edit of everything you said.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {results.analysis.grammarFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No common patterns jumped out this time. As you add more spoken answers, we will keep an eye out here.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {results.analysis.grammarFlags.map((g, i) => (
                <li
                  key={`${g.label}-${i}-${g.excerpt.slice(0, 24)}`}
                  className="rounded-xl border border-border/60 bg-muted/15 p-4"
                >
                  <p className="font-medium text-foreground">{g.label}</p>
                  <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{g.excerpt}&rdquo;</p>
                  <p className="mt-2 text-muted-foreground">{g.suggestion}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-sky-500/15">
        <CardHeader>
          <CardTitle className="text-lg">Words to review</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            These words were less clear in the recording and may be worth practicing. Coaching estimates only — not a
            list of confirmed mispronunciations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {clarityItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing stood out as a clarity checkpoint this round. If you want richer prompts next time, find a quiet
              spot and speak a touch more deliberately.
            </p>
          ) : (
            <ul className="space-y-4">
              {clarityItems.map((c) => (
                <li key={c.word} className="rounded-xl border border-border/60 bg-muted/15 p-4">
                  <p className="font-display text-lg font-semibold text-foreground">{c.word}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.coachLine}</p>
                  <p className="mt-3 text-sm font-medium text-foreground">Practice slowly</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.practiceDrill}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={c.exampleUrl} target="_blank" rel="noopener noreferrer">
                        Hear example
                      </a>
                    </Button>
                    <Button variant="secondary" size="sm" asChild>
                      <a href={c.exampleUrl} target="_blank" rel="noopener noreferrer">
                        Practice word
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {results.transcript.trim() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What you said</CardTitle>
            <CardDescription>The response we used for this assessment.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
              {results.transcript}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-xs leading-relaxed text-muted-foreground/90">
        Pronunciation and clarity are estimated locally from speech patterns, transcript confidence, and delivery
        signals. They are coaching estimates, not clinical pronunciation scores.
      </p>

      <Separator />
    </div>
  );
}
