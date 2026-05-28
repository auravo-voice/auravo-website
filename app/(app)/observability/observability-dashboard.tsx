"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import type { ExpectedSimilarity, ObservabilitySessionRow } from "@/db/queries/observability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ReviewDraft = {
  expectedSimilarity: ExpectedSimilarity;
  note: string;
};

function fmtDuration(ms: number | null): string {
  if (!ms || ms < 1_000) return "—";
  return `${Math.round(ms / 1000)}s`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

function fmtNum(v: number | null, d = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

export function ObservabilityDashboard({ rows }: { rows: ObservabilitySessionRow[] }) {
  const [drafts, setDrafts] = React.useState<Record<string, ReviewDraft>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.sessionId,
        {
          expectedSimilarity: r.review?.expectedSimilarity ?? "unknown",
          note: r.review?.note ?? "",
        },
      ]),
    ),
  );
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [messages, setMessages] = React.useState<Record<string, string>>({});

  const total = rows.length;
  const withTranscript = rows.filter((r) => r.hasTranscript).length;
  const degraded = rows.filter((r) => r.degraded).length;
  const coachFallback = rows.filter((r) => r.coachFallbackUsed).length;

  async function saveRow(sessionId: string) {
    const d = drafts[sessionId];
    if (!d) return;
    setSaving((s) => ({ ...s, [sessionId]: true }));
    setMessages((m) => ({ ...m, [sessionId]: "" }));
    try {
      const res = await fetch("/api/observability/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          expectedSimilarity: d.expectedSimilarity,
          note: d.note,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Save failed (${res.status}).`);
      }
      setMessages((m) => ({ ...m, [sessionId]: "Saved" }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed.";
      setMessages((m) => ({ ...m, [sessionId]: msg }));
    } finally {
      setSaving((s) => ({ ...s, [sessionId]: false }));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Observability</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Recording and analysis quality</h1>
        <p className="text-sm text-muted-foreground">
          Track session-level recording/transcription health and capture manual QA verdicts.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total sessions</CardDescription>
            <CardTitle className="text-2xl">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Has transcript</CardDescription>
            <CardTitle className="text-2xl">{withTranscript}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Degraded analysis</CardDescription>
            <CardTitle className="text-2xl">{degraded}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Coach fallback used</CardDescription>
            <CardTitle className="text-2xl">{coachFallback}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent recordings</CardTitle>
          <CardDescription>
            Admin verdict can be edited per row. Similarity compares transcript/analysis to what a reviewer expected from
            the audio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No local SQLite sessions found for observability.</p>
          ) : null}

          {rows.map((row) => {
            const d = drafts[row.sessionId];
            const busy = saving[row.sessionId] === true;
            return (
              <div key={row.sessionId} className="rounded-xl border border-border/70 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{row.kind}</Badge>
                  <Badge variant={row.hasTranscript ? "accent" : "outline"}>
                    {row.hasTranscript ? "Transcript OK" : "No transcript"}
                  </Badge>
                  {row.degraded ? <Badge variant="outline">Degraded</Badge> : null}
                  {row.coachFallbackUsed ? <Badge variant="outline">Coach fallback</Badge> : null}
                  <span className="text-xs text-muted-foreground">{fmtDate(row.createdAt)}</span>
                </div>

                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                  <div>Session: {row.sessionId}</div>
                  <div>User: {row.displayName}</div>
                  <div>Duration: {fmtDuration(row.durationMs)}</div>
                  <div>Transcript chars: {row.transcriptChars}</div>
                  <div>Adapter: {row.adapter ?? "—"}</div>
                  <div>WPM: {fmtNum(row.wpm)}</div>
                  <div>Fillers/min: {fmtNum(row.fillerPerMinute, 1)}</div>
                  <div>ASR confidence mean: {fmtNum(row.asrConfidenceMean, 2)}</div>
                  <div>Pause count: {fmtNum(row.pauseCount)}</div>
                  <div>Long pauses: {fmtNum(row.longPauseCount)}</div>
                  <div>Avg score: {fmtNum(row.scoresAverage)}</div>
                  <div>Has audio: {row.hasAudio ? "yes" : "no"}</div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-[220px_1fr_auto]">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={d?.expectedSimilarity ?? "unknown"}
                    onChange={(e) => {
                      const v = e.target.value as ExpectedSimilarity;
                      setDrafts((prev) => ({
                        ...prev,
                        [row.sessionId]: { expectedSimilarity: v, note: prev[row.sessionId]?.note ?? "" },
                      }));
                    }}
                  >
                    <option value="unknown">unknown</option>
                    <option value="similar">similar</option>
                    <option value="partially_similar">partially_similar</option>
                    <option value="not_similar">not_similar</option>
                  </select>
                  <Input
                    value={d?.note ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((prev) => ({
                        ...prev,
                        [row.sessionId]: {
                          expectedSimilarity: prev[row.sessionId]?.expectedSimilarity ?? "unknown",
                          note: v,
                        },
                      }));
                    }}
                    placeholder="Admin QA note (optional)"
                  />
                  <Button onClick={() => saveRow(row.sessionId)} disabled={busy} className="gap-2">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save
                  </Button>
                </div>

                {messages[row.sessionId] ? (
                  <p className="mt-2 text-xs text-muted-foreground">{messages[row.sessionId]}</p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
