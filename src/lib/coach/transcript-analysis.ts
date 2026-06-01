import "server-only";

import type { DerivedMetrics } from "@/lib/analysis/derive";
import type { AcousticFeatures } from "@/lib/audio/acoustic";
import { getCoachOllamaTimeoutMs, getOllamaBaseUrl, getOllamaModel } from "@/lib/ollama/env";
import { OllamaCoachError } from "@/lib/ollama/chat-json";

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

const EMPTY_INSIGHTS: TranscriptInsights = {
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

function buildPrompt(
  transcript: string,
  userGoal: string,
  derivedMetrics: DerivedMetrics,
  acousticData: AcousticFeatures,
): string {
  const collapseNote =
    acousticData.intensity.collapseSegments.length > 0
      ? `Voice energy collapsed at: ${acousticData.intensity.collapseSegments.map((s) => `${s.start}s-${s.end}s`).join(", ")}`
      : "No significant energy collapse detected";

  const topFillers =
    derivedMetrics.topFillers.length > 0 ? derivedMetrics.topFillers.join(", ") : "none detected";

  return `
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
- Pitch range: ${acousticData.pitch.range}Hz (below 50Hz = monotone)
- Monotone: ${acousticData.pitch.isMonotone}
- ${collapseNote}
- Clarity score: ${acousticData.rhythm.clarityScore}

Known surface metrics (do not repeat these):
- WPM: ${derivedMetrics.wpm ?? "unknown"}
- Filler rate: ${derivedMetrics.fillerRatePerMin.toFixed(1)}/min
- Hedge phrases: ${derivedMetrics.hedgeCount}
- Top fillers: ${topFillers}

Return JSON only, no preamble, no markdown:
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
}

/**
 * Pass 2: LLM reads the raw transcript plus acoustic context to surface non-obvious coaching patterns.
 */
export async function analyzeTranscriptWithLLM(
  transcript: string,
  userGoal: string,
  derivedMetrics: DerivedMetrics,
  acousticData: AcousticFeatures | null,
): Promise<TranscriptInsights> {
  if (!transcript.trim()) return EMPTY_INSIGHTS;

  const acoustic: AcousticFeatures =
    acousticData ??
    ({
      pitch: { mean: 0, range: 0, isMonotone: false, timeline: [] },
      intensity: { mean: 0, collapseSegments: [] },
      rhythm: { tempoVariation: 0, clarityScore: 0 },
    } satisfies AcousticFeatures);

  const prompt = buildPrompt(transcript, userGoal, derivedMetrics, acoustic);
  const url = `${getOllamaBaseUrl()}/api/generate`;
  const timeoutMs = getCoachOllamaTimeoutMs();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getOllamaModel(),
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 800,
          num_ctx: 2048,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new OllamaCoachError(
      `Transcript coach did not finish within ${Math.round(timeoutMs / 1000)}s.`,
      e,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OllamaCoachError(`Ollama generate failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { response?: string };
  const raw = typeof data.response === "string" ? data.response : "";

  try {
    return parseInsights(raw);
  } catch {
    return EMPTY_INSIGHTS;
  }
}
