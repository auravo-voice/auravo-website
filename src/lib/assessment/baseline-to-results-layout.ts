import type {
  QuickAnalysisTranscriptSegment,
  QuickAnalysisWordConfidence,
} from "@/app/quick-analysis/pronunciation-types";
import {
  distributeWordConfidencesToSegments,
  ensureSegmentWordHighlights,
  wordConfidencesFromTimings,
} from "@/lib/quick-analysis/word-confidences";
import type { PronunciationHighlightSource } from "@/app/quick-analysis/lib/word-highlight";
import { derivePronunciationHighlightSource } from "@/app/quick-analysis/lib/word-highlight";
import { quickAnalysisDisplayFromPersistedJson } from "@/lib/quick-analysis/display-snapshot";
import type { QuickAnalysisGrammarSnapshot } from "@/lib/quick-analysis/grammar-snapshot";
import type { AssessmentBaselinePayload } from "@/lib/assessment/baseline-results-payload";
import type { PronunciationTip } from "@/lib/assessment/baseline-analysis-types";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import type { VocabularySuggestion } from "@/lib/analysis/vocabulary-analysis";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";
import type { RadarDimension } from "@/lib/coach/schemas";
import type { WordTiming } from "@/lib/transcription/types";

export type BaselineAnalysisLayoutInput = {
  scores: SixDimensionScores;
  transcriptSegments: QuickAnalysisTranscriptSegment[];
  phoneticMap: Record<string, string>;
  pronunciationHighlightSource: PronunciationHighlightSource;
  coachSummary: {
    biggestIssue: string | null;
    strength: string | null;
    patterns: CoachingPattern[];
    acousticPatterns: AcousticCoachingPattern[];
    vocabularySuggestions: VocabularySuggestion[];
  } | null;
  grammar: QuickAnalysisGrammarSnapshot | null;
  subtitle: string;
  /** True when replaying a stored Quick Analysis display snapshot. */
  fromQuickAnalysisSnapshot: boolean;
};

function parsePersistedAnalysis(analysisJson: string | null): Record<string, unknown> {
  if (!analysisJson) return {};
  try {
    const j = JSON.parse(analysisJson) as unknown;
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function wordTimingsFromPersisted(parsed: Record<string, unknown>): WordTiming[] | undefined {
  const voice = parsed.voiceAnalysis;
  if (!voice || typeof voice !== "object") return undefined;
  const raw = (voice as Record<string, unknown>).wordTimings;
  if (!Array.isArray(raw)) return undefined;
  const timings: WordTiming[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const w = el as Record<string, unknown>;
    if (typeof w.word !== "string" || typeof w.start !== "number" || typeof w.end !== "number") continue;
    timings.push({
      word: w.word,
      start: w.start,
      end: w.end,
      probability: typeof w.probability === "number" ? w.probability : 0,
    });
  }
  return timings.length > 0 ? timings : undefined;
}

function vocabularySuggestionsFromPersisted(parsed: Record<string, unknown>): VocabularySuggestion[] {
  const coach = parsed.coachSummary;
  if (coach && typeof coach === "object") {
    const raw = (coach as Record<string, unknown>).vocabularySuggestions;
    if (Array.isArray(raw)) {
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
  }
  const vocab = parsed.vocabularyAnalysis;
  if (!vocab || typeof vocab !== "object") return [];
  const suggestions = (vocab as Record<string, unknown>).suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.flatMap((el) => {
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

function phoneticMapFromTips(tips: PronunciationTip[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tip of tips) {
    const heard = tip.heardAs.trim();
    if (!heard || !tip.tip.trim()) continue;
    out[heard] = tip.tip.trim();
    const clean = heard.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (clean) out[clean] = tip.tip.trim();
  }
  return out;
}

function scoresFromDimensions(dimensions: RadarDimension[]): SixDimensionScores {
  const byKey = new Map(dimensions.map((d) => [d.key, d.score]));
  return {
    pronunciation: byKey.get("pronunciation") ?? 0,
    grammar: byKey.get("grammar") ?? 0,
    fluency: byKey.get("fluency") ?? 0,
    vocabulary: byKey.get("vocabulary") ?? 0,
    filler_words: byKey.get("filler_words") ?? 0,
    pacing: byKey.get("pacing") ?? 0,
  };
}

function transcriptSegmentsForBaseline(
  results: AssessmentBaselinePayload,
  wordTimings?: WordTiming[],
): QuickAnalysisTranscriptSegment[] {
  const transcript = results.transcript.trim();
  const wordConfidences = wordConfidencesFromTimings(wordTimings);

  if (transcript && wordConfidences.length > 0) {
    return distributeWordConfidencesToSegments(
      [
        {
          label: "Your responses",
          transcript,
          wordConfidences,
        },
      ],
      wordConfidences,
    );
  }

  const spoken =
    results.segmentTranscripts?.filter((seg) => seg.transcript.trim().length > 0) ?? [];

  if (spoken.length > 0) {
    const segments = spoken.map((seg) => ({
      label: seg.label,
      transcript: seg.transcript,
      wordConfidences: [] as QuickAnalysisWordConfidence[],
    }));
    return distributeWordConfidencesToSegments(segments, wordConfidences);
  }

  if (!transcript) return [];

  return [
    {
      label: "Your responses",
      transcript,
      wordConfidences: [],
    },
  ];
}

function grammarFromBaselineAnalysis(
  analysis: AssessmentBaselinePayload["analysis"],
): QuickAnalysisGrammarSnapshot | null {
  const summary = analysis.grammarAnalysis?.summary?.trim() || null;
  const strengths = analysis.grammarAnalysis?.strengths ?? [];
  const flags = analysis.grammarFlags ?? [];
  if (!summary && strengths.length === 0 && flags.length === 0) return null;
  return { summary, strengths, flags };
}

export function buildBaselineLayoutInput(
  results: AssessmentBaselinePayload,
  analysisJson: string | null,
): BaselineAnalysisLayoutInput {
  const snapshot = quickAnalysisDisplayFromPersistedJson(analysisJson);
  if (snapshot) {
    const parsed = parsePersistedAnalysis(analysisJson);
    const allWords =
      snapshot.wordConfidences?.length
        ? snapshot.wordConfidences
        : wordConfidencesFromTimings(wordTimingsFromPersisted(parsed));
    const transcriptSegments = ensureSegmentWordHighlights(snapshot.transcriptSegments, allWords);
    return {
      scores: snapshot.scores,
      transcriptSegments,
      phoneticMap: snapshot.phoneticMap,
      pronunciationHighlightSource: snapshot.pronunciationHighlightSource,
      coachSummary: snapshot.coachSummary,
      grammar: snapshot.grammar ?? null,
      subtitle: "Your English snapshot",
      fromQuickAnalysisSnapshot: true,
    };
  }

  const parsed = parsePersistedAnalysis(analysisJson);
  const wordTimings = wordTimingsFromPersisted(parsed);
  const vocabularySuggestions = vocabularySuggestionsFromPersisted(parsed);

  const coach = results.coachSummary;
  const subtitle = results.goalLabel
    ? `Your English snapshot · ${results.goalLabel}`
    : "Your English snapshot";

  const transcriptSegments = transcriptSegmentsForBaseline(results, wordTimings);
  const phoneticMap = phoneticMapFromTips(results.analysis.pronunciationTips);
  const allWords = transcriptSegments.flatMap((s) => s.wordConfidences);

  return {
    scores: scoresFromDimensions(results.dimensions),
    transcriptSegments,
    phoneticMap,
    pronunciationHighlightSource: derivePronunciationHighlightSource(phoneticMap, allWords),
    coachSummary: coach
      ? {
          biggestIssue: coach.biggestIssue ?? null,
          strength: coach.strength ?? null,
          patterns: coach.patterns ?? [],
          acousticPatterns: coach.acousticPatterns ?? [],
          vocabularySuggestions,
        }
      : vocabularySuggestions.length > 0
        ? {
            biggestIssue: null,
            strength: null,
            patterns: [],
            acousticPatterns: [],
            vocabularySuggestions,
          }
        : null,
    grammar: grammarFromBaselineAnalysis(results.analysis),
    subtitle,
    fromQuickAnalysisSnapshot: false,
  };
}
