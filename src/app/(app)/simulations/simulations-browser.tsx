"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SCENARIO_CATEGORIES,
  type Scenario,
  type ScenarioCategory,
} from "@/lib/simulations/library";

type FilterCategory = "all" | ScenarioCategory;

export function SimulationsBrowser({ scenarios }: { scenarios: Scenario[] }) {
  const [category, setCategory] = React.useState<FilterCategory>("all");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return scenarios.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (q.length === 0) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.personaName.toLowerCase().includes(q)
      );
    });
  }, [scenarios, category, query]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-accent/25 bg-gradient-to-r from-accent/10 via-transparent to-primary/10">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Custom</p>
            <p className="font-medium">Describe any scenario and we generate one on the fly.</p>
            <p className="text-sm text-muted-foreground">
              Free text → tailored persona + opener → turn-by-turn rehearsal.
            </p>
          </div>
          <Button variant="glow" className="gap-2" asChild>
            <Link href="/simulations/custom">
              <Sparkles className="size-4" />
              Create custom scenario
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition",
              category === "all"
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/70 text-muted-foreground hover:border-border",
            )}
          >
            All ({scenarios.length})
          </button>
          {SCENARIO_CATEGORIES.map((c) => {
            const count = scenarios.filter((s) => s.category === c.id).length;
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:border-border",
                )}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search scenarios…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => {
          const categoryLabel =
            SCENARIO_CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category;
          return (
            <Card key={s.id} className="border-border/80 transition hover:border-primary/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{s.title}</CardTitle>
                  <Badge variant="secondary">{categoryLabel}</Badge>
                </div>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  With {s.personaName} · {s.recommendedMinutes.min}–{s.recommendedMinutes.max} min
                </p>
                <Button size="sm" variant="glow" asChild className="gap-1.5">
                  <Link href={`/simulations/${s.id}`}>
                    Start
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No scenarios matched. Try clearing the filter or{" "}
              <Link className="text-primary underline" href="/simulations/custom">
                create a custom scenario
              </Link>
              .
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
