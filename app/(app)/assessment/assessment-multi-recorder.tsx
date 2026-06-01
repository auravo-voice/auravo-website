"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mic,
  RotateCcw,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  setClientAuravoUserId,
  clearClientPendingBaselineSession,
} from "@/lib/auth/set-auravo-user-cookie-client";
import { AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY } from "@/lib/auth/auravo-user-cookie-constants";
import { recordingValidationError, stopMediaRecorderAndBuildBlob } from "@/lib/audio/finish-recording";
import { startMicLevelMonitor, type MicMonitorHandle } from "@/lib/audio/mic-monitor";
import {
  ASSESSMENT_PROMPTS,
  ASSESSMENT_SEGMENT_KINDS,
  segmentDisplayLabel,
  totalAssessmentTargetSeconds,
  type AssessmentSegmentKind,
} from "@/lib/assessment/segments";
import type { AssessmentBaselinePayload } from "@/lib/assessment/baseline-results-payload";
import { parseFinalizePayload } from "@/lib/assessment/parse-baseline-payload";
import { readJsonResponse } from "@/lib/api/read-json-response";
import {
  AssessmentResultsSummary,
} from "./assessment-results-summary";
import { VisualPromptScene } from "./visual-prompt-scene";

type Props = { goalId: string | null };

type SegmentSubPhase = "context" | "ready" | "recording" | "uploading" | "complete";
type GlobalPhase = "loading" | "intro" | "segment" | "finalizing" | "done" | "error";

function StepDots({ completed, currentIndex }: { completed: Set<AssessmentSegmentKind>; currentIndex: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {ASSESSMENT_SEGMENT_KINDS.map((k, i) => {
        const done = completed.has(k);
        const isCurrent = i === currentIndex;
        return (
          <li
            key={k}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
              done && "border-primary/40 bg-primary/10 text-primary",
              !done && isCurrent && "border-accent/40 bg-accent/10 text-accent-foreground",
              !done && !isCurrent && "border-border/60 text-muted-foreground",
            )}
          >
            {done ? <CheckCircle2 className="size-3.5" aria-hidden /> : <span className="font-mono">{i + 1}</span>}
            <span>{segmentDisplayLabel(k)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function FakeGenerationBar({ durationMs = 15_000 }: { durationMs?: number }) {
  // Progress visualization for the "AI processes recording and generates baseline scores within 15 seconds" promise
  // in the spec. Real work happens on the server; this bar keeps the wait honest and concrete.
  const [pct, setPct] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(elapsed / durationMs, 0.97);
      setPct(Math.round(ratio * 100));
      if (ratio >= 0.97) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [durationMs]);
  return <Progress value={pct} />;
}

export function AssessmentMultiRecorder({ goalId }: Props) {
  const [phase, setPhase] = React.useState<GlobalPhase>("loading");
  const [completed, setCompleted] = React.useState<Set<AssessmentSegmentKind>>(new Set());
  const [currentIndex, setCurrentIndex] = React.useState<number>(0);
  const [subPhase, setSubPhase] = React.useState<SegmentSubPhase>("context");
  const [error, setError] = React.useState<string | null>(null);
  const [micWarning, setMicWarning] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<AssessmentBaselinePayload | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);

  const mrRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const monitorRef = React.useRef<MicMonitorHandle | null>(null);
  const startedAtRef = React.useRef<number | null>(null);
  const tickerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const currentKind = ASSESSMENT_SEGMENT_KINDS[currentIndex];
  const currentPrompt = currentKind ? ASSESSMENT_PROMPTS[currentKind] : null;

  const teardownStream = React.useCallback(() => {
    monitorRef.current?.stop();
    monitorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => teardownStream(), [teardownStream]);

  // On mount, hydrate the resume state from the server. If any draft segments exist we jump straight to the first
  // missing one so refreshes mid-flow do not reset progress.
  const hydrate = React.useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/assessment/draft", { credentials: "include" });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(`Could not load draft (${res.status})`);
      const completedKinds = Array.isArray(json.completedKinds)
        ? (json.completedKinds.filter(
            (k) =>
              typeof k === "string" &&
              (ASSESSMENT_SEGMENT_KINDS as readonly string[]).includes(k),
          ) as AssessmentSegmentKind[])
        : [];
      const set = new Set<AssessmentSegmentKind>(completedKinds);
      setCompleted(set);
      // Walk segments in spec order, stop at first one not yet recorded.
      const firstMissingIdx = ASSESSMENT_SEGMENT_KINDS.findIndex((k) => !set.has(k));
      if (firstMissingIdx === -1) {
        // Everything's recorded — go straight to finalize step, but show an intro so they can re-record if desired.
        setCurrentIndex(ASSESSMENT_SEGMENT_KINDS.length - 1);
        setSubPhase("complete");
        setPhase("segment");
      } else {
        setCurrentIndex(firstMissingIdx);
        setSubPhase("context");
        setPhase(set.size > 0 ? "segment" : "intro");
      }
    } catch {
      setCompleted(new Set());
      setCurrentIndex(0);
      setSubPhase("context");
      setPhase("intro");
    }
  }, []);

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const startSegment = React.useCallback(async () => {
    if (!currentKind) return;
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
        setMicWarning("We barely hear you. Check your mic and that the right input device is selected.");
      });
      mr.start(250);
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      tickerRef.current = setInterval(() => {
        if (startedAtRef.current != null) {
          setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      }, 250);
      setSubPhase("recording");
    } catch {
      setError("Microphone permission is required. Allow access and try again.");
      teardownStream();
      setSubPhase("ready");
    }
  }, [currentKind, teardownStream]);

  const stopSegment = React.useCallback(async () => {
    const mr = mrRef.current;
    if (!mr || !currentKind) return;
    setSubPhase("uploading");
    const end = Date.now();
    const durationMs = startedAtRef.current != null ? end - startedAtRef.current : 0;
    const blob = await stopMediaRecorderAndBuildBlob(mr, chunksRef.current);
    teardownStream();
    mrRef.current = null;

    const captureError = recordingValidationError(blob, durationMs, {
      minDurationMs: 2_000,
      shortDurationMessage: "Recording was very short. Speak for at least a few seconds, then stop.",
      emptyCaptureMessage:
        "No audio was captured. Check your microphone and input device, then try again.",
    });
    if (captureError) {
      setError(captureError);
      setSubPhase("ready");
      return;
    }

    const form = new FormData();
    form.set("audio", blob, `${currentKind}.webm`);
    form.set("segmentKind", currentKind);
    form.set("durationMs", String(durationMs));
    if (goalId) form.set("goalId", goalId);

    try {
      const res = await fetch("/api/assessment/draft/segment", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await readJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Save failed (${res.status})`);
      }
      if (typeof json.userId === "string") setClientAuravoUserId(json.userId);
      const completedKinds = Array.isArray(json.completedKinds)
        ? (json.completedKinds.filter(
            (k) =>
              typeof k === "string" &&
              (ASSESSMENT_SEGMENT_KINDS as readonly string[]).includes(k),
          ) as AssessmentSegmentKind[])
        : [];
      setCompleted(new Set(completedKinds));
      setSubPhase("complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      setSubPhase("ready");
    }
  }, [currentKind, goalId, teardownStream]);

  const advance = React.useCallback(() => {
    const nextMissing = ASSESSMENT_SEGMENT_KINDS.findIndex((k, i) => i > currentIndex && !completed.has(k));
    if (nextMissing === -1) {
      // Either everything is recorded or all remaining were already completed before this segment. Move to the
      // first remaining (any) just in case learners re-recorded in an unusual order.
      const anyMissing = ASSESSMENT_SEGMENT_KINDS.findIndex((k) => !completed.has(k));
      if (anyMissing === -1) {
        setSubPhase("complete");
        setCurrentIndex(ASSESSMENT_SEGMENT_KINDS.length - 1);
        return;
      }
      setCurrentIndex(anyMissing);
    } else {
      setCurrentIndex(nextMissing);
    }
    setSubPhase("context");
    setError(null);
    setMicWarning(null);
  }, [completed, currentIndex]);

  const reRecord = React.useCallback((kind: AssessmentSegmentKind) => {
    const idx = ASSESSMENT_SEGMENT_KINDS.indexOf(kind);
    if (idx < 0) return;
    setCurrentIndex(idx);
    setSubPhase("context");
    setError(null);
    setMicWarning(null);
  }, []);

  const startOver = React.useCallback(async () => {
    try {
      await fetch("/api/assessment/draft", { method: "DELETE", credentials: "include" });
    } catch {
      /* ignore */
    }
    setCompleted(new Set());
    setCurrentIndex(0);
    setSubPhase("context");
    setError(null);
    setMicWarning(null);
    setPhase("intro");
  }, []);

  const finalize = React.useCallback(async () => {
    setPhase("finalizing");
    setError(null);
    try {
      const res = await fetch("/api/assessment/draft/finalize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(goalId ? { goalId } : {}),
      });
      const json = await readJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Could not generate baseline (${res.status})`);
      }
      if (typeof json.userId === "string") setClientAuravoUserId(json.userId);
      if (typeof json.sessionId === "string" && typeof json.userId === "string") {
        try {
          window.sessionStorage.setItem(
            AURAVO_BASELINE_HANDOFF_SESSION_STORAGE_KEY,
            JSON.stringify({ sessionId: json.sessionId, userId: json.userId }),
          );
        } catch {
          /* private mode / quota */
        }
      }
      const parsed = parseFinalizePayload(json);
      if (!parsed) throw new Error("Server returned an unexpected payload.");
      setResults(parsed);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate baseline.");
      setPhase("segment");
      setSubPhase("complete");
    }
  }, [goalId]);

  const goToDashboard = React.useCallback(() => {
    if (results) setClientAuravoUserId(results.userId);
    clearClientPendingBaselineSession();
    window.location.assign("/dashboard");
  }, [results]);

  const allDone = completed.size === ASSESSMENT_SEGMENT_KINDS.length;
  const percentComplete = Math.round((completed.size / ASSESSMENT_SEGMENT_KINDS.length) * 100);

  if (phase === "loading") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading assessment…
        </CardContent>
      </Card>
    );
  }

  if (phase === "intro") {
    return (
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">Initial assessment · about {Math.round(totalAssessmentTargetSeconds() / 60)} minutes of speaking</p>
          <CardTitle className="text-2xl">Four short prompts. We measure six dimensions.</CardTitle>
          <CardDescription>
            You will read one passage, answer two open questions, and describe a photograph. After the last
            recording we transcribe locally and produce a baseline across pronunciation, grammar, fluency, vocabulary,
            filler words, and pacing within about 15 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Microphone access</p>
            <p className="mt-1">
              We use your mic only while a recording is active. Audio stays on this machine under{" "}
              <code className="rounded bg-muted px-1">data/uploads</code>; we do not upload it to a public service.
            </p>
          </div>
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {ASSESSMENT_SEGMENT_KINDS.map((k, i) => (
              <li key={k} className="flex gap-2 rounded-md border border-border/60 p-2">
                <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
                <div>
                  <p className="font-medium">{segmentDisplayLabel(k)}</p>
                  <p className="text-xs text-muted-foreground">{ASSESSMENT_PROMPTS[k].title}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button
            variant="glow"
            className="gap-2"
            onClick={() => {
              setCurrentIndex(0);
              setSubPhase("context");
              setPhase("segment");
            }}
          >
            <Mic className="size-4" />
            Begin assessment
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "finalizing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Generating your baseline…</CardTitle>
          <CardDescription>About 15 seconds. We are transcribing the segments and scoring six dimensions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FakeGenerationBar />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Hold tight.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done" && results) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Your speaking baseline is ready</p>
              <p className="text-sm text-muted-foreground">
                When you continue, your personalized practice plan picks up from these results.
              </p>
            </div>
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/assessment/results">View saved results later</Link>
            </Button>
            <Button variant="glow" className="gap-2" onClick={goToDashboard}>
              Start my practice plan
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
        <AssessmentResultsSummary results={results} />
      </div>
    );
  }

  // phase === "segment" (or fallback) — render the current segment UI.
  if (!currentKind || !currentPrompt) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Something went wrong picking the next segment. {" "}
          <Button size="sm" variant="outline" onClick={() => void hydrate()} className="ml-2">
            Reload
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isCurrentRecorded = completed.has(currentKind);
  const targetSec = currentPrompt.targetSeconds;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <StepDots completed={completed} currentIndex={currentIndex} />
          <p className="text-xs text-muted-foreground">
            {completed.size} of {ASSESSMENT_SEGMENT_KINDS.length} segments recorded · {percentComplete}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void startOver()}>
            <RotateCcw className="size-3.5" />
            Start over
          </Button>
          {allDone && (
            <Button size="sm" variant="glow" className="gap-1.5" onClick={() => void finalize()}>
              Generate baseline
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Segment {currentIndex + 1} of {ASSESSMENT_SEGMENT_KINDS.length} · {segmentDisplayLabel(currentKind)}
          </p>
          <CardTitle className="text-xl">{currentPrompt.title}</CardTitle>
          <CardDescription>{currentPrompt.intro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentKind === "passage" && currentPrompt.passage && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-base leading-relaxed">
              {currentPrompt.passage}
            </div>
          )}
          {currentKind === "visual" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <VisualPromptScene className="w-full max-w-[320px] rounded-2xl border border-border/70" />
              <p className="text-sm text-muted-foreground">
                Pretend the listener cannot see this. Describe the setting, who you see, what they are doing, and one
                observation about the scene.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {micWarning && subPhase === "recording" && (
            <p className="rounded-md border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
              {micWarning}
            </p>
          )}

          {isCurrentRecorded && subPhase !== "recording" && subPhase !== "uploading" && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
                You already recorded this segment.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You can re-record to overwrite, or move on with the existing take.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div
              className={cn(
                "flex items-center gap-2",
                subPhase === "recording" ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Mic className="size-4" />
              <span>
                {subPhase === "recording"
                  ? "Recording…"
                  : subPhase === "uploading"
                    ? "Saving…"
                    : isCurrentRecorded
                      ? "Recorded"
                      : "Tap start when you are ready"}
              </span>
            </div>
            {subPhase === "recording" && (
              <span className="tabular-nums text-muted-foreground">
                {elapsedSec}s / target {targetSec}s
              </span>
            )}
          </div>

          {subPhase === "recording" && (
            <Progress value={Math.min(100, Math.round((elapsedSec / targetSec) * 100))} />
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="glow"
              className="gap-2"
              disabled={subPhase === "recording" || subPhase === "uploading"}
              onClick={() => void startSegment()}
            >
              <Mic className="size-4" />
              {isCurrentRecorded ? "Re-record" : "Start recording"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={subPhase !== "recording"}
              onClick={() => void stopSegment()}
            >
              <Square className="size-4" />
              Stop &amp; save
            </Button>
            {subPhase === "complete" && !allDone && (
              <Button type="button" variant="outline" className="gap-2" onClick={advance}>
                Next segment
                <ArrowRight className="size-4" />
              </Button>
            )}
            {subPhase === "complete" && allDone && (
              <Button type="button" variant="glow" className="gap-2" onClick={() => void finalize()}>
                Generate baseline
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick navigation between recorded segments — keeps re-record one click away. */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Your recordings</p>
          <Separator />
          <ul className="space-y-2">
            {ASSESSMENT_SEGMENT_KINDS.map((k, i) => {
              const done = completed.has(k);
              const isCurrent = i === currentIndex;
              return (
                <li
                  key={k}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                    isCurrent ? "border-primary/40 bg-primary/5" : "border-border/60",
                  )}
                >
                  <div>
                    <p className="font-medium">{segmentDisplayLabel(k)}</p>
                    <p className="text-xs text-muted-foreground">{ASSESSMENT_PROMPTS[k].title}</p>
                  </div>
                  {done ? (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => reRecord(k)}>
                      <RotateCcw className="size-3.5" />
                      Re-record
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not recorded yet</span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
