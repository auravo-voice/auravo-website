import type { ConversationMetrics } from "@/lib/analysis/conversation";

/** Subset of `voiceAnalysis` shown on simulation / meeting-prep scorecards. */
export type VoiceDeliveryPeek = {
  wpm: number | null;
  fillerRatePerMin: number | null;
  pauseCount: number | null;
  longPauseCount: number | null;
  speakingRatio: number | null;
  acousticGrounded: boolean;
  vadGrounded: boolean;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Expects finalize JSON root (response body from simulation or meeting-prep finalize routes). */
export function parseVoiceDeliveryPeek(payload: Record<string, unknown>): VoiceDeliveryPeek | null {
  const va = payload.voiceAnalysis;
  if (!va || typeof va !== "object") return null;
  const vr = va as Record<string, unknown>;
  const dm = vr.derivedMetrics;
  if (!dm || typeof dm !== "object") return null;
  const o = dm as Record<string, unknown>;
  return {
    wpm: num(o.wpm),
    fillerRatePerMin: num(o.fillerRatePerMin),
    pauseCount: num(o.pauseCount),
    longPauseCount: num(o.longPauseCount),
    speakingRatio: num(o.speakingRatio),
    acousticGrounded: vr.acousticFeatures != null && typeof vr.acousticFeatures === "object",
    vadGrounded: vr.vadFeatures != null && typeof vr.vadFeatures === "object",
  };
}

function reqInt(o: Record<string, unknown>, k: string): number | null {
  const v = o[k];
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

export function parseConversationMetricsPayload(raw: unknown): ConversationMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tc = reqInt(o, "turnCount");
  const ut = reqInt(o, "userTurns");
  const at = reqInt(o, "assistantTurns");
  if (tc == null || ut == null || at == null) return null;
  const q = reqInt(o, "quickResponseCount");
  const l = reqInt(o, "longUserTurnsCount");
  const uw = reqInt(o, "userWordCount");
  const aw = reqInt(o, "assistantWordCount");
  const wpt = reqInt(o, "userWordsPerTurn");
  const inc = reqInt(o, "incompleteUserTurns");
  if (
    q == null ||
    l == null ||
    uw == null ||
    aw == null ||
    wpt == null ||
    inc == null
  ) {
    return null;
  }

  return {
    turnCount: tc,
    userTurns: ut,
    assistantTurns: at,
    avgUserTurnSec: num(o.avgUserTurnSec),
    longestUserTurnSec: num(o.longestUserTurnSec),
    userTalkShare: num(o.userTalkShare),
    avgResponseLatencyMs: num(o.avgResponseLatencyMs),
    longestResponseLatencyMs: num(o.longestResponseLatencyMs),
    quickResponseCount: q,
    longUserTurnsCount: l,
    userWordCount: uw,
    assistantWordCount: aw,
    userWordsPerTurn: wpt,
    incompleteUserTurns: inc,
  };
}
