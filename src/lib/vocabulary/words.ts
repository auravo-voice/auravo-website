/**
 * Auravord dictionary source.
 * Both daily solutions and guess validation use the same five-letter dictionary list.
 */
import fiveLetterAllowlist from "./five-letter-allowlist.json";

const DICTIONARY_WORDS = [...new Set((fiveLetterAllowlist as string[]).map((w) => w.toLowerCase()))]
  .filter((w) => /^[a-z]{5}$/.test(w))
  .sort((a, b) => a.localeCompare(b));

if (DICTIONARY_WORDS.length < 1000) {
  throw new Error(`Expected >=1000 five-letter dictionary words, got ${DICTIONARY_WORDS.length}`);
}

/** Anchor for puzzle # — same calendar day worldwide (UTC). */
export const WORDLE_EPOCH_UTC_MS = Date.UTC(2025, 0, 1);

/** All valid guess words are dictionary-derived five-letter words. */
const GUESS_ALLOW_SET = new Set<string>(DICTIONARY_WORDS);

function hashDayKey(ymd: string): number {
  let h = 2166136261;
  for (let i = 0; i < ymd.length; i++) {
    h ^= ymd.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/** YYYY-MM-DD in UTC for deterministic daily rotation. */
export function getUtcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Daily solution word — identical for every player on the same UTC calendar day. */
export function getDailyWord(date: Date = new Date()): string {
  const ymd = getUtcDateKey(date);
  const idx = hashDayKey(ymd) % DICTIONARY_WORDS.length;
  return DICTIONARY_WORDS[idx]!;
}

/** 1-based puzzle index for share cards (days since epoch + 1). */
export function getDailyPuzzleNumber(date: Date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.floor((start - WORDLE_EPOCH_UTC_MS) / 86_400_000);
  return Math.max(1, days + 1);
}

/** True if `word` is a valid five-letter English dictionary word. */
export function isAllowedGuess(word: string): boolean {
  return GUESS_ALLOW_SET.has(word.toLowerCase());
}

export const WORD_LENGTH = 5;
