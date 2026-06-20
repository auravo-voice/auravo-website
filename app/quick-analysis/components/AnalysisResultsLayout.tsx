"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { VocabularySuggestion } from "@/lib/analysis/vocabulary-analysis";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";
import type { QuickAnalysisGrammarSnapshot } from "@/lib/quick-analysis/grammar-snapshot";
import type {
  QuickAnalysisTranscriptSegment,
  QuickAnalysisWordConfidence,
} from "@/app/quick-analysis/pronunciation-types";
import { computePronunciationStats } from "@/app/quick-analysis/lib/pronunciation-stats";
import {
  derivePronunciationHighlightSource,
  type PronunciationHighlightSource,
} from "@/app/quick-analysis/lib/word-highlight";
import { ensureSegmentWordHighlights } from "@/lib/quick-analysis/word-confidences";
import { AnalysisSectionCard } from "./AnalysisSectionCard";
import { GrammarSection } from "./GrammarSection";
import { RadarSnapshot } from "./RadarSnapshot";
import {
  TranscriptLegend,
  TranscriptSectionList,
  WordsToPractiseChips,
  WordStatsRow,
} from "./PronunciationTranscript";

type CoachSummary = {
  biggestIssue: string | null;
  strength: string | null;
  patterns: CoachingPattern[];
  acousticPatterns: AcousticCoachingPattern[];
  vocabularySuggestions: VocabularySuggestion[];
};

type Props = {
  scores: SixDimensionScores;
  transcriptSegments: QuickAnalysisTranscriptSegment[];
  /** Session-level word timings — fills segment highlights when per-segment lists are empty. */
  sessionWordConfidences?: QuickAnalysisWordConfidence[];
  phoneticMap: Record<string, string>;
  highlightSource?: PronunciationHighlightSource;
  coachSummary?: CoachSummary | null;
  /** Groq grammar feedback — shown after full Quick Analysis only. */
  grammar?: QuickAnalysisGrammarSnapshot | null;
  baselineSessionId?: string | null;
  analyzing?: boolean;
  analysisStatus?: string | null;
  /** Shown under the hero title when not analyzing. */
  subtitle?: string;
  /** Hide per-question transcript block (e.g. Q3 checkpoint). */
  showTranscript?: boolean;
  footer?: ReactNode;
};

function PatternCard({ pattern }: { pattern: CoachingPattern }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/40 p-5">
      <h3 className="font-semibold text-foreground">{pattern.pattern}</h3>
      <blockquote className="border-l-2 border-primary/70 pl-3 text-sm italic text-muted-foreground">
        &ldquo;{pattern.evidence}&rdquo;
      </blockquote>
      <p className="text-sm text-muted-foreground">{pattern.impact}</p>
      <p className="mt-auto text-sm font-medium text-foreground">
        <span className="text-muted-foreground">Try this: </span>
        {pattern.fix}
      </p>
    </div>
  );
}

function VocabularyCard({ suggestion }: { suggestion: VocabularySuggestion }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-background/40 p-5">
      <p className="text-muted-foreground">
        <span>Instead of </span>
        <span className="font-semibold text-foreground">&ldquo;{suggestion.phrase}&rdquo;</span>
      </p>
      <p className="font-semibold text-foreground">
        <span className="text-muted-foreground">Try: </span>
        &ldquo;{suggestion.improvement}&rdquo;
      </p>
      <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
    </div>
  );
}

export function AnalysisResultsLayout({
  scores,
  transcriptSegments,
  sessionWordConfidences,
  phoneticMap,
  highlightSource: highlightSourceProp,
  coachSummary,
  grammar,
  baselineSessionId,
  analyzing = false,
  analysisStatus,
  subtitle = "Your English snapshot",
  showTranscript = true,
  footer,
}: Props) {
  const fallbackWords =
    sessionWordConfidences?.length
      ? sessionWordConfidences
      : transcriptSegments.flatMap((s) => s.wordConfidences);
  const displaySegments = ensureSegmentWordHighlights(transcriptSegments, fallbackWords);
  const allWords = displaySegments.flatMap((s) => s.wordConfidences);
  const highlightSource =
    highlightSourceProp ?? derivePronunciationHighlightSource(phoneticMap, allWords);
  const stats = computePronunciationStats(displaySegments, phoneticMap, highlightSource);
  const hasTranscript = displaySegments.some(
    (s) => s.transcript.length > 0 || s.wordConfidences.length > 0,
  );

  const patterns = coachSummary?.patterns ?? [];
  const acousticPatterns = coachSummary?.acousticPatterns ?? [];
  const vocabularySuggestions = coachSummary?.vocabularySuggestions ?? [];
  const biggestIssue = coachSummary?.biggestIssue?.trim();
  const strength = coachSummary?.strength?.trim();

  return (
    <div className="w-full">
      {/* Hero */}
      <div className="flex flex-col items-center py-2 text-center sm:py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {analyzing ? "Analyzing" : "Results"}
          </p>
          <h2 className="mt-1 text-pretty font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {analyzing ? analysisStatus ?? "Running analysis…" : subtitle}
          </h2>
        </div>
      </div>

      {analyzing ? null : (
        <div className="flex flex-col gap-6 pb-4">
          {/* Radar + word stats side by side */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AnalysisSectionCard className="flex flex-col items-center justify-center">
              <RadarSnapshot scores={scores} className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none" />
            </AnalysisSectionCard>

            {stats.allWords.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                <AnalysisSectionCard>
                  <WordStatsRow
                    clearCount={stats.clearCount}
                    partialCount={stats.partialCount}
                    reviewCount={stats.reviewCount}
                  />
                </AnalysisSectionCard>

                {stats.flagged.length > 0 ? (
                  <AnalysisSectionCard>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">Words to practise</h3>
                    <WordsToPractiseChips flagged={stats.flagged} />
                  </AnalysisSectionCard>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Priority focus + strengths */}
          {biggestIssue || strength ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {biggestIssue ? (
                <AnalysisSectionCard>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">Priority focus</h3>
                  <p className="leading-relaxed text-muted-foreground">{biggestIssue}</p>
                </AnalysisSectionCard>
              ) : null}
              {strength ? (
                <AnalysisSectionCard>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">What you did well</h3>
                  <p className="leading-relaxed text-muted-foreground">{strength}</p>
                </AnalysisSectionCard>
              ) : null}
            </div>
          ) : null}

          {/* Speech patterns */}
          {patterns.length > 0 ? (
            <AnalysisSectionCard>
              <h3 className="text-xl font-semibold text-foreground">Patterns in your speech</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Specific habits with evidence from what you said.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {patterns.map((pattern, i) => (
                  <PatternCard key={`${pattern.pattern}-${i}`} pattern={pattern} />
                ))}
              </div>
            </AnalysisSectionCard>
          ) : null}

          {/* Vocabulary */}
          {vocabularySuggestions.length > 0 ? (
            <AnalysisSectionCard>
              <h3 className="text-xl font-semibold text-foreground">Simpler word choices</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Same idea — said in a clearer way. Plain tips, no fancy terms.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {vocabularySuggestions.map((s, i) => (
                  <VocabularyCard key={`${s.phrase}-${i}`} suggestion={s} />
                ))}
              </div>
            </AnalysisSectionCard>
          ) : null}

          {/* Grammar (full assessment only) */}
          {grammar ? <GrammarSection grammar={grammar} /> : null}

          {/* Voice delivery */}
          {acousticPatterns.length > 0 ? (
            <AnalysisSectionCard>
              <h3 className="text-xl font-semibold text-foreground">Voice delivery patterns</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                How energy and pitch lined up with your words.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {acousticPatterns.map((p, i) => (
                  <div
                    key={`${p.pattern}-${i}`}
                    className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 p-5"
                  >
                    <h4 className="font-semibold text-foreground">{p.pattern}</h4>
                    <p className="text-sm text-muted-foreground">{p.timestamps}</p>
                    <p className="mt-auto text-sm font-medium text-foreground">
                      <span className="text-muted-foreground">Try this: </span>
                      {p.fix}
                    </p>
                  </div>
                ))}
              </div>
            </AnalysisSectionCard>
          ) : null}

          {/* Transcript */}
          {showTranscript && hasTranscript ? (
            <AnalysisSectionCard>
              <TranscriptLegend />
              <div className="mt-6">
                <TranscriptSectionList
                  segments={displaySegments}
                  phoneticMap={phoneticMap}
                  highlightSource={highlightSource}
                />
              </div>
            </AnalysisSectionCard>
          ) : null}

          {baselineSessionId ? (
            <p className="text-center text-sm text-muted-foreground">
              Baseline saved — your dashboard radar is ready.
            </p>
          ) : null}

          {footer ?? (
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button variant="glow" asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
              {baselineSessionId ? (
                <Button variant="outline" asChild>
                  <Link href="/assessment/results">View full results</Link>
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
