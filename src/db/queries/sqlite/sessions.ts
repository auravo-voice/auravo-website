import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { practiceSession, sessionScores } from "@/db/schema";

/** Anything that should count toward streaks/progress (filters out future placeholder kinds). */
export const COUNTABLE_SESSION_KINDS = [
  "onboarding_assessment",
  "daily_practice",
  "simulation",
  "meeting_rehearsal",
] as const;
export type CountableSessionKind = (typeof COUNTABLE_SESSION_KINDS)[number];

export type SessionListRow = {
  id: string;
  kind: string;
  title: string | null;
  audioRelativePath: string;
  durationMs: number | null;
  createdAt: number;
  scores: {
    pronunciation: number;
    grammar: number;
    fluency: number;
    vocabulary: number;
    fillerWords: number;
    pacing: number;
  } | null;
};

/** YYYY-MM-DD in the **local server timezone** so streaks line up with how the learner experiences "today". */
export function toLocalDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return toLocalDayKey(Date.now());
}

function yesterdayKey(): string {
  return toLocalDayKey(Date.now() - 24 * 60 * 60 * 1000);
}

/** Counts consecutive day-buckets ending at today (or yesterday if no session today) where at least one session was saved. */
function computeStreakDays(orderedTimestamps: number[]): number {
  if (orderedTimestamps.length === 0) return 0;
  const uniqueDays = new Set(orderedTimestamps.map(toLocalDayKey));
  const t = todayKey();
  const y = yesterdayKey();
  let cursor: Date;
  if (uniqueDays.has(t)) {
    cursor = new Date();
  } else if (uniqueDays.has(y)) {
    cursor = new Date(Date.now() - 24 * 60 * 60 * 1000);
  } else {
    return 0;
  }
  let streak = 0;
  while (uniqueDays.has(toLocalDayKey(cursor.getTime()))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

export type UserSessionStats = {
  totalSessions: number;
  streakDays: number;
  latestAt: number | null;
  hasBaseline: boolean;
};

/** Headline numbers for the dashboard header (streak + total sessions). */
export async function getUserSessionStats(userId: string): Promise<UserSessionStats> {
  const db = getDb();
  const rows = await db
    .select({ createdAt: practiceSession.createdAt, kind: practiceSession.kind })
    .from(practiceSession)
    .where(
      and(
        eq(practiceSession.userId, userId),
        inArray(practiceSession.kind, COUNTABLE_SESSION_KINDS as unknown as string[]),
      ),
    )
    .orderBy(desc(practiceSession.createdAt));

  const total = rows.length;
  const streakDays = computeStreakDays(rows.map((r) => r.createdAt));
  const latestAt = rows[0]?.createdAt ?? null;
  const hasBaseline = rows.some((r) => r.kind === "onboarding_assessment");
  return { totalSessions: total, streakDays, latestAt, hasBaseline };
}

/** Recent practice sessions joined with scores — drives Progress timeline + Practice diff card. */
export async function listUserSessions(
  userId: string,
  opts: { limit?: number; kinds?: readonly string[] } = {},
): Promise<SessionListRow[]> {
  const db = getDb();
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 200));
  const kinds = opts.kinds ?? COUNTABLE_SESSION_KINDS;

  const rows = await db
    .select({
      id: practiceSession.id,
      kind: practiceSession.kind,
      title: practiceSession.title,
      audioRelativePath: practiceSession.audioRelativePath,
      durationMs: practiceSession.durationMs,
      createdAt: practiceSession.createdAt,
      pronunciation: sessionScores.pronunciation,
      grammar: sessionScores.grammar,
      fluency: sessionScores.fluency,
      vocabulary: sessionScores.vocabulary,
      fillerWords: sessionScores.fillerWords,
      pacing: sessionScores.pacing,
    })
    .from(practiceSession)
    .leftJoin(sessionScores, eq(sessionScores.sessionId, practiceSession.id))
    .where(
      and(
        eq(practiceSession.userId, userId),
        inArray(practiceSession.kind, kinds as unknown as string[]),
      ),
    )
    .orderBy(desc(practiceSession.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    audioRelativePath: r.audioRelativePath,
    durationMs: r.durationMs,
    createdAt: r.createdAt,
    scores:
      r.pronunciation != null &&
      r.grammar != null &&
      r.fluency != null &&
      r.vocabulary != null &&
      r.fillerWords != null &&
      r.pacing != null
        ? {
            pronunciation: r.pronunciation,
            grammar: r.grammar,
            fluency: r.fluency,
            vocabulary: r.vocabulary,
            fillerWords: r.fillerWords,
            pacing: r.pacing,
          }
        : null,
  }));
}

/** Most recent session (with scores) for the given kinds — used on Practice today. */
export async function getLatestSessionWithScores(
  userId: string,
  kinds: readonly string[],
): Promise<SessionListRow | null> {
  const rows = await listUserSessions(userId, { limit: 1, kinds });
  const row = rows[0];
  if (!row?.scores) return null;
  return row;
}

/** Average score of all six dimensions for a single session (handy for the timeline summary). */
export function sessionAverageScore(scores: NonNullable<SessionListRow["scores"]>): number {
  return Math.round(
    (scores.pronunciation +
      scores.grammar +
      scores.fluency +
      scores.vocabulary +
      scores.fillerWords +
      scores.pacing) /
      6,
  );
}
