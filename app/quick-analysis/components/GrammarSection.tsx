"use client";

import { Badge } from "@/components/ui/badge";
import type { GrammarErrorType, GrammarFlag } from "@/lib/assessment/baseline-analysis-types";
import type { QuickAnalysisGrammarSnapshot } from "@/lib/quick-analysis/grammar-snapshot";
import { AnalysisSectionCard } from "./AnalysisSectionCard";

function grammarErrorBadgeLabel(errorType?: GrammarErrorType): string {
  switch (errorType) {
    case "tense":
      return "Tense";
    case "article":
      return "Article";
    case "preposition":
      return "Preposition";
    case "agreement":
      return "Agreement";
    case "word_choice":
      return "Word choice";
    default:
      return "Grammar";
  }
}

function GrammarFlagCard({ flag }: { flag: GrammarFlag }) {
  const isGroq = flag.source === "groq" && flag.correction;

  if (isGroq) {
    return (
      <li className="rounded-xl border border-border/60 bg-background/40 p-5">
        <Badge variant="outline" className="mb-3 uppercase tracking-wide">
          {grammarErrorBadgeLabel(flag.errorType)}
        </Badge>
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground">You said: </span>
          &ldquo;{flag.excerpt}&rdquo;
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">
          <span className="text-muted-foreground">Try: </span>
          &ldquo;{flag.correction}&rdquo;
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{flag.suggestion}</p>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-border/60 bg-background/40 p-5">
      <p className="font-medium text-foreground">{flag.label}</p>
      <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{flag.excerpt}&rdquo;</p>
      <p className="mt-2 text-sm text-muted-foreground">{flag.suggestion}</p>
    </li>
  );
}

type Props = {
  grammar: QuickAnalysisGrammarSnapshot;
};

export function GrammarSection({ grammar }: Props) {
  const { summary, strengths, flags } = grammar;
  const hasStrengths = strengths.length > 0;
  const hasFlags = flags.length > 0;

  return (
    <AnalysisSectionCard>
      <h3 className="text-xl font-semibold text-foreground">Grammar</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary ??
          "Patterns from your spoken answers — useful nudges, not a full edit of everything you said."}
      </p>

      {hasStrengths ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-foreground">What you did well</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {strengths.map((s, i) => (
              <li key={`grammar-strength-${i}`}>• {s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5">
        {!hasFlags ? (
          <p className="text-sm text-muted-foreground">
            No major grammar patterns stood out this time. Keep speaking — we will keep checking as you
            add more answers.
          </p>
        ) : (
          <ul className="space-y-3">
            {flags.map((g, i) => (
              <GrammarFlagCard key={`${g.label}-${i}-${g.excerpt.slice(0, 24)}`} flag={g} />
            ))}
          </ul>
        )}
      </div>
    </AnalysisSectionCard>
  );
}
