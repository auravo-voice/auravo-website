"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Flag,
  HelpCircle,
  Loader2,
  Mic,
  Square,
  ThumbsUp,
  Timer,
  User,
  Zap,
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { recordingValidationError, stopMediaRecorderAndBuildBlob } from "@/lib/audio/finish-recording";
import {
  startMicLevelMonitor,
  type MicMonitorHandle,
} from "@/lib/audio/mic-monitor";
import type { RadarDimension } from "@/lib/coach/schemas";
import type {
  MeetingPlan,
  MeetingPrepContext,
} from "@/lib/meeting-prep/types";
import type { ConversationMetrics } from "@/lib/analysis/conversation";
import type { VoiceDeliveryPeek } from "@/lib/analysis/finalize-scorecard-parsers";
import {
  parseVoiceDeliveryPeek,
  parseConversationMetricsPayload,
} from "@/lib/analysis/finalize-scorecard-parsers";
import { VoiceAndConversationFeedback } from "@/components/analysis/voice-conversation-feedback";

const MIN_TURN_MS = 6_000; // Slightly under simulations' 8s — presentation chunks tend to be shorter, more frequent.
const QUICK_PREP_MS = 5 * 60_000;

type Turn = {
  role: "user" | "assistant";
  text: string;
  kind?: "question" | "pushback" | "continue" | "opener";
};

type Phase = "live" | "scoring" | "done" | "error";
type SubPhase = "awaiting_user" | "recording" | "uploading";

export type RehearsalInit = {
  sessionId: string;
  title: string;
  meetingLabel: string;
  audienceLabel: string;
  ctx: MeetingPrepContext;
  plan: MeetingPlan;
  opener: string;
  alreadyFinalized: boolean;
  initialTurns: { role: "user" | "assistant"; text: string }[];
};

type ScorecardPayload = {
  sessionId: string;
  averageScore: number;
  dimensions: RadarDimension[];
  userTurns: number;
  totalDurationMs: number | null;
  transcript: string;
  alignment: {
    score: number;
    missedTerms: string[];
    hitTerms: string[];
    agendaTermCount: number;
  };
  coach: { note: string; topFix: string; strongest: string };
  voicePeek: VoiceDeliveryPeek | null;
  conversation: ConversationMetrics | null;
  conversationCoachNotes: string[];
  degraded: boolean;
};

export function MeetingRehearser({ init }: { init: RehearsalInit }) {
  const [phase, setPhase] = React.useState<Phase>(init.alreadyFinalized ? "done" : "live");
  const [subPhase, setSubPhase] = React.useState<SubPhase>("awaiting_user");
  const [turns, setTurns] = React.useState<Turn[]>(() =>
    init.initialTurns.length > 0
      ? init.initialTurns.map((t, i) => ({
          role: t.role,
          text: t.text,
          kind: t.role === "assistant" && i === 0 ? "opener" : undefined,
        }))
      : [{ role: "assistant", text: init.opener, kind: "opener" }],
  );
  const [error, setError] = React.useState<string | null>(null);
  const [micWarning, setMicWarning] = React.useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [scorecard, setScorecard] = React.useState<ScorecardPayload | null>(null);
  const [quickRemainingMs, setQuickRemainingMs] = React.useState(QUICK_PREP_MS);
  // Initialised lazily inside a layout effect — Date.now() in a useRef initialiser is flagged as impure.
  const sessionStartRef = React.useRef<number>(0);
  React.useEffect(() => {
    if (sessionStartRef.current === 0) sessionStartRef.current = Date.now();
  }, []);

  const mrRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const monitorRef = React.useRef<MicMonitorHandle | null>(null);
  const startedAtRef = React.useRef<number | null>(null);
  const tickerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = React.useRef<HTMLDivElement | null>(null);
  const autoFinalizeRef = React.useRef(false);

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

  React.useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [turns.length]);

  // Quick-prep 5-minute countdown — auto-finalize if user is idle when it hits zero.
  React.useEffect(() => {
    if (init.ctx.mode !== "quick" || phase !== "live") return;
    const id = setInterval(() => {
      const remaining = Math.max(0, QUICK_PREP_MS - (Date.now() - sessionStartRef.current));
      setQuickRemainingMs(remaining);
    }, 250);
    return () => clearInterval(id);
  }, [init.ctx.mode, phase]);

  const endRehearsal = React.useCallback(async () => {
    if (phase !== "live") return;
    setPhase("scoring");
    setError(null);
    try {
      const res = await fetch("/api/meeting-prep/finalize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: init.sessionId }),
      });
      const jsonRaw = await res.json();
      const json = jsonRaw as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Finalize failed (${res.status})`);
      }
      const dims = Array.isArray(json.dimensions) ? (json.dimensions as RadarDimension[]) : [];
      const alignment = (json.alignment ?? {}) as ScorecardPayload["alignment"];
      const coach = (json.coach ?? { note: "", topFix: "", strongest: "" }) as ScorecardPayload["coach"];
      const voicePeek = parseVoiceDeliveryPeek(json);
      const conversation = parseConversationMetricsPayload(json.conversation);
      const coachNotes = Array.isArray(json.conversationCoachNotes)
        ? json.conversationCoachNotes.filter((x): x is string => typeof x === "string")
        : [];
      const card: ScorecardPayload = {
        sessionId: init.sessionId,
        averageScore: typeof json.averageScore === "number" ? Math.round(json.averageScore) : 0,
        dimensions: dims,
        userTurns: typeof json.userTurns === "number" ? json.userTurns : 0,
        totalDurationMs: typeof json.totalDurationMs === "number" ? json.totalDurationMs : null,
        transcript: typeof json.transcript === "string" ? json.transcript : "",
        alignment: {
          score: typeof alignment.score === "number" ? alignment.score : 0,
          missedTerms: Array.isArray(alignment.missedTerms) ? alignment.missedTerms : [],
          hitTerms: Array.isArray(alignment.hitTerms) ? alignment.hitTerms : [],
          agendaTermCount: typeof alignment.agendaTermCount === "number" ? alignment.agendaTermCount : 0,
        },
        coach,
        voicePeek,
        conversation,
        conversationCoachNotes: coachNotes,
        degraded: json.degraded === true,
      };
      setScorecard(card);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finalize the rehearsal.");
      setPhase("live");
    }
  }, [init.sessionId, phase]);

  // Auto-finalize at the 5-minute mark in quick prep if at least one turn has been recorded. The finalize call is
  // deferred via a microtask so we never call setState synchronously inside an effect body.
  React.useEffect(() => {
    if (init.ctx.mode !== "quick" || phase !== "live") return;
    if (quickRemainingMs > 0) return;
    if (autoFinalizeRef.current) return;
    const userTurnsCount = turns.filter((t) => t.role === "user").length;
    if (userTurnsCount < 1) return;
    autoFinalizeRef.current = true;
    const t = setTimeout(() => {
      void endRehearsal();
    }, 0);
    return () => clearTimeout(t);
  }, [init.ctx.mode, phase, quickRemainingMs, turns, endRehearsal]);

  const startRecording = React.useCallback(async () => {
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
        setMicWarning("We barely hear you. Check your mic and selected input.");
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
      teardown();
      setSubPhase("awaiting_user");
    }
  }, [teardown]);

  const stopAndSendTurn = React.useCallback(async () => {
    const mr = mrRef.current;
    if (!mr) return;
    setSubPhase("uploading");
    const end = Date.now();
    const durationMs = startedAtRef.current != null ? end - startedAtRef.current : 0;
    const blob = await stopMediaRecorderAndBuildBlob(mr, chunksRef.current);
    teardown();
    mrRef.current = null;

    const captureError = recordingValidationError(blob, durationMs, {
      minDurationMs: MIN_TURN_MS,
      shortDurationMessage: `That was very short. Speak for at least ${Math.ceil(MIN_TURN_MS / 1000)} seconds so the audience has something to react to.`,
      emptyCaptureMessage:
        "No audio was captured. Check your microphone and input device, then try again.",
    });
    if (captureError) {
      setError(captureError);
      setSubPhase("awaiting_user");
      return;
    }

    const form = new FormData();
    form.set("audio", blob, "turn.webm");
    form.set("sessionId", init.sessionId);
    form.set("durationMs", String(durationMs));

    try {
      const res = await fetch("/api/meeting-prep/turn", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Turn failed (${res.status})`);
      }
      const userTurn = json.userTurn as { text?: unknown } | undefined;
      const assistantTurn = json.assistantTurn as { text?: unknown; kind?: unknown } | undefined;
      if (typeof userTurn?.text === "string" && typeof assistantTurn?.text === "string") {
        const replyKind =
          assistantTurn.kind === "question" || assistantTurn.kind === "pushback" || assistantTurn.kind === "continue"
            ? assistantTurn.kind
            : undefined;
        setTurns((t) => [
          ...t,
          { role: "user", text: userTurn.text as string },
          { role: "assistant", text: assistantTurn.text as string, kind: replyKind },
        ]);
      }
      setSubPhase("awaiting_user");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Turn save failed.");
      setSubPhase("awaiting_user");
    }
  }, [init.sessionId, teardown]);

  const userTurnsCount = turns.filter((t) => t.role === "user").length;

  if (phase === "scoring") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Scoring your rehearsal…</CardTitle>
          <CardDescription>
            Whisper + optional openSMILE / VAD + agenda pass. Same six dimensions as practice and simulations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={undefined as unknown as number} />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Hold tight.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done" && scorecard) {
    return <RehearsalScorecard scorecard={scorecard} />;
  }

  if (phase === "done" && !scorecard) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rehearsal already finalized</CardTitle>
          <CardDescription>
            This session was scored earlier. Open the progress journal to compare it against your other rehearsals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/progress">Open progress</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // phase === "live"
  return (
    <div className="space-y-4">
      <PlanSidebar plan={init.plan} mode={init.ctx.mode} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Live · audience: {init.audienceLabel.toLowerCase()}
            </p>
            <CardTitle className="text-lg leading-snug">{init.title}</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {init.ctx.difficulty === "easy"
                ? "Supportive"
                : init.ctx.difficulty === "medium"
                  ? "Engaged"
                  : "Skeptical"}
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <Timer className="size-3" />
              {userTurnsCount} {userTurnsCount === 1 ? "turn" : "turns"}
            </Badge>
            {init.ctx.mode === "quick" && (
              <Badge variant="outline" className="gap-1.5 border-yellow-400/40 bg-yellow-500/10 text-yellow-100">
                <Zap className="size-3" />
                Quick: {Math.floor(quickRemainingMs / 1000)}s
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={transcriptRef}
            className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-4"
          >
            {turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">The conversation will appear here.</p>
            ) : (
              turns.map((t, i) => <ChatBubble key={i} turn={t} />)
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4" />
              <span>{error}</span>
            </div>
          )}
          {micWarning && subPhase === "recording" && (
            <p className="rounded-md border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
              {micWarning}
            </p>
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
                  ? `Recording… ${elapsedSec}s`
                  : subPhase === "uploading"
                    ? "Transcribing your turn and asking the audience to react…"
                    : "Your turn"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="glow"
              className="gap-2"
              disabled={subPhase !== "awaiting_user"}
              onClick={() => void startRecording()}
            >
              <Mic className="size-4" />
              Record this chunk
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={subPhase !== "recording"}
              onClick={() => void stopAndSendTurn()}
            >
              <Square className="size-4" />
              Send to audience
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={subPhase !== "awaiting_user" || userTurnsCount < 1}
              onClick={() => void endRehearsal()}
            >
              <Flag className="size-4" />
              End &amp; score
            </Button>
          </div>

          {userTurnsCount < 1 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              Record at least one chunk so we have something to score against your agenda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChatBubble({ turn }: { turn: Turn }) {
  const Icon = turn.role === "user" ? User : Bot;
  const isUser = turn.role === "user";
  let badge: { label: string; tone: string; Icon: typeof HelpCircle } | null = null;
  if (turn.role === "assistant") {
    if (turn.kind === "question") badge = { label: "Question", tone: "border-blue-400/40 bg-blue-500/10 text-blue-100", Icon: HelpCircle };
    else if (turn.kind === "pushback") badge = { label: "Pushback", tone: "border-orange-400/40 bg-orange-500/10 text-orange-100", Icon: AlertTriangle };
    else if (turn.kind === "continue") badge = { label: "Continue", tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100", Icon: ThumbsUp };
    else if (turn.kind === "opener") badge = { label: "Cue", tone: "border-border/60 bg-muted/30 text-muted-foreground", Icon: Bot };
  }
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse text-right" : "flex-row text-left")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border",
          isUser ? "border-primary/40 bg-primary/10 text-primary" : "border-accent/40 bg-accent/10",
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div
        className={cn(
          "max-w-[80%] space-y-1 rounded-2xl px-3 py-2 text-sm",
          isUser ? "border border-primary/30 bg-primary/5" : "border border-border/60 bg-card",
        )}
      >
        {badge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              badge.tone,
            )}
          >
            <badge.Icon className="size-3" />
            {badge.label}
          </span>
        )}
        <p className="leading-relaxed">{turn.text}</p>
      </div>
    </div>
  );
}

function PlanSidebar({ plan, mode }: { plan: MeetingPlan; mode: "full" | "quick" }) {
  const [open, setOpen] = React.useState(true);
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Your plan (visible while you rehearse)</CardTitle>
          <CardDescription>
            {mode === "quick" ? "Hit each point as fast as you cleanly can." : "Speak it; we'll catch what you missed at the end."}
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Show"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 text-sm">
          <PlanBlock label="Opening" value={plan.opening} />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Talking points</p>
            <ol className="space-y-1 pl-4 text-sm marker:text-muted-foreground" style={{ listStyleType: "decimal" }}>
              {plan.talkingPoints.map((tp) => (
                <li key={tp.id}>
                  <span className="font-medium">{tp.label}</span>
                  <span className="text-muted-foreground"> — {tp.hint}</span>
                </li>
              ))}
            </ol>
          </div>
          {plan.transitions.length > 0 && (
            <PlanBlock label="Transitions" value={plan.transitions.map((t) => `• ${t}`).join("\n")} />
          )}
          <PlanBlock label="Closing" value={plan.closing} />
        </CardContent>
      )}
    </Card>
  );
}

function PlanBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

function RehearsalScorecard({ scorecard }: { scorecard: ScorecardPayload }) {
  const minutes = scorecard.totalDurationMs == null ? "—" : (scorecard.totalDurationMs / 60_000).toFixed(1);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">Post-rehearsal feedback</p>
          <CardTitle className="text-2xl">Rehearsal saved.</CardTitle>
          <CardDescription>
            {scorecard.userTurns} {scorecard.userTurns === 1 ? "chunk" : "chunks"} · {minutes} min of speech · average score{" "}
            {scorecard.averageScore}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Average across six dimensions</span>
              <span>{scorecard.averageScore}%</span>
            </div>
            <Progress value={scorecard.averageScore} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {scorecard.dimensions.map((d) => (
              <div key={d.key} className="rounded-md border border-border/70 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="font-medium tabular-nums">{Math.round(d.score)}</p>
              </div>
            ))}
          </div>

          <VoiceAndConversationFeedback
            voice={scorecard.voicePeek}
            conversation={scorecard.conversation}
            conversationCoachNotes={scorecard.conversationCoachNotes}
            degraded={scorecard.degraded}
          />

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Agenda alignment
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {scorecard.alignment.score}
                <span className="text-base font-normal text-muted-foreground">/100</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {scorecard.alignment.agendaTermCount} key agenda terms detected
              </p>
              {scorecard.alignment.missedTerms.length > 0 && (
                <p className="mt-3 text-sm">
                  <span className="font-medium text-foreground">You did not mention:</span>{" "}
                  <span className="text-muted-foreground">
                    {scorecard.alignment.missedTerms.join(", ")}
                  </span>
                </p>
              )}
              {scorecard.alignment.hitTerms.length > 0 && (
                <p className="mt-1 text-sm">
                  <span className="font-medium text-foreground">You covered:</span>{" "}
                  <span className="text-muted-foreground">
                    {scorecard.alignment.hitTerms.join(", ")}
                  </span>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coach note</p>
              <p className="mt-1 text-sm leading-relaxed">{scorecard.coach.note}</p>
              <Separator className="my-3" />
              <div className="space-y-1.5 text-sm">
                <p>
                  <span className="font-medium text-foreground">Top fix:</span>{" "}
                  <span className="text-muted-foreground">{scorecard.coach.topFix}</span>
                </p>
                <p>
                  <span className="font-medium text-foreground">Strongest:</span>{" "}
                  <span className="text-muted-foreground">{scorecard.coach.strongest}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="glow" asChild className="gap-2">
              <Link href="/meeting-prep">
                New rehearsal
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/progress">See progress journal</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Full transcript</CardTitle>
          <CardDescription>
            Stored in SQLite alongside this session. Replay arrives with Phase F.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
            {scorecard.transcript || "(transcript empty)"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
