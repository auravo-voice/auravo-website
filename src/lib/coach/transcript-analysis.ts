import "server-only";

import type { DerivedMetrics } from "@/lib/analysis/derive";
import type { AcousticFeatures } from "@/lib/audio/acoustic";
import { normalizeCollapseSegments } from "@/lib/audio/collapse-segments";
import {
  groqTranscriptInsightsSchema,
  normalizeGroqTranscriptInsightsPayload,
  type GroqTranscriptInsightsPayload,
} from "@/lib/coach/transcript-insights-schema";
import { groqChatStructured } from "@/lib/groq/chat-json";

export type CoachingPattern = {
  pattern: string;
  evidence: string;
  impact: string;
  fix: string;
};

export type AcousticCoachingPattern = {
  pattern: string;
  timestamps: string;
  fix: string;
};

export type TranscriptInsights = {
  patterns: CoachingPattern[];
  acoustic_patterns: AcousticCoachingPattern[];
  biggest_issue: string | null;
  strength: string | null;
};

export const EMPTY_TRANSCRIPT_INSIGHTS: TranscriptInsights = {
  patterns: [],
  acoustic_patterns: [],
  biggest_issue: null,
  strength: null,
};

function formatCollapseNote(acoustic: AcousticFeatures): string {
  const segs = normalizeCollapseSegments(acoustic.intensity.collapseSegments);
  if (segs.length === 0) return "No sustained voice-energy dips detected";
  const top = [...segs].sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, 4);
  const times = top.map((s) => `${s.start}s–${s.end}s`).join(", ");
  if (segs.length <= 4) return `${segs.length} sustained dip(s): ${times}`;
  return `${segs.length} sustained dip(s); longest: ${times}`;
}

function mapGroqPayload(data: GroqTranscriptInsightsPayload): TranscriptInsights {
  const acousticRaw = data.acoustic_patterns ?? data.acousticPatterns ?? [];
  const acoustic_patterns: AcousticCoachingPattern[] = acousticRaw
    .map((p) => ({
      pattern: p.pattern.trim(),
      timestamps: p.timestamps.trim() || "throughout the clip",
      fix: p.fix.trim(),
    }))
    .filter((p) => p.pattern.length > 0 && p.fix.length > 0);

  const patterns: CoachingPattern[] = (data.patterns ?? [])
    .map((p) => ({
      pattern: p.pattern.trim(),
      evidence: p.evidence.trim(),
      impact: p.impact.trim(),
      fix: p.fix.trim(),
    }))
    .filter((p) => p.pattern.length > 0 && p.fix.length > 0);

  const biggest_issue = (data.biggest_issue ?? data.biggestIssue)?.trim() || null;
  const strength = data.strength?.trim() || null;

  return { patterns, acoustic_patterns, biggest_issue, strength };
}

/**
 * Groq pass: read transcript + acoustic context and return pattern-based coaching insights.
 */
export async function callGroqForCoaching(
  transcript: string,
  userGoal: string,
  derivedMetrics: DerivedMetrics,
  acousticData: AcousticFeatures | null,
): Promise<TranscriptInsights> {
  if (!transcript.trim()) return EMPTY_TRANSCRIPT_INSIGHTS;

  const acoustic: AcousticFeatures =
    acousticData ??
    ({
      pitch: { mean: 0, range: 0, isMonotone: false, timeline: [] },
      intensity: { mean: 0, collapseSegments: [] },
      rhythm: { tempoVariation: 0, clarityScore: 0 },
    } satisfies AcousticFeatures);

  const collapseNote = formatCollapseNote(acoustic);
  const topFillers =
    derivedMetrics.topFillers.length > 0 ? derivedMetrics.topFillers.join(", ") : "none";

  const userMessage = `
You are analyzing a speech transcript for a coaching app.
The speaker's goal is: ${userGoal}

Read this transcript and identify ONLY non-obvious patterns — things that would not show up in word counts or timing metrics alone.

Look specifically for:
- Hedging language clusters (e.g. "I think maybe", "sort of", "I guess")
- Sentence structure breakdown under complexity
- Confidence signals (trailing off, over-explaining, self-correction)
- Vocabulary mismatch (formal/informal inconsistency)
- Logical flow issues (jumping topics, incomplete thoughts)

Acoustic context (already computed — use to confirm, do not invent timestamps):
- Pitch range: ${acoustic.pitch.range}Hz (below 50Hz = monotone)
- Monotone: ${acoustic.pitch.isMonotone}
- ${collapseNote}
- Clarity score: ${acoustic.rhythm.clarityScore}

Known surface metrics (do not repeat these verbatim; find what is beyond them):
- WPM: ${derivedMetrics.wpm ?? "unknown"}
- Filler rate: ${derivedMetrics.fillerRatePerMin.toFixed(1)}/min
- Top fillers: ${topFillers}
- Hedge count: ${derivedMetrics.hedgeCount}
- Trailing count: ${derivedMetrics.trailingCount}
- Restate count: ${derivedMetrics.restateCount}

Return JSON with keys: patterns (array), acoustic_patterns (array), biggest_issue (string), strength (string).
Each pattern needs: pattern, evidence (short quote), impact, fix.
Keep biggest_issue and strength to one sentence each, actionable and encouraging.

Transcript:
${transcript.slice(0, 3000)}
`.trim();

  console.log(`Groq coaching call: transcript_length=${transcript.length}`);

  try {
    const data = await groqChatStructured({
      messages: [{ role: "user", content: userMessage }],
      schema: groqTranscriptInsightsSchema,
      maxTokens: 2048,
      temperature: 0.3,
      normalize: normalizeGroqTranscriptInsightsPayload,
    });
    return mapGroqPayload(data);
  } catch (e) {
    console.error("[callGroqForCoaching] structured Groq failed:", e);
    return EMPTY_TRANSCRIPT_INSIGHTS;
  }
}

/** @deprecated Use {@link callGroqForCoaching}. Kept for call-site compatibility. */
export async function analyzeTranscriptWithLLM(
  transcript: string,
  userGoal: string,
  derivedMetrics: DerivedMetrics,
  acousticData: AcousticFeatures | null,
): Promise<TranscriptInsights> {
  return callGroqForCoaching(transcript, userGoal, derivedMetrics, acousticData);
}
