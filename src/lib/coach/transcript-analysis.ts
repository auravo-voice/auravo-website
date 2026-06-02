import "server-only";

import type { DerivedMetrics } from "@/lib/analysis/derive";
import type { AcousticFeatures } from "@/lib/audio/acoustic";
import { getGroqApiKey, getGroqCoachTimeoutMs, getGroqModel } from "@/lib/groq/env";

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

function parseInsights(raw: string): TranscriptInsights {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const jsonStr = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
  const o = JSON.parse(jsonStr) as Record<string, unknown>;

  const patterns: CoachingPattern[] = [];
  if (Array.isArray(o.patterns)) {
    for (const p of o.patterns) {
      if (!p || typeof p !== "object") continue;
      const row = p as Record<string, unknown>;
      if (
        typeof row.pattern === "string" &&
        typeof row.evidence === "string" &&
        typeof row.impact === "string" &&
        typeof row.fix === "string"
      ) {
        patterns.push({
          pattern: row.pattern.trim(),
          evidence: row.evidence.trim(),
          impact: row.impact.trim(),
          fix: row.fix.trim(),
        });
      }
    }
  }

  const acoustic_patterns: AcousticCoachingPattern[] = [];
  const acousticRaw = o.acoustic_patterns ?? o.acousticPatterns;
  if (Array.isArray(acousticRaw)) {
    for (const p of acousticRaw) {
      if (!p || typeof p !== "object") continue;
      const row = p as Record<string, unknown>;
      if (
        typeof row.pattern === "string" &&
        typeof row.timestamps === "string" &&
        typeof row.fix === "string"
      ) {
        acoustic_patterns.push({
          pattern: row.pattern.trim(),
          timestamps: row.timestamps.trim(),
          fix: row.fix.trim(),
        });
      }
    }
  }

  const biggest_issue =
    typeof o.biggest_issue === "string"
      ? o.biggest_issue.trim()
      : typeof o.biggestIssue === "string"
        ? o.biggestIssue.trim()
        : null;
  const strength = typeof o.strength === "string" ? o.strength.trim() : null;

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

  const collapseNote =
    acoustic.intensity.collapseSegments.length > 0
      ? `Voice energy collapsed at: ${acoustic.intensity.collapseSegments.map((s) => `${s.start}s-${s.end}s`).join(", ")}`
      : "No significant energy collapse detected";

  const topFillers =
    derivedMetrics.topFillers.length > 0 ? derivedMetrics.topFillers.join(", ") : "none";

  const userMessage = `
You are analyzing a speech transcript for a coaching app.
The speaker's goal is: ${userGoal}

Read this transcript and identify ONLY non-obvious patterns — things that 
wouldn't show up in word counts or timing metrics.

Look specifically for:
- Hedging language and where it clusters (e.g. "I think maybe", "sort of", "I guess")
- Sentence structure breakdown under complexity
- Confidence signals (trailing off, over-explaining, self-correction)
- Vocabulary mismatch (formal/informal inconsistency)
- Logical flow issues (jumping topics, incomplete thoughts)

Acoustic context already computed (use this to confirm patterns):
- Pitch range: ${acoustic.pitch.range}Hz (below 50Hz = monotone)
- Monotone: ${acoustic.pitch.isMonotone}
- ${collapseNote}
- Clarity score: ${acoustic.rhythm.clarityScore}

Known surface metrics (do not repeat these, find what's beyond them):
- WPM: ${derivedMetrics.wpm ?? "unknown"}
- Filler rate: ${derivedMetrics.fillerRatePerMin.toFixed(1)}/min
- Top fillers: ${topFillers}
- Hedge count: ${derivedMetrics.hedgeCount}
- Trailing count: ${derivedMetrics.trailingCount}
- Restate count: ${derivedMetrics.restateCount}

Return JSON only, no preamble, no markdown backticks:
{
  "patterns": [
    {
      "pattern": "name of the pattern",
      "evidence": "exact short quote from transcript showing it",
      "impact": "why this matters for the speaker's goal",
      "fix": "one concrete thing to practice this week"
    }
  ],
  "acoustic_patterns": [
    {
      "pattern": "e.g. voice energy drops when hedging",
      "timestamps": "e.g. 0:45-1:10",
      "fix": "one concrete thing"
    }
  ],
  "biggest_issue": "single most important thing to work on",
  "strength": "one genuine thing they did well"
}

Transcript:
${transcript.slice(0, 3000)}
`.trim();

  const model = getGroqModel();
  console.log(`Groq coaching call: model=${model}, transcript_length=${transcript.length}`);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getGroqApiKey()}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      temperature: 0.3,
      messages: [{ role: "user", content: userMessage }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(getGroqCoachTimeoutMs()),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} ${error.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";

  try {
    return parseInsights(text);
  } catch {
    console.error("Failed to parse Groq response:", text.slice(0, 500));
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
