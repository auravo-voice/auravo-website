"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Flag,
  Loader2,
  Mic,
  Square,
  Timer,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { warningBannerClass } from "@/lib/ui/warning-styles";
import { recordingValidationError, stopMediaRecorderAndBuildBlob } from "@/lib/audio/finish-recording";
import {
  startMicLevelMonitor,
  type MicMonitorHandle,
} from "@/lib/audio/mic-monitor";
import {
  setClientAuravoUserId,
} from "@/lib/auth/set-auravo-user-cookie-client";
import {
  DIFFICULTY_LABELS,
  type Difficulty,
} from "@/lib/simulations/library";
import type { RadarDimension } from "@/lib/coach/schemas";
import type { ConversationMetrics } from "@/lib/analysis/conversation";
import type { VoiceDeliveryPeek } from "@/lib/analysis/finalize-scorecard-parsers";
import {
  parseVoiceDeliveryPeek,
  parseConversationMetricsPayload,
} from "@/lib/analysis/finalize-scorecard-parsers";
import { VoiceAndConversationFeedback } from "@/components/analysis/voice-conversation-feedback";

const MIN_TURN_MS = 8_000; // Turn-level minimum so the AI has enough audio to react meaningfully.

export type RunnerScenarioInit =
  | { kind: "static"; scenarioId: string; title: string; description: string; personaName: string; topics: string[]; recommendedMinutes: { min: number; max: number } }
  | {
      kind: "custom";
      title: string;
      description: string;
      personaName: string;
      personaSummary: string;
      opener: string;
      topics: string[];
    };

type Turn = { role: "user" | "assistant"; text: string };

type Phase = "intro" | "starting" | "live" | "scoring" | "done" | "error";

export type SimulationScorecard = {
  sessionId: string;
  averageScore: number;
  dimensions: RadarDimension[];
  userTurns: number;
  totalDurationMs: number | null;
  transcript: string;
  voicePeek: VoiceDeliveryPeek | null;
  conversation: ConversationMetrics | null;
  conversationCoachNotes: string[];
  degraded: boolean;
};

export function SimulationRunner({ init }: { init: RunnerScenarioInit }) {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("medium");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [subPhase, setSubPhase] = React.useState<"awaiting_user" | "recording" | "uploading">("awaiting_user");
  const [error, setError] = React.useState<string | null>(null);
  const [micWarning, setMicWarning] = React.useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [scorecard, setScorecard] = React.useState<SimulationScorecard | null>(null);

  const mrRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const monitorRef = React.useRef<MicMonitorHandle | null>(null);
  const startedAtRef = React.useRef<number | null>(null);
  const tickerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = React.useRef<HTMLDivElement | null>(null);

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

  // Auto-scroll the transcript pane as new turns arrive.
  React.useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [turns.length]);

  const beginSimulation = React.useCallback(async () => {
    setPhase("starting");
    setError(null);
    try {
      const body =
        init.kind === "static"
          ? { scenarioId: init.scenarioId, difficulty }
          : {
              difficulty,
              custom: {
                title: init.title,
                description: init.description,
                personaName: init.personaName,
                personaSummary: init.personaSummary,
                opener: init.opener,
                topics: init.topics,
              },
            };
      const res = await fetch("/api/simulations/start", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Could not start (${res.status})`);
      }
      if (typeof json.userId === "string") setClientAuravoUserId(json.userId);
      if (typeof json.sessionId !== "string" || typeof json.openerText !== "string") {
        throw new Error("Unexpected start response.");
      }
      setSessionId(json.sessionId);
      setTurns([{ role: "assistant", text: json.openerText }]);
      setSubPhase("awaiting_user");
      setPhase("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the simulation.");
      setPhase("intro");
    }
  }, [difficulty, init]);

  const startRecording = React.useCallback(async () => {
    if (!sessionId) return;
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
      setSubPhase("recording");
    } catch {
      setError("Microphone permission is required. Allow access and try again.");
      teardown();
      setSubPhase("awaiting_user");
    }
  }, [sessionId, teardown]);

  const stopAndSendTurn = React.useCallback(async () => {
    const mr = mrRef.current;
    if (!mr || !sessionId) return;
    setSubPhase("uploading");
    const end = Date.now();
    const durationMs = startedAtRef.current != null ? end - startedAtRef.current : 0;
    const blob = await stopMediaRecorderAndBuildBlob(mr, chunksRef.current);
    teardown();
    mrRef.current = null;

    const captureError = recordingValidationError(blob, durationMs, {
      minDurationMs: MIN_TURN_MS,
      shortDurationMessage:
        "That was very short. Try at least eight seconds so the AI has something to react to.",
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
    form.set("sessionId", sessionId);
    form.set("durationMs", String(durationMs));

    try {
      const res = await fetch("/api/simulations/turn", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Turn failed (${res.status})`);
      }
      const userTurn = json.userTurn as { text?: unknown } | undefined;
      const assistantTurn = json.assistantTurn as { text?: unknown } | undefined;
      if (typeof userTurn?.text === "string" && typeof assistantTurn?.text === "string") {
        setTurns((t) => [...t, { role: "user", text: userTurn.text as string }, { role: "assistant", text: assistantTurn.text as string }]);
      }
      setSubPhase("awaiting_user");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Turn save failed.");
      setSubPhase("awaiting_user");
    }
  }, [sessionId, teardown]);

  const endSimulation = React.useCallback(async () => {
    if (!sessionId) return;
    setPhase("scoring");
    setError(null);
    try {
      const res = await fetch("/api/simulations/finalize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const jsonRaw = await res.json();
      const json = jsonRaw as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Finalize failed (${res.status})`);
      }
      const dims = Array.isArray(json.dimensions) ? (json.dimensions as RadarDimension[]) : [];
      const voicePeek = parseVoiceDeliveryPeek(json);
      const conversation = parseConversationMetricsPayload(json.conversation);
      const coachNotes = Array.isArray(json.conversationCoachNotes)
        ? json.conversationCoachNotes.filter((x): x is string => typeof x === "string")
        : [];
      const card: SimulationScorecard = {
        sessionId,
        averageScore:
          typeof json.averageScore === "number" ? Math.round(json.averageScore) : 0,
        dimensions: dims,
        userTurns: typeof json.userTurns === "number" ? json.userTurns : 0,
        totalDurationMs: typeof json.totalDurationMs === "number" ? json.totalDurationMs : null,
        transcript: typeof json.transcript === "string" ? json.transcript : "",
        voicePeek,
        conversation,
        conversationCoachNotes: coachNotes,
        degraded: json.degraded === true,
      };
      setScorecard(card);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finalize.");
      setPhase("live");
    }
  }, [sessionId]);

  const userTurnsCount = turns.filter((t) => t.role === "user").length;

  if (phase === "intro" || phase === "starting") {
    return (
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">Simulation</p>
          <CardTitle className="text-2xl">{init.title}</CardTitle>
          <CardDescription>{init.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition",
                  difficulty === d
                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                    : "border-border/70 bg-muted/20 hover:border-border",
                )}
              >
                <p className="font-medium">{DIFFICULTY_LABELS[d]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d === "easy"
                    ? "Warm partner. One follow-up per turn."
                    : d === "medium"
                      ? "Balanced. Probes the weakest part."
                      : "Skeptical and challenging. Multi-part questions."}
                </p>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Mic access</p>
            <p className="mt-1">
              You will record one turn at a time. We transcribe on the server and store turn audio in your
              your local profile. Aim for roughly{" "}
              {init.kind === "static" ? `${init.recommendedMinutes.min}–${init.recommendedMinutes.max} minutes` : "3–8 minutes"}{" "}
              of conversation.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="glow"
              className="gap-2"
              onClick={() => void beginSimulation()}
              disabled={phase === "starting"}
            >
              {phase === "starting" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
              {phase === "starting" ? "Starting…" : "Begin simulation"}
              {phase !== "starting" && <ArrowRight className="size-4" />}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/simulations">Back to library</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "scoring") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Scoring your simulation…</CardTitle>
          <CardDescription>
            Running Whisper, optional acoustic analysis + VAD, and the same six-dimensional scoring used everywhere in Auravo.
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
    const minutes = scorecard.totalDurationMs == null ? "—" : (scorecard.totalDurationMs / 60_000).toFixed(1);
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-muted-foreground">Scorecard</p>
            <CardTitle className="text-2xl">Simulation saved.</CardTitle>
            <CardDescription>
              {scorecard.userTurns} user {scorecard.userTurns === 1 ? "turn" : "turns"} · {minutes} min of speech ·
              average score {scorecard.averageScore}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Across six dimensions</span>
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
            <div className="flex flex-wrap gap-2">
              <Button variant="glow" asChild className="gap-2">
                <Link href="/dashboard">
                  Back to dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/progress">See progress journal</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/simulations">Run another simulation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Full conversation</CardTitle>
            <CardDescription>Replay arrives in Phase F; transcript is stored alongside each turn&apos;s audio file.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
              {scorecard.transcript}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  // phase === "live"
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Live · with {init.personaName}
            </p>
            <CardTitle className="text-lg leading-snug">{init.title}</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{DIFFICULTY_LABELS[difficulty]}</Badge>
            <Badge variant="secondary" className="gap-1.5">
              <Timer className="size-3" />
              {userTurnsCount} {userTurnsCount === 1 ? "turn" : "turns"}
            </Badge>
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
              turns.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3",
                    t.role === "user" ? "flex-row-reverse text-right" : "flex-row text-left",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border",
                      t.role === "user"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-accent/40 bg-accent/10",
                    )}
                  >
                    {t.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      t.role === "user"
                        ? "border border-primary/30 bg-primary/5"
                        : "border border-border/60 bg-card",
                    )}
                  >
                    {t.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {micWarning && subPhase === "recording" && (
            <p className={warningBannerClass}>
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
                    ? "Transcribing your turn and asking the partner to reply…"
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
              Record reply
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={subPhase !== "recording"}
              onClick={() => void stopAndSendTurn()}
            >
              <Square className="size-4" />
              Send turn
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={subPhase !== "awaiting_user" || userTurnsCount < 1}
              onClick={() => void endSimulation()}
            >
              <Flag className="size-4" />
              End &amp; score
            </Button>
          </div>

          {userTurnsCount < 1 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              Record at least one turn before ending so we have something to score.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
