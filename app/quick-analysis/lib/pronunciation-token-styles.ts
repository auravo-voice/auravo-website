import type { CSSProperties } from "react";

import type { WordHighlightColor } from "@/app/quick-analysis/lib/word-highlight";

const TOKEN_INLINE_STYLES: Record<"clear" | "partial" | "review", CSSProperties> = {
  clear: {
    background: "oklch(0.88 0.07 145)",
    border: "1px solid oklch(0.62 0.14 145)",
    color: "oklch(0.28 0.04 145)",
  },
  partial: {
    background: "oklch(0.9 0.09 75)",
    border: "1px solid oklch(0.68 0.15 65)",
    color: "oklch(0.32 0.05 55)",
    textDecoration: "underline dotted oklch(0.55 0.14 65)",
    textUnderlineOffset: "2px",
    cursor: "help",
  },
  review: {
    background: "oklch(0.9 0.08 25)",
    border: "1px solid oklch(0.62 0.18 25)",
    color: "oklch(0.32 0.06 25)",
    textDecoration: "underline dotted oklch(0.55 0.18 25)",
    textUnderlineOffset: "2px",
    cursor: "help",
  },
};

export function pronunciationTokenClassName(color: WordHighlightColor): string {
  const tone =
    color === "green" ? "clear" : color === "yellow" ? "partial" : color === "red" ? "review" : "";
  if (!tone) return "";
  return `qa-pronunciation-token qa-pronunciation-token--${tone}`;
}

export function pronunciationTokenInlineStyle(
  color: WordHighlightColor,
): CSSProperties | undefined {
  const tone =
    color === "green" ? "clear" : color === "yellow" ? "partial" : color === "red" ? "review" : null;
  if (!tone) return undefined;
  return {
    position: "relative",
    display: "inline-block",
    marginInline: "0.125rem",
    borderRadius: "0.375rem",
    padding: "0.125rem 0.375rem",
    lineHeight: 1.5,
    ...TOKEN_INLINE_STYLES[tone],
  };
}

export function pronunciationLegendDotClassName(color: WordHighlightColor): string {
  const tone =
    color === "green" ? "clear" : color === "yellow" ? "partial" : "review";
  return `qa-pronunciation-legend-dot qa-pronunciation-legend-dot--${tone}`;
}

export function pronunciationStatClassName(color: WordHighlightColor): string {
  const tone =
    color === "green" ? "clear" : color === "yellow" ? "partial" : "review";
  return `qa-pronunciation-stat--${tone}`;
}

export function pronunciationChipClassName(color: "yellow" | "red"): string {
  return color === "red"
    ? "border-red-500/50 bg-red-500/20 text-red-900 dark:text-red-100"
    : "border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-100";
}

export function pronunciationChipDotClassName(color: "yellow" | "red"): string {
  const tone = color === "red" ? "review" : "partial";
  return `qa-pronunciation-legend-dot qa-pronunciation-legend-dot--${tone}`;
}
