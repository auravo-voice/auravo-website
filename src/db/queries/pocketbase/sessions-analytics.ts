import "server-only";

import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";
import { mapSessionScores, pbTs } from "@/db/pocketbase-map";
import { pocketBaseFileUrl } from "@/lib/storage/audio-path";
import type { TrendSession } from "@/lib/analysis/trends";
import { COUNTABLE_SESSION_KINDS } from "@/db/queries/sessions";
import type { SessionListRow } from "@/db/queries/sessions";

export type SessionListRowWithAnalysis = SessionListRow & {
  analysisJson: string | null;
};

export async function listUserSessionsWithAnalysis(
  userId: string,
  opts: { limit?: number; kinds?: readonly string[] } = {},
): Promise<SessionListRowWithAnalysis[]> {
  const pb = await getServerPocketBase();
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 200));
  const kinds = opts.kinds ?? COUNTABLE_SESSION_KINDS;
  const kindFilter = kinds.map((k) => `kind = "${k}"`).join(" || ");
  const rows = await pb.collection(PB.practiceSessions).getList(1, limit, {
    filter: `user = "${userId}" && (${kindFilter})`,
    sort: "-created",
  });

  const out: SessionListRowWithAnalysis[] = [];
  for (const r of rows.items) {
    let scores: SessionListRow["scores"] = null;
    let analysisJson: string | null = null;
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
    try {
      const t = await pb.collection(PB.sessionTranscripts).getFirstListItem(`session = "${r.id}"`);
      analysisJson = typeof t.analysis_json === "string" ? t.analysis_json : null;
    } catch {
      analysisJson = null;
    }
    const file = typeof r.audio === "string" ? r.audio : "";
    const audioRelativePath = file
      ? pocketBaseFileUrl(PB.practiceSessions, r.id, file)
      : `tmp/${r.id}.webm`;
    out.push({
      id: r.id,
      kind: String(r.kind),
      title: typeof r.title === "string" ? r.title : null,
      audioRelativePath,
      durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
      createdAt: pbTs(r),
      scores,
      analysisJson,
    });
  }
  return out;
}

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
