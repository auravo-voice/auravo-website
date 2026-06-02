"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  averageWinGuesses,
  evaluateRow,
  getWordleMeta,
  loadDayProgress,
  loadWordleStats,
  recordLoss,
  recordWin,
  saveDayProgress,
  shareEmojiLine,
  winRatePercent,
  WORDLE_STATS_INITIAL,
  type DayRow,
  type TileState,
  type WordleStats,
} from "@/lib/vocabulary/wordle-stats";
import { isAllowedGuess, MAX_GUESSES, WORD_LENGTH } from "@/lib/vocabulary/words";

const KEYBOARD: string[][] = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

function letterKeyboardState(rows: DayRow[], letter: string): TileState | null {
  let best: TileState | null = null;
  const rank: Record<TileState, number> = { absent: 0, present: 1, correct: 2 };
  for (const row of rows) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (row.guess[i]?.toUpperCase() !== letter) continue;
      const s = row.evaluation[i]!;
      if (!best || rank[s] > rank[best]) best = s;
    }
  }
  return best;
}

function Tile({
  letter,
  evaluation,
  committed,
}: {
  letter: string;
  evaluation: TileState | null;
  committed: boolean;
}) {
  const show = committed && evaluation;
  return (
    <div
      className={cn(
        "flex aspect-square max-h-[3.35rem] min-h-0 w-full items-center justify-center rounded-lg border-2 text-lg font-bold uppercase tracking-wide sm:text-xl",
        !committed && "border-border bg-muted/40 text-foreground",
        show &&
          evaluation === "correct" &&
          "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600",
        show &&
          evaluation === "present" &&
          "border-amber-500 bg-amber-500 text-amber-950 dark:border-amber-400 dark:bg-amber-500 dark:text-amber-950",
        show && evaluation === "absent" && "border-zinc-500 bg-zinc-500 text-white dark:border-zinc-600 dark:bg-zinc-600",
      )}
    >
      {letter}
    </div>
  );
}

function RowTiles({
  guess,
  evaluation,
  committed,
  rowIndex,
  animateFlip,
}: {
  guess: string;
  evaluation: TileState[] | null;
  committed: boolean;
  rowIndex: number;
  animateFlip: boolean;
}) {
  const letters = guess.toUpperCase().padEnd(WORD_LENGTH, " ").split("");
  return (
    <div className="wordle-row">
      {letters.map((ch, i) => (
        <div
          key={`${rowIndex}-${i}-${committed ? evaluation?.join("") ?? "" : "draft"}`}
          className={cn(
            "wordle-tile-slot",
            committed && evaluation && animateFlip && "wordle-tile-flip",
          )}
          style={committed && evaluation && animateFlip ? { animationDelay: `${i * 95}ms` } : undefined}
        >
          <Tile letter={ch.trim() || "\u00a0"} evaluation={evaluation?.[i] ?? null} committed={committed} />
        </div>
      ))}
    </div>
  );
}

export function WordleGame() {
  const meta = React.useMemo(() => getWordleMeta(new Date()), []);
  const { ymd, puzzleNumber, solution } = meta;

  const [rows, setRows] = React.useState<DayRow[]>([]);
  const [draft, setDraft] = React.useState("");
  const [status, setStatus] = React.useState<"playing" | "won" | "lost">("playing");
  const [shake, setShake] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [animatingRow, setAnimatingRow] = React.useState<number | null>(null);
  const [stats, setStats] = React.useState<WordleStats>(() => WORDLE_STATS_INITIAL);

  React.useEffect(() => {
    setStats(loadWordleStats());
    const saved = loadDayProgress(ymd);
    if (saved && saved.rows.length > 0) {
      setRows(saved.rows);
      setStatus(saved.status);
      setDraft("");
    }
  }, [ymd]);

  const showToast = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const commitRow = React.useCallback(
    (guess: string) => {
      const g = guess.toLowerCase();
      if (g.length !== WORD_LENGTH) {
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
        showToast(`Use ${WORD_LENGTH} letters.`);
        return;
      }
      if (!isAllowedGuess(g)) {
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
        showToast("That word is not in the dictionary.");
        return;
      }
      const evaluation = evaluateRow(solution, g);
      const nextRows = [...rows, { guess: g, evaluation }];
      setRows(nextRows);
      setDraft("");
      const ri = nextRows.length - 1;
      setAnimatingRow(ri);
      window.setTimeout(() => {
        setAnimatingRow((prev) => (prev === ri ? null : prev));
      }, 650);

      const won = evaluation.every((e) => e === "correct");
      if (won) {
        setStatus("won");
        saveDayProgress(ymd, { status: "won", rows: nextRows });
        recordWin(ymd, nextRows.length);
        setStats(loadWordleStats());
        return;
      }
      if (nextRows.length >= MAX_GUESSES) {
        setStatus("lost");
        saveDayProgress(ymd, { status: "lost", rows: nextRows });
        recordLoss(ymd);
        setStats(loadWordleStats());
        return;
      }
      saveDayProgress(ymd, { status: "playing", rows: nextRows });
    },
    [rows, solution, ymd, showToast],
  );

  const onKey = React.useCallback(
    (key: string) => {
      if (status !== "playing") return;
      if (key === "ENTER") {
        commitRow(draft);
        return;
      }
      if (key === "BACK" || key === "BACKSPACE") {
        setDraft((d) => d.slice(0, -1));
        return;
      }
      if (/^[a-zA-Z]$/.test(key) && draft.length < WORD_LENGTH) {
        setDraft((d) => (d + key).toLowerCase().slice(0, WORD_LENGTH));
      }
    },
    [status, draft, commitRow],
  );

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        onKey("ENTER");
        return;
      }
      if (k === "Backspace") {
        e.preventDefault();
        onKey("BACK");
        return;
      }
      if (k.length === 1 && /[a-zA-Z]/.test(k)) {
        e.preventDefault();
        onKey(k.toUpperCase());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);

  const shareText = React.useMemo(() => {
    if (status === "playing") return "";
    const lines = rows.map((r) => shareEmojiLine(r.evaluation));
    return `Auravord #${puzzleNumber}\n${lines.join("\n")}\n${status === "won" ? `Solved in ${rows.length} tries` : "Better luck tomorrow"}`;
  }, [rows, status, puzzleNumber]);

  const copyShare = React.useCallback(async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      showToast("Copied to clipboard.");
    } catch {
      showToast("Could not copy — select the text manually.");
    }
  }, [shareText, showToast]);

  const winRate = winRatePercent(stats);
  const avgGuesses = averageWinGuesses(stats);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" asChild>
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Daily vocabulary</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Auravord</h1>
          <p className="text-sm text-muted-foreground">Train your communication vocabulary · #{puzzleNumber}</p>
        </div>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today&apos;s word</CardTitle>
          <CardDescription>
            Guess the five-letter word in {MAX_GUESSES} tries. Any real dictionary word is allowed; the answer is
            always communication-themed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={cn("wordle-board", shake && "wordle-shake")}>
            {Array.from({ length: MAX_GUESSES }).map((_, ri) => {
              const row = rows[ri];
              const isCurrent = ri === rows.length && status === "playing";
              const guess = row?.guess ?? (isCurrent ? draft : "");
              const evaluation = row?.evaluation ?? null;
              const committed = !!row;
              return (
                <RowTiles
                  key={ri}
                  guess={guess}
                  evaluation={evaluation}
                  committed={committed}
                  rowIndex={ri}
                  animateFlip={animatingRow === ri}
                />
              );
            })}
          </div>

          {toast ? (
            <p className="text-center text-sm font-medium text-primary" role="status">
              {toast}
            </p>
          ) : null}

          {status !== "playing" ? (
            <div className="space-y-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-5 shrink-0" />
                <p className="font-display text-lg font-semibold">
                  {status === "won" ? "Nice solve." : `The word was "${solution.toUpperCase()}".`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <StatChip label="Attempts" value={status === "won" ? String(rows.length) : `${MAX_GUESSES}`} />
                <StatChip label="Streak" value={String(stats.currentStreak)} />
                <StatChip label="Win %" value={`${winRate}%`} />
                <StatChip label="Avg guesses" value={stats.gamesWon ? String(avgGuesses) : "—"} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="glow" className="gap-2" onClick={() => void copyShare()}>
                  <Share2 className="size-4" />
                  Copy share text
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Play tomorrow&apos;s challenge — a new word drops every UTC midnight.
              </p>
            </div>
          ) : null}

          {status === "playing" ? (
            <div className="mx-auto w-full max-w-[min(100%,24rem)] space-y-1.5">
              {KEYBOARD.map((line, li) => (
                <div key={li} className="flex justify-center gap-1">
                  {line.map((k) => {
                    const wide = k === "ENTER" || k === "BACK";
                    const st = k.length === 1 ? letterKeyboardState(rows, k) : null;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => onKey(k === "BACK" ? "BACK" : k)}
                        className={cn(
                          "flex h-11 min-w-[1.75rem] items-center justify-center rounded-lg px-1.5 text-[11px] font-semibold uppercase tracking-wide shadow-sm transition active:scale-95 sm:h-12 sm:min-w-8 sm:px-2 sm:text-xs",
                          wide && "min-w-[3rem] px-2 sm:min-w-[3.25rem]",
                          !st && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                          st === "correct" && "bg-emerald-600 text-white hover:bg-emerald-600",
                          st === "present" && "bg-amber-500 text-amber-950 hover:bg-amber-500",
                          st === "absent" && "bg-zinc-500 text-white hover:bg-zinc-500",
                        )}
                      >
                        {k === "BACK" ? "⌫" : k}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        {stats.gamesWon} wins · {stats.gamesPlayed} played · best streak {stats.maxStreak}
      </p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
