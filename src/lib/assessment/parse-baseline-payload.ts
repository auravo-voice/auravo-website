import type { BaselineAnalysis } from "@/lib/assessment/baseline-analysis-types";
import type { AssessmentBaselinePayload } from "@/lib/assessment/baseline-results-payload";
import type { RadarDimension } from "@/lib/coach/schemas";

export function parseBaselineAnalysis(o: unknown): BaselineAnalysis {
  if (!o || typeof o !== "object") return { grammarFlags: [], pronunciationTips: [] };
  const a = o as Record<string, unknown>;
  const gRaw = a.grammarFlags;
  const pRaw = a.pronunciationTips;
  if (!Array.isArray(gRaw) || !Array.isArray(pRaw)) return { grammarFlags: [], pronunciationTips: [] };
  const grammarFlags: BaselineAnalysis["grammarFlags"] = [];
  for (const el of gRaw) {
    if (!el || typeof el !== "object") continue;
    const r = el as Record<string, unknown>;
    if (typeof r.label !== "string" || typeof r.excerpt !== "string" || typeof r.suggestion !== "string") continue;
    grammarFlags.push({ label: r.label, excerpt: r.excerpt, suggestion: r.suggestion });
  }
  const pronunciationTips: BaselineAnalysis["pronunciationTips"] = [];
  for (const el of pRaw) {
    if (!el || typeof el !== "object") continue;
    const r = el as Record<string, unknown>;
    if (typeof r.heardAs !== "string" || typeof r.confidence !== "number" || typeof r.tip !== "string") continue;
    pronunciationTips.push({ heardAs: r.heardAs, confidence: r.confidence, tip: r.tip });
  }
  return { grammarFlags, pronunciationTips };
}

function parseVoiceExplanations(json: Record<string, unknown>): AssessmentBaselinePayload["voiceExplanations"] {
  const va = json.voiceAnalysis;
  if (!va || typeof va !== "object") return undefined;
  const exp = (va as Record<string, unknown>).explanations;
  if (!exp || typeof exp !== "object" || Array.isArray(exp)) return undefined;
  const voiceExplanations: Partial<Record<string, string>> = {};
  for (const [k, v] of Object.entries(exp)) {
    if (typeof v === "string" && v.trim()) voiceExplanations[k] = v;
  }
  return Object.keys(voiceExplanations).length > 0 ? voiceExplanations : undefined;
}

function parseCoachSummary(json: Record<string, unknown>): AssessmentBaselinePayload["coachSummary"] {
  const cs = json.coachSummary;
  if (!cs || typeof cs !== "object") return undefined;
  const o = cs as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : "";
  const strengths = Array.isArray(o.strengths) ? o.strengths.filter((x): x is string => typeof x === "string") : [];
  const improvementAreas = Array.isArray(o.improvementAreas)
    ? o.improvementAreas.filter((x): x is string => typeof x === "string")
    : [];
  const recommendationRationale =
    typeof o.recommendationRationale === "string" ? o.recommendationRationale : undefined;
  if (!summary.trim() && strengths.length === 0 && improvementAreas.length === 0) return undefined;
  return { summary, strengths, improvementAreas, recommendationRationale };
}

function parseRecommendedExercises(
  json: Record<string, unknown>,
): AssessmentBaselinePayload["recommendedExercises"] {
  const rec = json.recommendedExercises ?? json.candidateExercises;
  if (!Array.isArray(rec)) return undefined;
  const list = rec.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.title !== "string") return [];
    const subtitle = typeof r.subtitle === "string" ? r.subtitle : "";
    return [{ id: r.id, title: r.title, subtitle }];
  });
  return list.length > 0 ? list : undefined;
}

function parseDimensions(dimsRaw: unknown): RadarDimension[] | null {
  if (!Array.isArray(dimsRaw)) return null;
  const dimensions: RadarDimension[] = [];
  for (const el of dimsRaw) {
    if (!el || typeof el !== "object") return null;
    const o = el as Record<string, unknown>;
    if (typeof o.key !== "string" || typeof o.label !== "string" || typeof o.score !== "number") return null;
    dimensions.push({ key: o.key, label: o.label, score: o.score });
  }
  return dimensions;
}

/** Parse the JSON body from POST /api/assessment/draft/finalize (client-side handoff). */
export function parseFinalizePayload(json: Record<string, unknown>): AssessmentBaselinePayload | null {
  if (typeof json.userId !== "string" || typeof json.sessionId !== "string") return null;
  const dimensions = parseDimensions(json.dimensions);
  if (!dimensions) return null;

  return {
    userId: json.userId,
    sessionId: json.sessionId,
    transcript: typeof json.transcript === "string" ? json.transcript : "",
    averageScore:
      typeof json.averageScore === "number" && Number.isFinite(json.averageScore)
        ? Math.round(json.averageScore)
        : 0,
    goalLabel: typeof json.goalLabel === "string" ? json.goalLabel : null,
    dimensions,
    analysis: parseBaselineAnalysis(json.analysis),
    voiceExplanations: parseVoiceExplanations(json),
    coachSummary: parseCoachSummary(json),
    recommendedExercises: parseRecommendedExercises(json),
    degraded: json.degraded === true,
  };
}

/** Rebuild UI payload from persisted `session_transcript.analysis_json` + scores. */
export function buildAssessmentPayloadFromPersisted(opts: {
  userId: string;
  sessionId: string;
  transcript: string;
  dimensions: RadarDimension[];
  goalLabel: string | null;
  analysisJson: string | null;
}): AssessmentBaselinePayload {
  let parsed: Record<string, unknown> = {};
  if (opts.analysisJson) {
    try {
      const j = JSON.parse(opts.analysisJson) as unknown;
      if (j && typeof j === "object" && !Array.isArray(j)) parsed = j as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  const averageScore = opts.dimensions.length
    ? Math.round(opts.dimensions.reduce((a, d) => a + d.score, 0) / opts.dimensions.length)
    : 0;

  // `degraded` is only for audio/transcription fallback — not coach narrative fallback.
  const degraded = parsed.degraded === true;

  return {
    userId: opts.userId,
    sessionId: opts.sessionId,
    transcript: opts.transcript.slice(0, 12_000),
    dimensions: opts.dimensions,
    averageScore,
    goalLabel: opts.goalLabel,
    analysis: parseBaselineAnalysis(parsed),
    voiceExplanations: parseVoiceExplanations(parsed),
    coachSummary: parseCoachSummary(parsed),
    recommendedExercises: parseRecommendedExercises(parsed),
    degraded: degraded === true,
  };
}
