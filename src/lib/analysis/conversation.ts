/**
 * Conversational metrics derived from a turn-by-turn transcript (simulations + meeting rehearsals).
 *
 * These are intentionally pure functions over the existing `simulation_turn` shape, so we can compute
 * them at finalize-time without re-running per-turn analysis. The metrics complement the canonical
 * voice analysis (pace, fluency, etc.) with conversation-specific signals like turn balance and
 * response latency.
 */
export type ConversationTurnInput = {
  /** "user" speaks; "assistant" is the AI partner / audience. */
  role: "user" | "assistant";
  text: string;
  /** How long the speaker held the floor on this turn. Null when unknown (assistant turns are usually null). */
  durationMs: number | null;
  /** Wall-clock timestamp when the turn was persisted. We treat this as the turn's *end* time. */
  createdAt: number;
};

export type ConversationMetrics = {
  turnCount: number;
  userTurns: number;
  assistantTurns: number;

  /** Average duration of a user turn in seconds. Null if no durations recorded. */
  avgUserTurnSec: number | null;
  /** Longest single user turn in seconds. Null if no durations recorded. */
  longestUserTurnSec: number | null;
  /** Ratio of user speaking time to total user+assistant speaking time. Null when we can't estimate. */
  userTalkShare: number | null;

  /**
   * Mean wall-clock latency between the assistant finishing its turn and the user finishing theirs
   * minus the user's audio duration — i.e. how long the user "thought" before starting to speak.
   * Useful for the meeting-prep coach ("audience asks a tough question; she waits 12s before speaking"),
   * and as a soft signal for hesitation. Null when there is no valid pairing.
   */
  avgResponseLatencyMs: number | null;
  longestResponseLatencyMs: number | null;

  /** User turns that came back inside `quickResponseThresholdMs`; signal for confident reactivity. */
  quickResponseCount: number;

  /** User turns where audio duration was at least `extendedSilenceFloorMs`; signal for under-engagement. */
  longUserTurnsCount: number;

  /** Word counts give a coarse content-density signal that complements duration. */
  userWordCount: number;
  assistantWordCount: number;
  userWordsPerTurn: number;
  /** Number of user turns that ended without a closing punctuation mark (incomplete thoughts). */
  incompleteUserTurns: number;
};

const QUICK_RESPONSE_THRESHOLD_MS = 1_500;
const EXTENDED_USER_TURN_FLOOR_MS = 45_000;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function endsWithSentenceTerminator(text: string): boolean {
  return /[.!?…]\s*$/.test(text.trim());
}

/**
 * Compute conversation-level metrics. The turn list must be ordered by index ascending — this is the
 * shape `listSimulationTurns()` already returns.
 *
 * Why not store these per-turn? At finalize-time we have everything we need, and computing them on
 * the fly keeps the SQLite schema additive-only.
 */
export function computeConversationMetrics(turns: ConversationTurnInput[]): ConversationMetrics {
  const userTurns = turns.filter((t) => t.role === "user");
  const assistantTurns = turns.filter((t) => t.role === "assistant");

  const userDurs = userTurns
    .map((t) => (t.durationMs ?? 0) / 1000)
    .filter((s) => Number.isFinite(s) && s > 0);
  const assistantDurs = assistantTurns
    .map((t) => (t.durationMs ?? 0) / 1000)
    .filter((s) => Number.isFinite(s) && s > 0);

  const avgUserTurnSec = userDurs.length ? userDurs.reduce((a, b) => a + b, 0) / userDurs.length : null;
  const longestUserTurnSec = userDurs.length ? Math.max(...userDurs) : null;
  const totalUserSec = userDurs.reduce((a, b) => a + b, 0);
  const totalAssistantSec = assistantDurs.reduce((a, b) => a + b, 0);
  const userTalkShare =
    totalUserSec + totalAssistantSec > 0 ? totalUserSec / (totalUserSec + totalAssistantSec) : null;

  // Response latency = (user turn end timestamp) - (preceding assistant turn end timestamp) - (user duration).
  // The first term is how long it took the user to deliver their reply *including* think time + speech;
  // subtracting the user's audio duration leaves an estimate of pre-speech "think" time.
  const latencies: number[] = [];
  let quickResponses = 0;
  let longUserTurns = 0;
  let incompleteUserTurns = 0;
  let userWords = 0;
  let assistantWords = 0;

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]!;
    if (turn.role === "user") {
      userWords += wordCount(turn.text);
      if ((turn.durationMs ?? 0) >= EXTENDED_USER_TURN_FLOOR_MS) longUserTurns++;
      if (turn.text.trim().length > 0 && !endsWithSentenceTerminator(turn.text)) incompleteUserTurns++;
      // Find the most recent preceding assistant turn (if any).
      let prev: ConversationTurnInput | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (turns[j]!.role === "assistant") {
          prev = turns[j]!;
          break;
        }
      }
      if (prev && turn.durationMs != null && turn.createdAt > prev.createdAt) {
        const total = turn.createdAt - prev.createdAt;
        const latency = Math.max(0, total - turn.durationMs);
        latencies.push(latency);
        if (latency <= QUICK_RESPONSE_THRESHOLD_MS) quickResponses++;
      }
    } else {
      assistantWords += wordCount(turn.text);
    }
  }

  const avgResponseLatencyMs = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;
  const longestResponseLatencyMs = latencies.length ? Math.max(...latencies) : null;

  return {
    turnCount: turns.length,
    userTurns: userTurns.length,
    assistantTurns: assistantTurns.length,
    avgUserTurnSec: avgUserTurnSec != null ? Number(avgUserTurnSec.toFixed(2)) : null,
    longestUserTurnSec: longestUserTurnSec != null ? Number(longestUserTurnSec.toFixed(2)) : null,
    userTalkShare: userTalkShare != null ? Number(userTalkShare.toFixed(3)) : null,
    avgResponseLatencyMs,
    longestResponseLatencyMs,
    quickResponseCount: quickResponses,
    longUserTurnsCount: longUserTurns,
    userWordCount: userWords,
    assistantWordCount: assistantWords,
    userWordsPerTurn: userTurns.length > 0 ? Math.round(userWords / userTurns.length) : 0,
    incompleteUserTurns,
  };
}

/** A short coach-voice bullet list summarising the conversation, e.g. for the meeting-prep coach note. */
export function describeConversation(m: ConversationMetrics): string[] {
  const bits: string[] = [];
  if (m.userTalkShare != null) {
    if (m.userTalkShare > 0.8) {
      bits.push("You held the floor for most of the conversation — make space for the other side.");
    } else if (m.userTalkShare < 0.35) {
      bits.push("The audience did most of the talking — drive more answers next time.");
    } else {
      bits.push(`Turn balance was healthy (you spoke ~${Math.round(m.userTalkShare * 100)}% of the time).`);
    }
  }
  if (m.avgResponseLatencyMs != null) {
    const secs = m.avgResponseLatencyMs / 1000;
    if (secs > 4.5) {
      bits.push(`Average think-before-speaking was ${secs.toFixed(1)}s — keep the response fresh under 3s when possible.`);
    } else if (secs < 0.6) {
      bits.push("You jumped in almost immediately — confident reactivity.");
    }
  }
  if (m.quickResponseCount > 0) {
    bits.push(`${m.quickResponseCount} quick response${m.quickResponseCount === 1 ? "" : "s"} under 1.5s.`);
  }
  if (m.incompleteUserTurns > 0) {
    bits.push(
      `${m.incompleteUserTurns} turn${m.incompleteUserTurns === 1 ? "" : "s"} ended without a closing thought — land each answer with a clean stop.`,
    );
  }
  return bits;
}
