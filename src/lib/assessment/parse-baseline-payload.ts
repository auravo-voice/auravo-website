import type { BaselineAnalysis, GrammarAnalysisSnapshot, GrammarErrorType } from "@/lib/assessment/baseline-analysis-types";
import type { AssessmentBaselinePayload, AssessmentCoachSummary } from "@/lib/assessment/baseline-results-payload";
import type { SegmentTranscriptRow } from "@/lib/assessment/segment-transcripts";
import {
  ASSESSMENT_SEGMENT_KINDS,
  isAssessmentSegmentKind,
  segmentDisplayLabel,
} from "@/lib/assessment/segments";
import type { RadarDimension } from "@/lib/coach/schemas";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";

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
    const errorType =
      r.errorType === "tense" ||
      r.errorType === "article" ||
      r.errorType === "preposition" ||
      r.errorType === "agreement" ||
      r.errorType === "word_choice" ||
      r.errorType === "other"
        ? (r.errorType as GrammarErrorType)
        : undefined;
    grammarFlags.push({
      label: r.label,
      excerpt: r.excerpt,
      suggestion: r.suggestion,
      correction: typeof r.correction === "string" ? r.correction : undefined,
      errorType,
      source: r.source === "groq" || r.source === "legacy" ? r.source : undefined,
    });
  }
  const pronunciationTips: BaselineAnalysis["pronunciationTips"] = [];
  for (const el of pRaw) {
    if (!el || typeof el !== "object") continue;
    const r = el as Record<string, unknown>;
    if (typeof r.heardAs !== "string" || typeof r.confidence !== "number" || typeof r.tip !== "string") continue;
    pronunciationTips.push({ heardAs: r.heardAs, confidence: r.confidence, tip: r.tip });
  }
  const grammarAnalysis = parseGrammarAnalysisSnapshot(a.grammarAnalysis);
  return { grammarFlags, pronunciationTips, ...(grammarAnalysis ? { grammarAnalysis } : {}) };
}

function parseGrammarAnalysisSnapshot(raw: unknown): GrammarAnalysisSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const errorsRaw = o.errors;
  if (!Array.isArray(errorsRaw)) return undefined;
  const errors: GrammarAnalysisSnapshot["errors"] = [];
  for (const el of errorsRaw) {
    if (!el || typeof el !== "object") continue;
    const r = el as Record<string, unknown>;
    if (
      typeof r.error !== "string" ||
      typeof r.correction !== "string" ||
      typeof r.explanation !== "string" ||
      (r.type !== "tense" &&
        r.type !== "article" &&
        r.type !== "preposition" &&
        r.type !== "agreement" &&
        r.type !== "word_choice" &&
        r.type !== "other")
    ) {
      continue;
    }
    errors.push({
      error: r.error,
      correction: r.correction,
      type: r.type,
      explanation: r.explanation,
    });
  }
  return {
    errors,
    score: typeof o.score === "number" && Number.isFinite(o.score) ? Math.round(o.score) : null,
    summary: typeof o.summary === "string" ? o.summary : null,
    strengths: Array.isArray(o.strengths) ? o.strengths.filter((x): x is string => typeof x === "string") : [],
  };
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

function parsePatterns(raw: unknown): CoachingPattern[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const o = p as Record<string, unknown>;
    if (
      typeof o.pattern !== "string" ||
      typeof o.evidence !== "string" ||
      typeof o.impact !== "string" ||
      typeof o.fix !== "string"
    ) {
      return [];
    }
    return [{ pattern: o.pattern, evidence: o.evidence, impact: o.impact, fix: o.fix }];
  });
}

function parseAcousticPatterns(raw: unknown): AcousticCoachingPattern[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const o = p as Record<string, unknown>;
    if (typeof o.pattern !== "string" || typeof o.timestamps !== "string" || typeof o.fix !== "string") {
      return [];
    }
    return [{ pattern: o.pattern, timestamps: o.timestamps, fix: o.fix }];
  });
}

function parseCoachSummary(json: Record<string, unknown>): AssessmentCoachSummary | undefined {
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
  const biggestIssue =
    typeof o.biggestIssue === "string"
      ? o.biggestIssue
      : typeof o.biggest_issue === "string"
        ? o.biggest_issue
        : null;
  const strength = typeof o.strength === "string" ? o.strength : null;
  const patterns = parsePatterns(o.patterns);
  const acousticPatterns = parseAcousticPatterns(o.acousticPatterns ?? o.acoustic_patterns);
  if (
    !summary.trim() &&
    strengths.length === 0 &&
    improvementAreas.length === 0 &&
    !biggestIssue &&
    patterns.length === 0
  ) {
    return undefined;
  }
  return {
    summary,
    strengths,
    improvementAreas,
    recommendationRationale,
    biggestIssue,
    strength,
    patterns,
    acousticPatterns,
  };
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

function parseSegmentTranscripts(raw: unknown): SegmentTranscriptRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows: SegmentTranscriptRow[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    if (!isAssessmentSegmentKind(o.kind) || typeof o.transcript !== "string") continue;
    const transcript = o.transcript.trim();
    if (!transcript) continue;
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : undefined;
    const label =
      typeof o.label === "string" && o.label.trim() ? o.label.trim() : segmentDisplayLabel(o.kind);
    rows.push({
      kind: o.kind,
      label,
      title: title ?? label,
      transcript,
    });
  }
  if (rows.length === 0) return undefined;
  const order = new Map(ASSESSMENT_SEGMENT_KINDS.map((k, i) => [k, i]));
  rows.sort((a, b) => (order.get(a.kind) ?? 0) - (order.get(b.kind) ?? 0));
  return rows;
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
    segmentTranscripts: parseSegmentTranscripts(json.segmentTranscripts),
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
  segmentTranscripts?: SegmentTranscriptRow[];
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
    segmentTranscripts: opts.segmentTranscripts,
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
