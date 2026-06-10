"use client";

import * as React from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { warningBannerClass } from "@/lib/ui/warning-styles";
import { SimulationRunner, type RunnerScenarioInit } from "../simulation-runner";

type GeneratedScenario = {
  title: string;
  description: string;
  personaName: string;
  personaSummary: string;
  opener: string;
  topics: string[];
};

export function CustomScenarioFlow() {
  const [description, setDescription] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [scenario, setScenario] = React.useState<GeneratedScenario | null>(null);

  const generate = React.useCallback(async () => {
    setError(null);
    setWarning(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/simulations/custom", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `Could not generate (${res.status})`);
      }
      const s = json.scenario as GeneratedScenario | undefined;
      if (!s) throw new Error("Empty scenario.");
      setScenario({
        title: String(s.title ?? "Custom practice scenario"),
        description: String(s.description ?? description.trim().slice(0, 200)),
        personaName: String(s.personaName ?? "your partner"),
        personaSummary: String(s.personaSummary ?? ""),
        opener: String(s.opener ?? ""),
        topics: Array.isArray(s.topics) ? s.topics.map(String).slice(0, 6) : [],
      });
      if (typeof json.coachWarning === "string") setWarning(json.coachWarning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the coach.");
    } finally {
      setGenerating(false);
    }
  }, [description]);

  if (scenario) {
    const init: RunnerScenarioInit = {
      kind: "custom",
      title: scenario.title,
      description: scenario.description,
      personaName: scenario.personaName,
      personaSummary: scenario.personaSummary,
      opener: scenario.opener,
      topics: scenario.topics,
    };
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Edit scenario</CardTitle>
              <CardDescription>Tweak any field before starting, or regenerate to try a different draft.</CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setScenario(null)}>
              <RotateCcw className="size-3.5" />
              Regenerate
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Title</Label>
              <Input value={scenario.title} onChange={(e) => setScenario({ ...scenario, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Persona name</Label>
              <Input
                value={scenario.personaName}
                onChange={(e) => setScenario({ ...scenario, personaName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={scenario.description}
                onChange={(e) => setScenario({ ...scenario, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Persona summary</Label>
              <Textarea
                value={scenario.personaSummary}
                onChange={(e) => setScenario({ ...scenario, personaSummary: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Opener</Label>
              <Textarea
                value={scenario.opener}
                onChange={(e) => setScenario({ ...scenario, opener: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Follow-up topics (comma-separated, optional)</Label>
              <Input
                value={scenario.topics.join(", ")}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    topics: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 6),
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
        {warning && (
          <p className={warningBannerClass}>
            Coach degraded: {warning}
          </p>
        )}
        <SimulationRunner init={init} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Describe your scenario</CardTitle>
        <CardDescription>One or two sentences. The more specific, the better the persona we generate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A skeptical regional VP I am pitching for an expansion deal. They care about churn risk and timeline, not features."
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          variant="glow"
          className="gap-2"
          disabled={generating || description.trim().length < 8}
          onClick={() => void generate()}
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {generating ? "Generating…" : "Generate scenario"}
        </Button>
      </CardContent>
    </Card>
  );
}
