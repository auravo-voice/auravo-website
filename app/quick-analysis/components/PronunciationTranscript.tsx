"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type {
  QuickAnalysisTranscriptSegment,
  QuickAnalysisWordConfidence,
} from "@/app/quick-analysis/pronunciation-types";
import {
  computePronunciationStats,
  type FlaggedWord,
} from "@/app/quick-analysis/lib/pronunciation-stats";
import {
  lookupPhoneticGuide,
  resolveWordHighlightColor,
  shouldShowPhoneticTooltip,
  type PronunciationHighlightSource,
} from "@/app/quick-analysis/lib/word-highlight";
import {
  pronunciationChipClassName,
  pronunciationChipDotClassName,
  pronunciationLegendDotClassName,
  pronunciationStatClassName,
  pronunciationTokenClassName,
  pronunciationTokenInlineStyle,
} from "@/app/quick-analysis/lib/pronunciation-token-styles";

type Props = {
  segments: QuickAnalysisTranscriptSegment[];
  phoneticMap: Record<string, string>;
  highlightSource?: PronunciationHighlightSource;
  className?: string;
};

function WordToken({
  word,
  confidence,
  phonetic,
  highlightSource,
  phoneticMap,
}: {
  word: string;
  confidence: number;
  phonetic?: string;
  highlightSource: PronunciationHighlightSource;
  phoneticMap: Record<string, string>;
}) {
  const color = resolveWordHighlightColor(word, confidence, phoneticMap, highlightSource);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const hasTooltip = shouldShowPhoneticTooltip(color, phonetic);

  const tokenStyle = color === "plain" ? undefined : pronunciationTokenInlineStyle(color);

  return (
    <span
      className={color === "plain" ? undefined : pronunciationTokenClassName(color)}
      style={tokenStyle}
      onMouseEnter={() => hasTooltip && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {word}
      {hasTooltip && showTooltip ? (
        <span className="absolute bottom-[calc(100%+8px)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border/50 bg-background/95 px-3 py-2 text-center shadow-sm backdrop-blur-md">
          <span className="block text-sm font-medium text-foreground">{phonetic}</span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            how to say it
          </span>
        </span>
      ) : null}
    </span>
  );
}

function displayWord(token: string, index: number): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  if (token.startsWith(" ") || token.startsWith("\n")) return token;
  return index === 0 ? trimmed : ` ${trimmed}`;
}

function SegmentWords({
  wordConfidences,
  phoneticMap,
  highlightSource,
}: {
  wordConfidences: QuickAnalysisWordConfidence[];
  phoneticMap: Record<string, string>;
  highlightSource: PronunciationHighlightSource;
}) {
  if (wordConfidences.length === 0) return null;

  return (
    <p className="min-w-0 w-full whitespace-normal break-words leading-loose text-foreground">
      {wordConfidences.map((w, i) => {
        const text = displayWord(w.word, i);
        if (!text) return null;
        const phonetic = lookupPhoneticGuide(w.word, phoneticMap);
        return (
          <WordToken
            key={`${w.start}-${w.end}-${i}`}
            word={text}
            confidence={w.confidence}
            phonetic={phonetic}
            highlightSource={highlightSource}
            phoneticMap={phoneticMap}
          />
        );
      })}
    </p>
  );
}

export function TranscriptLegend() {
  const items = [
    { color: "green" as const, label: "Clearly pronounced" },
    { color: "yellow" as const, label: "Partially clear" },
    { color: "red" as const, label: "Needs practice" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className={pronunciationLegendDotClassName(color)}
            aria-hidden="true"
          />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function WordStatsRow({
  clearCount,
  partialCount,
  reviewCount,
}: {
  clearCount: number;
  partialCount: number;
  reviewCount: number;
}) {
  const stats = [
    { label: "Clear", count: clearCount, colorClass: pronunciationStatClassName("green") },
    { label: "Partial", count: partialCount, colorClass: pronunciationStatClassName("yellow") },
    { label: "Review", count: reviewCount, colorClass: pronunciationStatClassName("red") },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      {stats.map(({ label, count, colorClass }) => (
        <div key={label} className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <span className={cn("text-2xl font-bold", colorClass)}>
            {count} <span className="text-base font-medium">words</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function WordsToPractiseChips({ flagged }: { flagged: FlaggedWord[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {flagged.map(({ word: w, color }, i) => (
        <span
          key={`${color}-${i}-${w.word}`}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
            pronunciationChipClassName(color),
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", pronunciationChipDotClassName(color))}
            aria-hidden="true"
          />
          {w.word.trim()}
        </span>
      ))}
    </div>
  );
}

export function TranscriptSectionList({
  segments,
  phoneticMap,
  highlightSource = "whisper",
}: {
  segments: QuickAnalysisTranscriptSegment[];
  phoneticMap: Record<string, string>;
  highlightSource?: PronunciationHighlightSource;
}) {
  const visibleSegments = segments.filter(
    (s) => s.transcript.length > 0 || s.wordConfidences.length > 0,
  );

  if (visibleSegments.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your transcript</p>
      {visibleSegments.map((segment, index) => (
        <div key={`${segment.label}-${index}`} className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{segment.label}</p>
          {segment.wordConfidences.length > 0 ? (
            <SegmentWords
              wordConfidences={segment.wordConfidences}
              phoneticMap={phoneticMap}
              highlightSource={highlightSource}
            />
          ) : (
            <p className="leading-loose text-foreground">{segment.transcript}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** Legacy stacked layout — prefer AnalysisResultsLayout for full results. */
export function PronunciationTranscript({
  segments,
  phoneticMap,
  highlightSource = "whisper",
  className,
}: Props) {
  const stats = computePronunciationStats(segments, phoneticMap, highlightSource);
  const visibleSegments = segments.filter(
    (s) => s.transcript.length > 0 || s.wordConfidences.length > 0,
  );

  if (visibleSegments.length === 0) return null;

  return (
    <div className={cn("w-full min-w-0 max-w-full", className)}>
      <TranscriptLegend />
      <div className="mt-6">
        <TranscriptSectionList
          segments={segments}
          phoneticMap={phoneticMap}
          highlightSource={highlightSource}
        />
      </div>
      {stats.allWords.length > 0 ? (
        <div className="mt-6">
          <WordStatsRow
            clearCount={stats.clearCount}
            partialCount={stats.partialCount}
            reviewCount={stats.reviewCount}
          />
        </div>
      ) : null}
      {stats.flagged.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-border/50 bg-card/30 p-4">
          <p className="mb-3 text-xs font-medium text-foreground">Words to practise</p>
          <WordsToPractiseChips flagged={stats.flagged} />
        </div>
      ) : null}
    </div>
  );
}
