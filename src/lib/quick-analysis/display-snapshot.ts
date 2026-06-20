import type { QuickAnalysisTranscriptSegment, QuickAnalysisWordConfidence } from "@/app/quick-analysis/pronunciation-types";
import type { PronunciationHighlightSource } from "@/app/quick-analysis/lib/word-highlight";
import { flaggedWordsForPhonetics } from "@/lib/quick-analysis/word-confidences";
import { resolvePronunciationHighlightSource } from "@/app/quick-analysis/lib/word-highlight";
import type { GrammarFlag } from "@/lib/assessment/baseline-analysis-types";
import type { QuickAnalysisGrammarSnapshot } from "@/lib/quick-analysis/grammar-snapshot";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";

/** Exact UI payload from Quick Analysis full mode — stored in `analysis_json.quickAnalysisDisplay`. */
export type QuickAnalysisDisplaySnapshot = {
  version: 1;
  scores: SixDimensionScores;
  transcriptSegments: QuickAnalysisTranscriptSegment[];
  /** Full-session word timings — used to fill segment highlights on replay. */
  wordConfidences?: QuickAnalysisWordConfidence[];
  phoneticMap: Record<string, string>;
  /** Groq phonetic guides when available; otherwise Whisper confidence. */
  pronunciationHighlightSource: PronunciationHighlightSource;
  coachSummary: {
    biggestIssue: string | null;
    strength: string | null;
    patterns: CoachingPattern[];
    acousticPatterns: AcousticCoachingPattern[];
    vocabularySuggestions: VocabularySuggestion[];
  };
  /** Groq grammar feedback — full Quick Analysis only. */
  grammar?: QuickAnalysisGrammarSnapshot;
};

function parseWordConfidences(raw: unknown): QuickAnalysisWordConfidence[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((w) => {
    if (!w || typeof w !== "object") return [];
    const o = w as Record<string, unknown>;
    if (typeof o.word !== "string" || typeof o.confidence !== "number") return [];
    return [
      {
        word: o.word,
        confidence: o.confidence,
        start: typeof o.start === "number" ? o.start : 0,
        end: typeof o.end === "number" ? o.end : 0,
      },
    ];
  });
}

function parseTranscriptSegments(raw: unknown): QuickAnalysisTranscriptSegment[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((seg) => {
    if (!seg || typeof seg !== "object") return [];
    const o = seg as Record<string, unknown>;
    if (typeof o.label !== "string" || typeof o.transcript !== "string") return [];
    return [
      {
        label: o.label,
        transcript: o.transcript,
        wordConfidences: parseWordConfidences(o.wordConfidences),
      },
    ];
  });
}

function parsePhoneticMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
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

function parseVocabularySuggestions(raw: unknown): VocabularySuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((el) => {
    if (!el || typeof el !== "object") return [];
    const o = el as Record<string, unknown>;
    if (
      typeof o.phrase !== "string" ||
      typeof o.improvement !== "string" ||
      typeof o.reason !== "string"
    ) {
      return [];
    }
    return [{ phrase: o.phrase, improvement: o.improvement, reason: o.reason }];
  });
}

function parseGrammarFlags(raw: unknown): GrammarFlag[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    if (typeof o.label !== "string" || typeof o.excerpt !== "string" || typeof o.suggestion !== "string") {
      return [];
    }
    return [
      {
        label: o.label,
        excerpt: o.excerpt,
        suggestion: o.suggestion,
        ...(typeof o.correction === "string" ? { correction: o.correction } : {}),
        ...(typeof o.errorType === "string" ? { errorType: o.errorType as GrammarFlag["errorType"] } : {}),
        ...(o.source === "groq" || o.source === "legacy" ? { source: o.source } : {}),
      },
    ];
  });
}

function parseGrammarSnapshot(raw: unknown): QuickAnalysisGrammarSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    summary: typeof o.summary === "string" ? o.summary : null,
    strengths: Array.isArray(o.strengths)
      ? o.strengths.filter((s): s is string => typeof s === "string")
      : [],
    flags: parseGrammarFlags(o.flags),
  };
}

function parseScores(raw: unknown): SixDimensionScores | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const keys = ["pronunciation", "grammar", "fluency", "vocabulary", "filler_words", "pacing"] as const;
  const scores = {} as SixDimensionScores;
  for (const k of keys) {
    if (typeof o[k] !== "number" || !Number.isFinite(o[k])) return null;
    scores[k] = o[k] as number;
  }
  return scores;
}

export function parseQuickAnalysisDisplaySnapshot(raw: unknown): QuickAnalysisDisplaySnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;

  const scores = parseScores(o.scores);
  if (!scores) return null;

  const transcriptSegments = parseTranscriptSegments(o.transcriptSegments);
  const storedWords = parseWordConfidences(o.wordConfidences);
  const phoneticMap = parsePhoneticMap(o.phoneticMap);
  const allWords =
    storedWords.length > 0 ? storedWords : transcriptSegments.flatMap((s) => s.wordConfidences);
  const pronunciationHighlightSource: PronunciationHighlightSource =
    o.pronunciationHighlightSource === "groq" || o.pronunciationHighlightSource === "whisper"
      ? o.pronunciationHighlightSource
      : resolvePronunciationHighlightSource(phoneticMap, flaggedWordsForPhonetics(allWords).length);

  const coachRaw = o.coachSummary;
  if (!coachRaw || typeof coachRaw !== "object") return null;
  const cs = coachRaw as Record<string, unknown>;

  const grammar = parseGrammarSnapshot(o.grammar);

  return {
    version: 1,
    scores,
    transcriptSegments,
    ...(storedWords.length > 0 ? { wordConfidences: storedWords } : {}),
    phoneticMap,
    pronunciationHighlightSource,
    coachSummary: {
      biggestIssue: typeof cs.biggestIssue === "string" ? cs.biggestIssue : null,
      strength: typeof cs.strength === "string" ? cs.strength : null,
      patterns: parsePatterns(cs.patterns),
      acousticPatterns: parseAcousticPatterns(cs.acousticPatterns),
      vocabularySuggestions: parseVocabularySuggestions(cs.vocabularySuggestions),
    },
    ...(grammar ? { grammar } : {}),
  };
}

export function quickAnalysisDisplayFromPersistedJson(
  analysisJson: string | null,
): QuickAnalysisDisplaySnapshot | null {
  if (!analysisJson) return null;
  try {
    const parsed = JSON.parse(analysisJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parseQuickAnalysisDisplaySnapshot((parsed as Record<string, unknown>).quickAnalysisDisplay);
  } catch {
    return null;
  }
}

export function analysisJsonWithQuickAnalysisDisplay(
  analysisJson: string,
  display: QuickAnalysisDisplaySnapshot,
): string {
  const parsed = JSON.parse(analysisJson) as Record<string, unknown>;
  return JSON.stringify({ ...parsed, quickAnalysisDisplay: display });
}
