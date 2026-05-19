import "server-only";

import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";
import { mapSessionScores } from "@/db/pocketbase-map";
import { pbTs } from "@/db/pocketbase-map";
import { pocketBaseFileUrl } from "@/lib/storage/audio-path";

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

function audioRefForRecord(record: { id: string; audio?: string }): string {
  const file = typeof record.audio === "string" ? record.audio : "";
  if (!file) return "";
  return pocketBaseFileUrl(PB.practiceSessions, record.id, file);
}

export async function getUserSessionStats(userId: string): Promise<UserSessionStats> {
  const pb = await getServerPocketBase();
  const kinds = COUNTABLE_SESSION_KINDS.map((k) => `"${k}"`).join(" || kind = ");
  const rows = await pb.collection(PB.practiceSessions).getFullList({
    filter: `user = "${userId}" && (${kinds})`,
    sort: "-created",
  });
  const timestamps = rows.map((r) => pbTs(r));
  const total = rows.length;
  const streakDays = computeStreakDays(timestamps);
  const latestAt = timestamps[0] ?? null;
  const hasBaseline = rows.some((r) => r.kind === "onboarding_assessment");
  return { totalSessions: total, streakDays, latestAt, hasBaseline };
}

export async function listUserSessions(
  userId: string,
  opts: { limit?: number; kinds?: readonly string[] } = {},
): Promise<SessionListRow[]> {
  const pb = await getServerPocketBase();
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 200));
  const kinds = opts.kinds ?? COUNTABLE_SESSION_KINDS;
  const kindFilter = kinds.map((k) => `kind = "${k}"`).join(" || ");
  const rows = await pb.collection(PB.practiceSessions).getList(1, limit, {
    filter: `user = "${userId}" && (${kindFilter})`,
    sort: "-created",
  });

  const out: SessionListRow[] = [];
  for (const r of rows.items) {
    let scores: SessionListRow["scores"] = null;
    try {
      const s = await pb.collection(PB.sessionScores).getFirstListItem(`session = "${r.id}"`);
      const mapped = mapSessionScores(s, r.id);
      scores = {
        pronunciation: mapped.pronunciation,
        grammar: mapped.grammar,
        fluency: mapped.fluency,
        vocabulary: mapped.vocabulary,
        fillerWords: mapped.fillerWords,
        pacing: mapped.pacing,
      };
    } catch {
      scores = null;
    }
    out.push({
      id: r.id,
      kind: String(r.kind),
      title: typeof r.title === "string" ? r.title : null,
      audioRelativePath: audioRefForRecord(r as { id: string; audio?: string }) || `tmp/${r.id}.webm`,
      durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
      createdAt: pbTs(r),
      scores,
    });
  }
  return out;
}

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
