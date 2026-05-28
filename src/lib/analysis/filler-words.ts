import type { WordTiming } from "@/lib/transcription/types";

/** Single-token fillers (normalized, no punctuation). */
const FILLER_SINGLE = new Set([
  "um",
  "uh",
  "uhm",
  "umm",
  "erm",
  "er",
  "ah",
  "eh",
  "hmm",
  "hm",
  "mm",
  "mhm",
  "mhmm",
  "like",
  "so",
  "okay",
  "ok",
  "basically",
  "actually",
  "literally",
  "honestly",
  "obviously",
  "clearly",
  "anyway",
  "anyways",
]);

/** Multi-word filler phrases (normalized tokens). Longest matched first. */
const FILLER_PHRASES: readonly (readonly string[])[] = [
  ["you", "know"],
  ["i", "mean"],
  ["kind", "of"],
  ["sort", "of"],
  ["you", "see"],
  ["at", "the", "end", "of", "the", "day"],
  ["to", "be", "honest"],
  ["to", "be", "fair"],
  ["if", "you", "will"],
  ["so", "basically"],
  ["so", "like"],
  ["so", "um"],
  ["like", "um"],
  ["you", "know", "like"],
  ["i", "mean", "like"],
];

const STRETCHED_FILLER_RE = /^(u+h+m*|u+h+|e+r+m*|a+h+|h+m+m*)$/i;

/** Hedge tokens that are often fluent mid-sentence — only count at starts / after pauses. */
const SENTENCE_START_FILLER = new Set(["so", "well", "right", "yeah", "yep", "anyway", "anyways"]);

/** Do not treat "well" as a filler when it follows these tokens (e.g. "work well"). */
const WELL_AFTER_NON_FILLER = new Set([
  "work",
  "works",
  "worked",
  "sleep",
  "slept",
  "do",
  "does",
  "did",
  "very",
  "as",
  "quite",
  "pretty",
  "really",
]);

function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9']/g, "");
}

function tokenizeTranscript(text: string): string[] {
  return text.split(/\s+/).map(normalizeToken).filter(Boolean);
}

function tokensFromTimings(wordTimings: WordTiming[]): string[] {
  return wordTimings.map((w) => normalizeToken(w.word)).filter(Boolean);
}

function isStretchedFiller(norm: string): boolean {
  return STRETCHED_FILLER_RE.test(norm);
}

function isStandaloneFiller(norm: string): boolean {
  if (!norm) return false;
  if (isStretchedFiller(norm)) return true;
  return FILLER_SINGLE.has(norm);
}

function isSentenceStart(tokens: string[], index: number): boolean {
  if (index === 0) return true;
  const prev = tokens[index - 1] ?? "";
  return prev.endsWith(".") || prev.endsWith("!") || prev.endsWith("?");
}

function countAtIndices(tokens: string[], gapsBeforeMs?: (number | null)[]): number {
  const n = tokens.length;
  if (n === 0) return 0;
  const used = new Array<boolean>(n).fill(false);
  let count = 0;

  const sortedPhrases = [...FILLER_PHRASES].sort((a, b) => b.length - a.length);
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    let matched = false;
    for (const phrase of sortedPhrases) {
      if (i + phrase.length > n) continue;
      let ok = true;
      for (let j = 0; j < phrase.length; j++) {
        if (tokens[i + j] !== phrase[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (let j = 0; j < phrase.length; j++) used[i + j] = true;
        count++;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const t = tokens[i]!;
    if (!isStandaloneFiller(t)) continue;
    if (t === "well" && i > 0 && WELL_AFTER_NON_FILLER.has(tokens[i - 1]!)) continue;
    if (SENTENCE_START_FILLER.has(t)) {
      const gap = gapsBeforeMs?.[i];
      if (i > 0 && gap != null && gap < 400) continue;
      if (i > 0 && gap == null && !isSentenceStart(tokens, i)) continue;
    }
    used[i] = true;
    count++;
  }
  return count;
}

/**
 * Count filler words/phrases in speech. Prefers ASR word timings when present (cleaner token boundaries).
 */
function gapsBeforeMs(wordTimings: WordTiming[]): (number | null)[] {
  return wordTimings.map((w, i) =>
    i === 0 ? null : Math.max(0, (w.start - wordTimings[i - 1]!.end) * 1000),
  );
}

export function countFillerWords(input: {
  transcript: string;
  wordTimings?: WordTiming[];
}): number {
  const fromTimings =
    input.wordTimings && input.wordTimings.length > 0
      ? countAtIndices(tokensFromTimings(input.wordTimings), gapsBeforeMs(input.wordTimings))
      : 0;
  const fromTranscript = countAtIndices(tokenizeTranscript(input.transcript));
  return Math.max(fromTimings, fromTranscript);
}
