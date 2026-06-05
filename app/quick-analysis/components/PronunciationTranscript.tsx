"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type {
  QuickAnalysisTranscriptSegment,
  QuickAnalysisWordConfidence,
} from "@/app/quick-analysis/pronunciation-types";
import {
  PRONUNCIATION_RED_THRESHOLD,
  PRONUNCIATION_YELLOW_THRESHOLD,
} from "@/app/quick-analysis/pronunciation-types";

type Props = {
  segments: QuickAnalysisTranscriptSegment[];
  phoneticMap: Record<string, string>;
  className?: string;
};

function getWordColor(confidence: number) {
  if (confidence < PRONUNCIATION_RED_THRESHOLD) return "red";
  if (confidence < PRONUNCIATION_YELLOW_THRESHOLD) return "yellow";
  return "green";
}

function lookupPhonetic(word: string, phoneticMap: Record<string, string>): string | undefined {
  const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
  const guide = phoneticMap[word] ?? phoneticMap[clean];
  return guide?.trim() || undefined;
}

/** Only flag words we can show a hover pronunciation for. */
function displayColor(confidence: number, phonetic?: string): "green" | "yellow" | "red" {
  if (!phonetic) return "green";
  return getWordColor(confidence);
}

function WordToken({
  word,
  confidence,
  phonetic,
}: {
  word: string;
  confidence: number;
  phonetic?: string;
}) {
  const color = displayColor(confidence, phonetic);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const hasTooltip = Boolean(phonetic) && color !== "green";

  return (
    <span
      className={cn(
        "relative inline rounded-[3px] px-[2px] py-[1px]",
        color === "green" && "bg-green-500/15 text-foreground",
        color === "yellow" &&
          "cursor-help border-b border-dotted border-amber-600/70 bg-amber-500/18 text-foreground",
        color === "red" &&
          "cursor-help border-b border-dotted border-red-600/70 bg-red-500/15 text-foreground",
      )}
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
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-border/50"
            style={{ width: 0, height: 0 }}
          />
        </span>
      ) : null}
    </span>
  );
}

function displayWord(token: string, index: number): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  // Whisper tokens usually carry a leading space; re-insert when it was stripped upstream.
  if (token.startsWith(" ") || token.startsWith("\n")) return token;
  return index === 0 ? trimmed : ` ${trimmed}`;
}

function SegmentWords({
  wordConfidences,
  phoneticMap,
}: {
  wordConfidences: QuickAnalysisWordConfidence[];
  phoneticMap: Record<string, string>;
}) {
  if (wordConfidences.length > 0) {
    return (
      <p className="min-w-0 w-full whitespace-normal break-words text-base leading-[2.1] text-foreground">
        {wordConfidences.map((w, i) => {
          const text = displayWord(w.word, i);
          if (!text) return null;
          const phonetic = lookupPhonetic(w.word, phoneticMap);
          return (
            <WordToken
              key={`${w.start}-${w.end}-${i}`}
              word={text}
              confidence={w.confidence}
              phonetic={phonetic}
            />
          );
        })}
      </p>
    );
  }

  return null;
}

function SegmentPlainText({ text }: { text: string }) {
  return <p className="text-base leading-[2.1] text-foreground">{text}</p>;
}

export function PronunciationTranscript({ segments, phoneticMap, className }: Props) {
  const visibleSegments = segments.filter(
    (s) => s.transcript.length > 0 || s.wordConfidences.length > 0,
  );
  const allWords = visibleSegments.flatMap((s) => s.wordConfidences);

  const flaggedWord = (w: QuickAnalysisWordConfidence) => {
    if (w.word.trim().length <= 3) return null;
    const phonetic = lookupPhonetic(w.word, phoneticMap);
    if (!phonetic) return null;
    const color = getWordColor(w.confidence);
    if (color === "red" || color === "yellow") return { word: w, color };
    return null;
  };

  const flagged = allWords.map(flaggedWord).filter(Boolean) as {
    word: QuickAnalysisWordConfidence;
    color: "red" | "yellow";
  }[];
  const redWords = flagged.filter((f) => f.color === "red").map((f) => f.word);
  const yellowWords = flagged.filter((f) => f.color === "yellow").map((f) => f.word);
  const clearCount = allWords.length - redWords.length - yellowWords.length;

  if (visibleSegments.length === 0) return null;

  return (
    <div className={cn("w-full min-w-0 max-w-full", className)}>
      <div className="mb-3 flex flex-wrap gap-4">
        {[
          { dotStyle: { background: "rgba(99,153,34,0.6)" }, label: "Clearly pronounced" },
          { dotStyle: { background: "rgba(186,117,23,0.6)" }, label: "Partially clear — hover for tip" },
          {
            dotStyle: { background: "rgba(162,45,45,0.6)" },
            label: "Needs practice — hover for tip",
          },
        ].map(({ dotStyle, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={dotStyle} />
            {label}
          </div>
        ))}
      </div>

      <div className="mb-3 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/40 bg-card/20 px-6 py-5 backdrop-blur-sm">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Your transcript
        </p>
        <div className="flex flex-col gap-6">
          {visibleSegments.map((segment, index) => (
            <div key={`${segment.label}-${index}`} className="min-w-0">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{segment.label}</p>
              {segment.wordConfidences.length > 0 ? (
                <SegmentWords wordConfidences={segment.wordConfidences} phoneticMap={phoneticMap} />
              ) : (
                <SegmentPlainText text={segment.transcript} />
              )}
            </div>
          ))}
        </div>
      </div>

      {allWords.length > 0 ? (
        <div className="mb-3 grid grid-cols-3 gap-3">
          {[
            { label: "Clear", count: clearCount, colorClass: "text-green-700 dark:text-green-400" },
            {
              label: "Partial",
              count: yellowWords.length,
              colorClass: "text-amber-700 dark:text-amber-400",
            },
            { label: "Review", count: redWords.length, colorClass: "text-red-700 dark:text-red-400" },
          ].map(({ label, count, colorClass }) => (
            <div key={label} className="rounded-xl bg-muted/20 p-3 text-center">
              <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </p>
              <p className={cn("text-lg font-medium", colorClass)}>{count} words</p>
            </div>
          ))}
        </div>
      ) : null}

      {redWords.length > 0 || yellowWords.length > 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
          <p className="mb-3 text-xs font-medium text-foreground">Words to practise</p>
          <div className="flex flex-wrap gap-2">
            {redWords.map((w, i) => (
              <span
                key={`red-${i}`}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                style={{
                  background: "rgba(162,45,45,0.1)",
                  color: "#791F1F",
                  border: "0.5px solid rgba(162,45,45,0.3)",
                }}
              >
                <span
                  className="inline-block size-[5px] rounded-full"
                  style={{ background: "#A32D2D" }}
                />
                {w.word}
              </span>
            ))}
            {yellowWords.map((w, i) => (
              <span
                key={`yellow-${i}`}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                style={{
                  background: "rgba(186,117,23,0.1)",
                  color: "#633806",
                  border: "0.5px solid rgba(186,117,23,0.3)",
                }}
              >
                <span
                  className="inline-block size-[5px] rounded-full"
                  style={{ background: "#BA7517" }}
                />
                {w.word}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
