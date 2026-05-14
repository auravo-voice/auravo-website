"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Pencil,
  Sparkles,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AUDIENCES,
  MEETING_TYPES,
  type AudienceId,
  type MeetingPlan,
  type MeetingType,
  type RehearsalDifficulty,
  type RehearsalMode,
} from "@/lib/meeting-prep/types";

const DEFAULT_AGENDA = `- Q3 retention wins
- Risk: EU data residency questions
- Ask for expansion budget`;

type PlanResponse = { plan: MeetingPlan; coachWarning: string | null };

export function MeetingPrepPlanner() {
  const router = useRouter();
  const [agenda, setAgenda] = React.useState(DEFAULT_AGENDA);
  const [meetingType, setMeetingType] = React.useState<MeetingType>("presentation");
  const [audience, setAudience] = React.useState<AudienceId>("leadership");
  const [durationMin, setDurationMin] = React.useState(30);
  const [difficulty, setDifficulty] = React.useState<RehearsalDifficulty>("medium");
  const [plan, setPlan] = React.useState<MeetingPlan | null>(null);
  const [coachWarning, setCoachWarning] = React.useState<string | null>(null);

  const [loadingPlan, setLoadingPlan] = React.useState(false);
  const [loadingStart, setLoadingStart] = React.useState<RehearsalMode | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const generatePlan = React.useCallback(async () => {
    if (agenda.trim().length < 10) {
      setError("Paste at least one sentence of agenda before generating.");
      return;
    }
    setError(null);
    setCoachWarning(null);
    setLoadingPlan(true);
    try {
      const res = await fetch("/api/meeting-prep/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agenda, meetingType, audience, durationMin }),
      });
      const json = (await res.json()) as PlanResponse | { error?: string };
      if (!res.ok) {
        throw new Error("error" in json && typeof json.error === "string" ? json.error : `Plan failed (${res.status})`);
      }
      const ok = json as PlanResponse;
      setPlan(ok.plan);
      setCoachWarning(ok.coachWarning);
    } catch (e) {
      setPlan(null);
      setError(e instanceof Error ? e.message : "Could not generate the plan.");
    } finally {
      setLoadingPlan(false);
    }
  }, [agenda, meetingType, audience, durationMin]);

  const startRehearsal = React.useCallback(
    async (mode: RehearsalMode) => {
      if (!plan) {
        setError("Generate a plan first.");
        return;
      }
      setError(null);
      setLoadingStart(mode);
      try {
        const payload = {
          agenda,
          meetingType,
          audience,
          difficulty,
          mode,
          durationMin: mode === "quick" ? 5 : durationMin,
          plan,
        };
        const res = await fetch("/api/meeting-prep/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { ok?: boolean; sessionId?: string; error?: string };
        if (!res.ok || !json.sessionId) {
          throw new Error(json.error ?? `Could not start rehearsal (${res.status})`);
        }
        router.push(`/meeting-prep/rehearse?session=${encodeURIComponent(json.sessionId)}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the rehearsal.");
      } finally {
        setLoadingStart(null);
      }
    },
    [agenda, audience, difficulty, durationMin, meetingType, plan, router],
  );

  const quickPrep = React.useCallback(async () => {
    // One-tap path: generate the plan, then immediately start a 5-minute rehearsal once the plan resolves.
    if (agenda.trim().length < 10) {
      setError("Paste at least one sentence of agenda before starting quick prep.");
      return;
    }
    setError(null);
    setCoachWarning(null);
    setLoadingPlan(true);
    setLoadingStart("quick");
    try {
      const res = await fetch("/api/meeting-prep/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agenda, meetingType, audience, durationMin: 5 }),
      });
      const planJson = (await res.json()) as PlanResponse | { error?: string };
      if (!res.ok) {
        throw new Error("error" in planJson && typeof planJson.error === "string" ? planJson.error : `Plan failed (${res.status})`);
      }
      const ok = planJson as PlanResponse;
      setPlan(ok.plan);
      setCoachWarning(ok.coachWarning);

      const startRes = await fetch("/api/meeting-prep/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agenda,
          meetingType,
          audience,
          difficulty,
          mode: "quick",
          durationMin: 5,
          plan: ok.plan,
        }),
      });
      const startJson = (await startRes.json()) as { ok?: boolean; sessionId?: string; error?: string };
      if (!startRes.ok || !startJson.sessionId) {
        throw new Error(startJson.error ?? `Could not start rehearsal (${startRes.status})`);
      }
      router.push(`/meeting-prep/rehearse?session=${encodeURIComponent(startJson.sessionId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start quick prep.");
      setLoadingStart(null);
    } finally {
      setLoadingPlan(false);
    }
  }, [agenda, audience, difficulty, meetingType, router]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Meeting prep</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Rehearse the real room
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Paste your agenda, configure the audience, and rehearse with an AI audience that asks the questions you
            probably will get. Your local coach writes the plan; your local transcriber scores the run.
          </p>
        </div>
        <Button
          variant="secondary"
          className="gap-2 self-start"
          type="button"
          disabled={loadingPlan || loadingStart != null}
          onClick={() => void quickPrep()}
        >
          {loadingStart === "quick" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Quick prep (5 min)
        </Button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4" />
          <span>{error}</span>
        </div>
      )}
      {coachWarning && !error && (
        <div className="flex items-start gap-2 rounded-xl border border-yellow-400/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          <AlertTriangle className="mt-0.5 size-4" />
          <span>
            Local coach was slow — we filled in a deterministic plan you can still edit and rehearse with. ({coachWarning})
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Agenda &amp; context</CardTitle>
            <CardDescription>Drop the bullets, deck outline, or the email thread you&apos;re going off.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="agenda">Agenda or talking points</Label>
              <Textarea
                id="agenda"
                className="min-h-[160px]"
                placeholder="Paste bullets, a job description, or a deck outline…"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Meeting type</Label>
              <div className="flex flex-wrap gap-2">
                {MEETING_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMeetingType(t.id)}
                    className="rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Badge variant={meetingType === t.id ? "default" : "outline"} className="cursor-pointer">
                      {t.label}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Audience</Label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAudience(a.id)}
                    className="rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Badge variant={audience === a.id ? "secondary" : "outline"} className="cursor-pointer">
                      {a.label}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="duration"
                    type="number"
                    min={5}
                    max={120}
                    step={5}
                    value={durationMin}
                    onChange={(e) =>
                      setDurationMin(
                        Math.max(5, Math.min(120, Math.round(Number(e.target.value) || 30))),
                      )
                    }
                  />
                  <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Audience difficulty</Label>
                <div className="flex flex-wrap gap-2">
                  {(["easy", "medium", "hard"] as RehearsalDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition",
                        difficulty === d
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border/70 bg-muted/30 text-muted-foreground hover:border-border",
                      )}
                    >
                      {d === "easy" ? "Supportive" : d === "medium" ? "Engaged" : "Skeptical"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              type="button"
              className="w-full gap-2"
              variant="glow"
              disabled={loadingPlan || loadingStart != null || agenda.trim().length < 10}
              onClick={() => void generatePlan()}
            >
              {loadingPlan ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Asking your coach…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Generate plan
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/25 bg-gradient-to-b from-primary/10 via-card to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-4 text-primary" /> 2. Talking-point coach
            </CardTitle>
            <CardDescription>
              Edit anything before rehearsing. The audience will pull from your plan during the run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!plan && !loadingPlan && (
              <p className="text-muted-foreground">
                Generate to see an opening line, talking points, anticipated questions, and pushback — tailored to your
                agenda.
              </p>
            )}
            {loadingPlan && !plan && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Drafting your plan…
              </p>
            )}
            {plan && (
              <PlanEditor plan={plan} onChange={setPlan} />
            )}
          </CardContent>
        </Card>
      </div>

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Start rehearsal</CardTitle>
            <CardDescription>
              Full rehearsal mirrors your duration. Quick prep is a 5-minute rapid-fire pass.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="glow"
                className="gap-2"
                disabled={loadingStart != null}
                onClick={() => void startRehearsal("full")}
              >
                {loadingStart === "full" ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
                {loadingStart === "full" ? "Starting…" : `Start full rehearsal (${durationMin} min target)`}
                {loadingStart !== "full" && <ArrowRight className="size-4" />}
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                disabled={loadingStart != null}
                onClick={() => void startRehearsal("quick")}
              >
                {loadingStart === "quick" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                Quick prep (5 min)
              </Button>
              <Button
                variant="ghost"
                disabled={loadingPlan || loadingStart != null}
                onClick={() => void generatePlan()}
              >
                Regenerate plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlanEditor({
  plan,
  onChange,
}: {
  plan: MeetingPlan;
  onChange: (next: MeetingPlan) => void;
}) {
  const update = (patch: Partial<MeetingPlan>) => onChange({ ...plan, ...patch });

  const setTalkingPoint = (index: number, patch: Partial<MeetingPlan["talkingPoints"][number]>) => {
    const next = plan.talkingPoints.map((tp, i) => (i === index ? { ...tp, ...patch } : tp));
    update({ talkingPoints: next });
  };

  const setListItem = (
    key: "transitions" | "anticipatedQuestions",
    index: number,
    value: string,
  ) => {
    const next = plan[key].map((s, i) => (i === index ? value : s));
    update({ [key]: next });
  };

  const removeListItem = (
    key: "transitions" | "anticipatedQuestions",
    index: number,
  ) => {
    update({ [key]: plan[key].filter((_, i) => i !== index) });
  };

  const addListItem = (key: "transitions" | "anticipatedQuestions") => {
    update({ [key]: [...plan[key], ""] });
  };

  return (
    <div className="space-y-3">
      <EditField label="Opening" value={plan.opening} onChange={(v) => update({ opening: v })} multiline />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Talking points</p>
        <div className="space-y-2">
          {plan.talkingPoints.map((tp, i) => (
            <div key={tp.id ?? i} className="rounded-xl border border-border/70 bg-background/60 p-3">
              <Input
                value={tp.label}
                onChange={(e) => setTalkingPoint(i, { label: e.target.value })}
                className="h-8 text-sm font-medium"
                placeholder={`Talking point ${i + 1}`}
              />
              <Textarea
                value={tp.hint}
                onChange={(e) => setTalkingPoint(i, { hint: e.target.value })}
                className="mt-2 min-h-[60px] text-sm"
                placeholder="One-line rehearsal cue"
              />
            </div>
          ))}
        </div>
      </div>
      <ListEditor
        label="Transitions"
        items={plan.transitions}
        onChange={(i, v) => setListItem("transitions", i, v)}
        onRemove={(i) => removeListItem("transitions", i)}
        onAdd={() => addListItem("transitions")}
        placeholder="Short bridging line"
      />
      <EditField label="Closing" value={plan.closing} onChange={(v) => update({ closing: v })} multiline />
      <ListEditor
        label="Anticipated questions"
        items={plan.anticipatedQuestions}
        onChange={(i, v) => setListItem("anticipatedQuestions", i, v)}
        onRemove={(i) => removeListItem("anticipatedQuestions", i)}
        onAdd={() => addListItem("anticipatedQuestions")}
        placeholder="What they're likely to ask"
      />
      <EditField label="Strongest pushback" value={plan.pushback} onChange={(v) => update({ pushback: v })} multiline />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5" /> Edits stay local; nothing is saved until you press Start.
      </p>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[72px] text-sm"
          placeholder={label}
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-sm" placeholder={label} />
      )}
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  onRemove,
  onAdd,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">None yet — add one if relevant.</p>
      )}
      <div className="space-y-1.5">
        {items.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder={placeholder}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" type="button" onClick={onAdd} className="gap-1.5">
        <Pencil className="size-3.5" />
        Add another
      </Button>
    </div>
  );
}
