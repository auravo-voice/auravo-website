import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { practiceSession, sessionScores, sessionTranscript } from "@/db/schema";
import type { TrendSession } from "@/lib/analysis/trends";
import { COUNTABLE_SESSION_KINDS } from "@/db/queries/sessions";
import type { SessionListRow } from "@/db/queries/sessions";

/** Session row plus raw `analysis_json` for longitudinal trend enrichment. */
export type SessionListRowWithAnalysis = SessionListRow & {
  analysisJson: string | null;
};

/** Same ordering as {@link listUserSessions}, but joins `session_transcript` for `analysisJson`. */
export async function listUserSessionsWithAnalysis(
  userId: string,
  opts: { limit?: number; kinds?: readonly string[] } = {},
): Promise<SessionListRowWithAnalysis[]> {
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
      analysisJson: sessionTranscript.analysisJson,
    })
    .from(practiceSession)
    .leftJoin(sessionScores, eq(sessionScores.sessionId, practiceSession.id))
    .leftJoin(sessionTranscript, eq(sessionTranscript.sessionId, practiceSession.id))
    .where(
      and(eq(practiceSession.userId, userId), inArray(practiceSession.kind, kinds as unknown as string[])),
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
    analysisJson: r.analysisJson ?? null,
  }));
}

/**
 * Parses persisted `voiceAnalysis.derivedMetrics` from canonical analysis JSON into the shape
 * expected by {@link buildTrendInsights}. Safe for malformed or legacy payloads.
 */
export function trendSessionsFromRows(rows: SessionListRowWithAnalysis[]): TrendSession[] {
  const out: TrendSession[] = [];
  for (const row of rows) {
    if (!row.scores) continue;
    out.push({
      id: row.id,
      kind: row.kind,
      createdAt: row.createdAt,
      scores: {
        pronunciation: row.scores.pronunciation,
        grammar: row.scores.grammar,
        fluency: row.scores.fluency,
        vocabulary: row.scores.vocabulary,
        filler_words: row.scores.fillerWords,
        pacing: row.scores.pacing,
      },
      metrics: extractDerivedMetrics(row.analysisJson),
    });
  }
  return out;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function extractDerivedMetrics(analysisJson: string | null): TrendSession["metrics"] {
  if (!analysisJson?.trim()) return null;
  try {
    const o = JSON.parse(analysisJson) as Record<string, unknown>;
    const va = o.voiceAnalysis as Record<string, unknown> | undefined;
    const dm = va?.derivedMetrics as Record<string, unknown> | undefined;
    if (!dm || typeof dm !== "object") return null;
    return {
      wpm: num(dm.wpm),
      fillerCount: num(dm.fillerCount),
      fillerPerMinute: num(dm.fillerRatePerMin),
      longPauseCount: num(dm.longPauseCount),
      pauseCount: num(dm.pauseCount),
      speakingRatio: num(dm.speakingRatio),
      clarityEstimate: num(dm.clarityEstimate),
      loudnessStability: num(dm.loudnessStability),
      pitchVariation: num(dm.pitchVariation),
    };
  } catch {
    return null;
  }
}
