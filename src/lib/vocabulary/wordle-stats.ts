import {
  getDailyPuzzleNumber,
  getDailyWord,
  getUtcDateKey,
  isAllowedGuess,
  WORD_LENGTH,
} from "@/lib/vocabulary/words";

export type TileState = "correct" | "present" | "absent";

const STATS_KEY = "auravo-wordle-stats-v1";
const DAY_PREFIX = "auravo-wordle-day-v1-";

export type WordleStats = {
  gamesPlayed: number;
  gamesWon: number;
  guessSum: number;
  currentStreak: number;
  maxStreak: number;
  lastWinYmd: string | null;
  /** Last UTC day aggregate stats were updated (prevents double-count on refresh). */
  lastStatsYmd: string | null;
};

/** Baseline stats for SSR and the first client paint (matches server; hydrate from localStorage in `useEffect`). */
export const WORDLE_STATS_INITIAL: WordleStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  guessSum: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastWinYmd: null,
  lastStatsYmd: null,
};

export type DayRow = { guess: string; evaluation: TileState[] };

export const WORDLE_MAX_GUESSES = 6;

export type DayProgress = {
  status: "playing" | "won" | "lost";
  rows: DayRow[];
};

function defaultStats(): WordleStats {
  return { ...WORDLE_STATS_INITIAL };
}

export function loadWordleStats(): WordleStats {
  if (typeof window === "undefined") return defaultStats();
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    const o = JSON.parse(raw) as Partial<WordleStats>;
    return {
      gamesPlayed: typeof o.gamesPlayed === "number" ? o.gamesPlayed : 0,
      gamesWon: typeof o.gamesWon === "number" ? o.gamesWon : 0,
      guessSum: typeof o.guessSum === "number" ? o.guessSum : 0,
      currentStreak: typeof o.currentStreak === "number" ? o.currentStreak : 0,
      maxStreak: typeof o.maxStreak === "number" ? o.maxStreak : 0,
      lastWinYmd: typeof o.lastWinYmd === "string" ? o.lastWinYmd : null,
      lastStatsYmd: typeof o.lastStatsYmd === "string" ? o.lastStatsYmd : null,
    };
  } catch {
    return defaultStats();
  }
}

function saveWordleStats(s: WordleStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

function utcYmdPlusDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000;
  return getUtcDateKey(new Date(t));
}

export function evaluateRow(solution: string, guess: string): TileState[] {
  const sol = [...solution.toLowerCase()];
  const g = [...guess.toLowerCase()];
  const res: TileState[] = Array(WORD_LENGTH).fill("absent");
  const pool: Record<string, number> = {};
  for (const c of sol) pool[c] = (pool[c] ?? 0) + 1;
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === sol[i]) {
      res[i] = "correct";
      pool[g[i]!]!--;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (res[i] === "correct") continue;
    const ch = g[i]!;
    if ((pool[ch] ?? 0) > 0) {
      res[i] = "present";
      pool[ch]!--;
    }
  }
  return res;
}

export function shareEmojiLine(evaluation: TileState[]): string {
  return evaluation.map((s) => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛")).join("");
}

export function loadDayProgress(ymd: string): DayProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DAY_PREFIX + ymd);
    if (!raw) return null;
    const o = JSON.parse(raw) as DayProgress;
    if (!o || !Array.isArray(o.rows)) return null;
    if (o.status !== "playing" && o.status !== "won" && o.status !== "lost") return null;
    return o;
  } catch {
    return null;
  }
}

export function saveDayProgress(ymd: string, p: DayProgress) {
  localStorage.setItem(DAY_PREFIX + ymd, JSON.stringify(p));
}

export function recordWin(ymd: string, guessCount: number) {
  const stats = loadWordleStats();
  if (stats.lastStatsYmd === ymd) return;
  stats.gamesPlayed += 1;
  stats.gamesWon += 1;
  stats.guessSum += guessCount;
  const prev = stats.lastWinYmd;
  if (prev && utcYmdPlusDays(prev, 1) === ymd) stats.currentStreak += 1;
  else stats.currentStreak = 1;
  stats.lastWinYmd = ymd;
  stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  stats.lastStatsYmd = ymd;
  saveWordleStats(stats);
}

export function recordLoss(ymd: string) {
  const stats = loadWordleStats();
  if (stats.lastStatsYmd === ymd) return;
  stats.gamesPlayed += 1;
  stats.currentStreak = 0;
  stats.lastStatsYmd = ymd;
  saveWordleStats(stats);
}

export function winRatePercent(stats: WordleStats): number {
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((100 * stats.gamesWon) / stats.gamesPlayed);
}

export function averageWinGuesses(stats: WordleStats): number {
  if (stats.gamesWon === 0) return 0;
  return Math.round((10 * stats.guessSum) / stats.gamesWon) / 10;
}

export function getWordleMeta(date: Date = new Date()) {
  const ymd = getUtcDateKey(date);
  return {
    ymd,
    puzzleNumber: getDailyPuzzleNumber(date),
    solution: getDailyWord(date),
  };
}
