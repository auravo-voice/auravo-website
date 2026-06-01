"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Headphones,
  Info,
  Loader2,
  Mic,
  Quote,
  Sparkles,
  Square,
  Target,
} from "lucide-react";
import type { RadarDimension } from "@/lib/coach/schemas";
import { parseExerciseTaskReviewResult, type ExerciseTaskReviewResult } from "@/lib/coach/exercise-task-review-core";
import { setClientAuravoUserId } from "@/lib/auth/set-auravo-user-cookie-client";
import { recordingValidationError, stopMediaRecorderAndBuildBlob } from "@/lib/audio/finish-recording";
import { startMicLevelMonitor, type MicMonitorHandle } from "@/lib/audio/mic-monitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type VoiceAnalysisShape = {
  fillerStats?: { count?: number; ratePerMin?: number; rateLabel?: string };
  pauseStats?: { count?: number | null; longCount?: number | null; avgMs?: number | null };
  derivedMetrics?: { wpm?: number | null };
  explanations?: Record<string, string>;
  qualityFlags?: Record<string, "audio_grounded" | "transcript_only" | "approximate">;
  acousticFeatures?: unknown;
  acousticReason?: string | null;
};

type CoachSummaryShape = {
  summary?: string;
  strengths?: string[];
  improvementAreas?: string[];
  recommendationRationale?: string;
  recommendedExerciseIds?: string[];
  fallbackUsed?: boolean;
  warning?: string | null;
};

type RecommendedExerciseShape = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  focus: string;
  coachingGoal: string;
  promptPreview: string;
};

export type ClientPromptSummary = {
  id: string;
  title: string;
  /** One-line context shown under the title. */
  subtitle: string;
  /** What the learner should do, written like a coach giving direction. */
  instructions: string;
  /** The actual passage / question / scenario the learner speaks about. Rendered prominently. */
  promptText: string;
  /** What we're listening for — surfaced as a quiet "rubric" line. */
  coachingGoal: string;
  /** Suggested target recording length for the exercise (informational). */
  targetSeconds: number;
  /** Primary dimension key (e.g. "filler_words"). */
  focus: string;
  /** Category id (e.g. "client_call"). */
  category: string;
  /** Pre-formatted category label for badges. */
  categoryLabel: string;
};

export type ExerciseResult = {
  promptId: string;
  promptTitle: string;
  focus: string;
  averageScore: number;
  dimensions: RadarDimension[];
  voiceAnalysis: VoiceAnalysisShape | null;
  coachSummary: CoachSummaryShape | null;
  taskReview: ExerciseTaskReviewResult | null;
  recommendedExercises: RecommendedExerciseShape[];
};

type Phase = "context" | "ready" | "recording" | "uploading" | "feedback" | "summary";

type Props = {
  prompts: ClientPromptSummary[];
  /** Baseline average across six dims; used so the summary card can show diff. May be null when no baseline yet. */
  baselineAverage: number | null;
};

export function PracticeRunner({ prompts, baselineAverage }: Props) {
  const [index, setIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("context");
  const [error, setError] = React.useState<string | null>(null);
  const [micWarning, setMicWarning] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<ExerciseResult[]>([]);
  const [latest, setLatest] = React.useState<ExerciseResult | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);

  const mrRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const monitorRef = React.useRef<MicMonitorHandle | null>(null);
  const startedAtRef = React.useRef<number | null>(null);
  const tickerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const current = prompts[index];
  const total = prompts.length;
  const isLast = index === total - 1;

  const teardown = React.useCallback(() => {
    monitorRef.current?.stop();
    monitorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => teardown(), [teardown]);

  const startRecording = React.useCallback(async () => {
    if (!current) return;
    setError(null);
    setMicWarning(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mrRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      monitorRef.current = startMicLevelMonitor(stream, () => {
        setMicWarning("We barely hear you. Check your mic and the selected input device.");
      });
      mr.start(250);
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      tickerRef.current = setInterval(() => {
        if (startedAtRef.current != null) {
          setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      }, 250);
      setPhase("recording");
    } catch {
      setError("Microphone permission is required to record this exercise.");
      teardown();
      setPhase("ready");
    }
  }, [current, teardown]);

  const stopAndUpload = React.useCallback(async () => {
    const mr = mrRef.current;
    if (!mr || !current) return;
    setPhase("uploading");
    const end = Date.now();
    const durationMs = startedAtRef.current != null ? end - startedAtRef.current : 0;
    const blob = await stopMediaRecorderAndBuildBlob(mr, chunksRef.current);
    teardown();
    mrRef.current = null;

    const captureError = recordingValidationError(blob, durationMs, {
      minDurationMs: 2_000,
      shortDurationMessage:
        "Recording was very short. Speak for at least a few seconds, then tap Stop & save.",
      emptyCaptureMessage:
        "No audio was captured. Check your microphone and input device, then try again.",
    });
    if (captureError) {
      setError(captureError);
      setPhase("ready");
      return;
    }

    const form = new FormData();
    form.set("audio", blob, `${current.id}.webm`);
    form.set("durationMs", String(durationMs));
    form.set("promptId", current.id);

    try {
      const res = await fetch("/api/practice/exercise", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Save failed (${res.status})`);
      }
      if (typeof json.userId === "string") setClientAuravoUserId(json.userId);
      const dims = Array.isArray(json.dimensions) ? (json.dimensions as RadarDimension[]) : [];
      const focus = typeof json.focus === "string" ? json.focus : current.focus;
      const avg = typeof json.averageScore === "number" ? Math.round(json.averageScore) : 0;
      const voiceAnalysis = (json.voiceAnalysis as VoiceAnalysisShape | undefined) ?? null;
      const coachSummary = (json.coachSummary as CoachSummaryShape | undefined) ?? null;
      const taskReview = parseExerciseTaskReviewResult(json.taskReview);
      const recommendedExercises = Array.isArray(json.recommendedExercises)
        ? (json.recommendedExercises as RecommendedExerciseShape[])
        : [];
      const next: ExerciseResult = {
        promptId: current.id,
        promptTitle: current.title,
        focus,
        averageScore: avg,
        dimensions: dims,
        voiceAnalysis,
        coachSummary,
        taskReview,
        recommendedExercises,
      };
      setLatest(next);
      setResults((r) => [...r, next]);
      setPhase("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      setPhase("ready");
    }
  }, [current, teardown]);

  const handleContinue = React.useCallback(() => {
    if (isLast) {
      setPhase("summary");
    } else {
      setIndex((i) => i + 1);
      setLatest(null);
      setPhase("context");
    }
  }, [isLast]);

  if (prompts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">No practice prompts available</CardTitle>
          <CardDescription>Save a baseline assessment so we can pick prompts for your weakest dimensions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/assessment">Start initial assessment</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "summary") {
    const sessionAvg =
      results.length === 0
        ? 0
        : Math.round(results.reduce((a, r) => a + r.averageScore, 0) / results.length);
    const delta = baselineAverage == null ? null : sessionAvg - baselineAverage;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Session complete</CardTitle>
          <CardDescription>
            {delta == null
              ? "Each exercise above is saved to your progress journal."
              : delta > 0
                ? `Average ${sessionAvg} — that is ${delta} points above your baseline of ${baselineAverage}.`
                : delta < 0
                  ? `Average ${sessionAvg} — that is ${Math.abs(delta)} points below your baseline of ${baselineAverage}. Variability is normal early on.`
                  : `Average ${sessionAvg} — matches your baseline of ${baselineAverage}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.promptId} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{r.promptTitle}</p>
                  <p className="text-xs text-muted-foreground">Focus · {r.focus.replace("_", " ")}</p>
                </div>
                <p className="text-sm tabular-nums">{r.averageScore}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="glow" className="gap-2">
              <Link href="/dashboard">
                Back to dashboard
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/progress">See progress journal</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!current) return null;

  const focusLabel = current.focus.replace("_", " ");

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Exercise {index + 1} of {total}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{current.categoryLabel}</Badge>
            <Badge variant="outline" className="gap-1 text-xs">
              <Target className="size-3" /> {focusLabel}
            </Badge>
            <Badge variant="outline" className="text-xs">
              ~{current.targetSeconds}s target
            </Badge>
          </div>
        </div>
        <CardTitle className="text-xl">{current.title}</CardTitle>
        <CardDescription>{current.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(phase === "context" || phase === "ready" || phase === "recording" || phase === "uploading") && (
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Quote className="size-3.5" />
                Your prompt
              </div>
              <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-foreground">
                {current.promptText}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Headphones className="size-3.5" />
                Coach instructions
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{current.instructions}</p>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Target className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Listening for:</span> {current.coachingGoal}
              </span>
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {phase === "context" && (
          <>
            <Separator />
            <Button variant="glow" className="gap-2" onClick={() => setPhase("ready")}>
              I&apos;m ready
              <ArrowRight className="size-4" />
            </Button>
          </>
        )}

        {(phase === "ready" || phase === "recording" || phase === "uploading") && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className={cn("flex items-center gap-2", phase === "recording" ? "text-primary" : "text-muted-foreground")}>
                <Mic className="size-4" />
                <span>{phase === "recording" ? "Recording…" : "Tap start to begin"}</span>
              </div>
              {phase === "recording" && (
                <span className="tabular-nums text-muted-foreground">
                  {elapsedSec}s / target {current.targetSeconds}s
                </span>
              )}
            </div>
            {micWarning && phase === "recording" && (
              <p className="rounded-md border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
                {micWarning}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="glow"
                disabled={phase !== "ready"}
                onClick={() => void startRecording()}
                className="gap-2"
              >
                <Mic className="size-4" />
                Start recording
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={phase !== "recording"}
                onClick={() => void stopAndUpload()}
                className="gap-2"
              >
                <Square className="size-4" />
                Stop &amp; save
              </Button>
            </div>
            {phase === "recording" && (
              <Progress value={Math.min(100, Math.round((elapsedSec / current.targetSeconds) * 100))} />
            )}
            {phase === "uploading" && (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <Loader2 className="size-4 animate-spin shrink-0" />
                  Analyzing your recording…
                </p>
                <p className="text-xs leading-relaxed">
                  Usually about 1–2 minutes on this machine: local transcription, voice scoring, then coach
                  feedback. Keep this tab open.
                </p>
              </div>
            )}
          </>
        )}

        {phase === "feedback" && latest && (
          <ExerciseFeedback result={latest} onContinue={handleContinue} isLast={isLast} />
        )}
      </CardContent>
    </Card>
  );
}

const DIM_QUALITY_BADGE: Record<string, { label: string; tone: "audio" | "soft" | "approx" }> = {
  audio_grounded: { label: "Audio-grounded", tone: "audio" },
  transcript_only: { label: "Transcript-only", tone: "soft" },
  approximate: { label: "Approximate", tone: "approx" },
};

export function ExerciseFeedback({
  result,
  onContinue,
  isLast,
}: {
  result: ExerciseResult;
  onContinue: () => void;
  isLast: boolean;
}) {
  const va = result.voiceAnalysis;
  const coach = result.coachSummary;
  const recs = result.recommendedExercises;
  const task = result.taskReview;

  const wpm = va?.derivedMetrics?.wpm ?? null;
  const fillerCount = va?.fillerStats?.count ?? 0;
  const fillerPerMin = va?.fillerStats?.ratePerMin ?? null;
  const pauseCount = va?.pauseStats?.count ?? null;
  const longPauseCount = va?.pauseStats?.longCount ?? null;
  const acousticAvailable = va?.acousticFeatures != null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Coach feedback</p>
        <p className="mt-1 font-display text-lg font-semibold text-foreground">Session review</p>
        <p className="mt-1 text-xs text-muted-foreground">
          How you performed this exercise — then the delivery signals underneath.
        </p>
        {task?.taskReviewSource === "fallback" ? (
          <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100">
            Task review used a quick offline template (coach runtime unavailable or timed out). Voice scores are
            unchanged.
          </p>
        ) : null}
      </div>

      {task ? (
        <div className="space-y-4 rounded-xl border border-border/80 bg-card/80 p-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Communication review</h3>
            <p className="text-sm leading-relaxed text-foreground/90">{task.communicationEffectiveness}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{task.scenarioRelevance}</p>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tone &amp; presence</p>
              <p className="mt-1 text-sm text-foreground/90">{task.toneFeedback}</p>
            </div>
          </section>

          <section className="space-y-2 border-t border-border/60 pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">How well you answered the prompt</h3>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                Task fit · {task.taskFitScore}/100
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{task.promptCompletion}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{task.structureFeedback}</p>
          </section>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
        <h3 className="text-sm font-semibold text-foreground">Delivery notes</h3>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            Voice snapshot · overall {result.averageScore}/100 across the six coached dimensions
          </span>
        </div>
        {coach?.summary ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{coach.summary}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No extra delivery narrative for this save.</p>
        )}
        {coach?.warning ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-yellow-200">
            <Info className="mt-0.5 size-3.5" /> {coach.warning}
          </p>
        ) : null}
        {!acousticAvailable && va?.acousticReason ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5" />
            <span>
              Voice-quality features are unavailable on this recording ({va.acousticReason}). Install the optional
              acoustic backend (<code className="font-mono">pip install praat-parselmouth librosa</code>) for clarity / confidence
              metrics.
            </span>
          </p>
        ) : null}
      </div>

      {task ? (
        <section className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <h3 className="text-sm font-semibold text-foreground">What to try next time</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{task.revisedNextAttemptStrategy}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">What worked</p>
              <p className="mt-1 text-sm text-foreground/90">{task.whatWorked}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Dial up next</p>
              <p className="mt-1 text-sm text-foreground/90">{task.whatToImprove}</p>
            </div>
          </div>
        </section>
      ) : null}

      {(wpm != null || fillerCount > 0 || pauseCount != null) && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery metrics</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {wpm != null && <KeyMetric label="Pace" value={`${Math.round(wpm)} WPM`} />}
            <KeyMetric
              label="Fillers"
              value={`${fillerCount}${fillerPerMin != null ? ` · ${fillerPerMin.toFixed(1)}/min` : ""}`}
            />
            {pauseCount != null && <KeyMetric label="Pauses" value={`${pauseCount}`} />}
            {longPauseCount != null && longPauseCount > 0 && (
              <KeyMetric label="Long pauses" value={`${longPauseCount}`} />
            )}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dimension scores</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {result.dimensions.map((d) => {
            const explanation = va?.explanations?.[d.key];
            const quality = va?.qualityFlags?.[d.key];
            const badge = quality ? DIM_QUALITY_BADGE[quality] : null;
            return (
              <div key={d.key} className="rounded-lg border border-border/70 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</p>
                  <span className="font-semibold tabular-nums">{Math.round(d.score)}</span>
                </div>
                {explanation ? (
                  <p className="mt-1 text-xs leading-relaxed text-foreground/80">{explanation}</p>
                ) : null}
                {badge && d.key === "pronunciation" ? (
                  <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {badge.label} estimate
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Speech clarity is estimated locally from articulation clarity, transcript confidence, and delivery patterns —
        it is not a phoneme-level pronunciation grade.
      </p>

      {(coach?.strengths?.length ?? 0) > 0 || (coach?.improvementAreas?.length ?? 0) > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {coach?.strengths && coach.strengths.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">Delivery strengths</p>
              <ul className="space-y-1 text-sm text-foreground/90">
                {coach.strengths.map((s, i) => (
                  <li key={`s${i}`}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {coach?.improvementAreas && coach.improvementAreas.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300">Delivery improvements</p>
              <ul className="space-y-1 text-sm text-foreground/90">
                {coach.improvementAreas.map((s, i) => (
                  <li key={`i${i}`}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {recs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next</p>
            {coach?.recommendationRationale ? (
              <p className="hidden text-xs text-muted-foreground sm:block">{coach.recommendationRationale}</p>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {recs.map((rec) => (
              <Link
                key={rec.id}
                href={`/practice/today?focus=${encodeURIComponent(rec.id)}`}
                className="group rounded-lg border border-border/70 bg-card/60 p-3 transition hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{rec.title}</p>
                  <Sparkles className="size-4 text-primary opacity-0 transition group-hover:opacity-100" />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{rec.subtitle}</p>
                <p className="mt-1.5 line-clamp-2 text-xs text-foreground/70">{rec.promptPreview}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Button variant="glow" className="gap-2" onClick={onContinue}>
        {isLast ? "Finish session" : "Next exercise"}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function KeyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-card/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
