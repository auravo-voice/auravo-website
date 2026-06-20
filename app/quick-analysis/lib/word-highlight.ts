import type { QuickAnalysisWordConfidence } from "@/app/quick-analysis/pronunciation-types";
import {
  PRONUNCIATION_RED_THRESHOLD,
  PRONUNCIATION_YELLOW_THRESHOLD,
} from "@/app/quick-analysis/pronunciation-types";
import { flaggedWordsForPhonetics } from "@/lib/quick-analysis/word-confidences";

/** Token color — `plain` means no Groq pronunciation guide (no highlight). */
export type WordHighlightColor = "plain" | "green" | "yellow" | "red";

/** Whether transcript tokens use Groq phonetic guides or Whisper confidence. */
export type PronunciationHighlightSource = "groq" | "whisper";

export function whisperWordColor(confidence: number): "green" | "yellow" | "red" {
  if (confidence < PRONUNCIATION_RED_THRESHOLD) return "red";
  if (confidence < PRONUNCIATION_YELLOW_THRESHOLD) return "yellow";
  return "green";
}

export function lookupPhoneticGuide(
  word: string,
  phoneticMap: Record<string, string>,
): string | undefined {
  const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (!clean) return undefined;

  const direct =
    phoneticMap[word] ??
    phoneticMap[clean] ??
    phoneticMap[clean.charAt(0).toUpperCase() + clean.slice(1)];
  if (direct?.trim()) return direct.trim();

  for (const [key, guide] of Object.entries(phoneticMap)) {
    if (key.replace(/[^a-zA-Z]/g, "").toLowerCase() === clean && guide.trim()) {
      return guide.trim();
    }
  }
  return undefined;
}

export function resolvePronunciationHighlightSource(
  phoneticMap: Record<string, string>,
  _flaggedForGroqCount?: number,
): PronunciationHighlightSource {
  return Object.keys(phoneticMap).length > 0 ? "groq" : "whisper";
}

export function derivePronunciationHighlightSource(
  phoneticMap: Record<string, string>,
  wordConfidences: QuickAnalysisWordConfidence[],
): PronunciationHighlightSource {
  return resolvePronunciationHighlightSource(phoneticMap, flaggedWordsForPhonetics(wordConfidences).length);
}

/**
 * Words without a Groq pronunciation guide are always green.
 * Words with a guide use Whisper confidence (green / yellow / red); hover tips on yellow/red only.
 */
export function resolveWordHighlightColor(
  word: string,
  confidence: number,
  phoneticMap: Record<string, string>,
  _source: PronunciationHighlightSource,
): WordHighlightColor {
  if (!lookupPhoneticGuide(word, phoneticMap)) {
    return "green";
  }
  return whisperWordColor(confidence);
}

export function shouldShowPhoneticTooltip(
  color: WordHighlightColor,
  phonetic?: string,
): boolean {
  return Boolean(phonetic?.trim()) && (color === "yellow" || color === "red");
}

export type FlaggedWord = {
  word: QuickAnalysisWordConfidence;
  color: "red" | "yellow";
};

export function flaggedWordsFromHighlights(
  wordConfidences: QuickAnalysisWordConfidence[],
  phoneticMap: Record<string, string>,
  source: PronunciationHighlightSource,
): FlaggedWord[] {
  const flagged: FlaggedWord[] = [];
  const seen = new Set<string>();
  for (const w of wordConfidences) {
    if (w.word.replace(/[^a-zA-Z]/g, "").length <= 3) continue;
    const color = resolveWordHighlightColor(w.word, w.confidence, phoneticMap, source);
    if (color !== "red" && color !== "yellow") continue;
    if (source === "groq" && !lookupPhoneticGuide(w.word, phoneticMap)) continue;
    const key = w.word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    flagged.push({ word: w, color });
  }
  return flagged;
}
