import type { PronunciationTip } from "@/lib/assessment/baseline-analysis-types";
import type { RadarDimension } from "@/lib/coach/schemas";
import { DIMENSION_LABELS, type DimensionKey } from "@/lib/assessment/dimensions-from-scores";

/** User-facing labels on the assessment results screen (same as scoring pipeline). */
export const ASSESSMENT_DIMENSION_LABEL = DIMENSION_LABELS;

const COMMON_WORDS = new Set(
  [
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "is", "was", "are", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may",
    "might", "must", "can", "this", "that", "these", "those", "i", "we", "you", "he", "she", "it", "they",
    "what", "which", "who", "when", "where", "why", "how", "see", "just", "like", "um", "uh", "okay", "ok",
    "yes", "no", "so", "then", "there", "here", "now", "with", "from", "as", "by", "if", "about", "into",
    "through", "over", "under", "again", "than", "also", "only", "own", "same", "some", "any", "each", "every",
    "both", "few", "more", "most", "other", "such", "very", "say", "get", "go", "make", "know", "think", "take",
    "come", "use", "work", "want", "look", "find", "give", "tell", "put", "mean", "keep", "let", "begin", "seem",
    "help", "show", "hear", "play", "run", "move", "live", "believe", "hold", "bring", "happen", "write", "provide",
    "sit", "stand", "fall", "grow", "open", "walk", "win", "offer", "remember", "love", "consider", "appear", "buy",
    "wait", "serve", "send", "expect", "build", "stay", "lead", "pass", "raise", "meet", "cost", "set", "learn",
    "change", "increase", "leave", "stop", "create", "speak", "read", "spend", "really", "well", "even", "much",
    "still", "already", "ever", "never", "too", "not", "all", "one", "two", "first", "last", "new", "old",
  ].map((w) => w.toLowerCase()),
);

const BRAND_BLOCKLIST = new Set(["auravo", "cursor", "openai", "chatgpt", "github"]);

function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9'-]+|[^a-z0-9'-]+$/gi, "");
}

function isNonsenseToken(w: string): boolean {
  if (w.length < 4) return true;
  if (!/[aeiouy]/i.test(w)) return true;
  if (/^\d+$/.test(w)) return true;
  if (/^[^a-z]*$/i.test(w)) return true;
  if (BRAND_BLOCKLIST.has(w)) return true;
  if (COMMON_WORDS.has(w)) return true;
  return false;
}

export type ClarityCheckpoint = {
  word: string;
  coachLine: string;
  practiceDrill: string;
  exampleUrl: string;
};

function chunkHintForWord(w: string): string | null {
  const plain = w.toLowerCase().replace(/[^a-z]/g, "");
  if (plain.length < 7) return null;
  const n = plain.length <= 9 ? 2 : 3;
  const partLen = Math.max(2, Math.ceil(plain.length / n));
  const parts: string[] = [];
  for (let i = 0; i < plain.length; i += partLen) {
    parts.push(plain.slice(i, i + partLen));
  }
  if (parts.length < 2) return null;
  return parts.join("-");
}

/** Pick a small set of coach-friendly clarity items; no probabilities shown. */
export function buildClarityCheckpoints(tips: PronunciationTip[], max = 8): ClarityCheckpoint[] {
  const out: ClarityCheckpoint[] = [];
  const seen = new Set<string>();
  for (const t of tips) {
    const w = normalizeWord(t.heardAs);
    if (!w || seen.has(w)) continue;
    if (isNonsenseToken(w)) continue;
    seen.add(w);
    const display = t.heardAs.trim();
    const hyphen = chunkHintForWord(display);
    const coachLine = hyphen
      ? `Try shaping it in parts: ${hyphen}. Keep the middle consonants crisp, then smooth the whole word.`
      : "This word came through less clearly in your recording — a few slow reps usually make it land more cleanly.";
    out.push({
      word: display,
      coachLine,
      practiceDrill: microDrillForWord(w),
      exampleUrl: `https://www.merriam-webster.com/dictionary/${encodeURIComponent(w)}`,
    });
    if (out.length >= max) break;
  }
  return out;
}

function microDrillForWord(w: string): string {
  if (w.length <= 5) {
    return `Practice slowly: say “${w}” three times at half speed, then once at your natural pace.`;
  }
  const mid = Math.max(2, Math.floor(w.length / 3));
  const a = w.slice(0, mid);
  const b = w.slice(mid, mid * 2);
  const c = w.slice(mid * 2);
  return `Practice slowly: “${a}” · “${b}” · “${c}” — then blend into one smooth “${w}”.`;
}

export type CoachSummaryShape = {
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  recommendationRationale?: string;
};

function labelForDimensionKey(key: string): string {
  if (key in ASSESSMENT_DIMENSION_LABEL) {
    return ASSESSMENT_DIMENSION_LABEL[key as DimensionKey];
  }
  return key;
}

export function executiveHighlights(dimensions: RadarDimension[]): {
  strongest: { label: string; score: number } | null;
  opportunity: { label: string; score: number } | null;
  ordered: RadarDimension[];
} {
  const ordered = [...dimensions].sort((a, b) => b.score - a.score);
  const strongest = ordered[0] ?? null;
  const opportunity = ordered.length ? ordered[ordered.length - 1]! : null;
  return {
    strongest: strongest ? { label: strongest.label, score: strongest.score } : null,
    opportunity: opportunity ? { label: opportunity.label, score: opportunity.score } : null,
    ordered,
  };
}

function dimensionsKeyFromLabel(label: string): DimensionKey | null {
  const e = Object.entries(ASSESSMENT_DIMENSION_LABEL) as [DimensionKey, string][];
  for (const [key, l] of e) {
    if (l === label) return key;
  }
  return null;
}

/** First focus line for executive summary when coach copy is thin. */
export function firstTrainingFocusLine(
  opportunity: { label: string; score: number } | null,
  improvementAreas: string[] | undefined,
): string {
  if (improvementAreas && improvementAreas.length > 0) {
    return improvementAreas[0]!.slice(0, 200);
  }
  if (!opportunity) return "Your first week of practice will match these results to your goals.";
  const k = dimensionsKeyFromLabel(opportunity.label);
  if (k === "fluency" || k === "pacing") return "Smooth pacing and fewer hesitations — we’ll start there.";
  if (k === "pronunciation") return "Clearer articulation and steadier delivery — we’ll start there.";
  if (k === "grammar" || k === "vocabulary") return "Sharper structure and word choice — we’ll start there.";
  if (k === "filler_words") return "Cleaner, more concise phrasing — we’ll start there.";
  return `We’ll lean into ${opportunity.label.toLowerCase()} in your opening sessions.`;
}

/** Coach plan body: prefer LLM summary + lists; fallback to dimension-based copy. */
export function buildCoachPlanNarrative(
  dimensions: RadarDimension[],
  coach: CoachSummaryShape | undefined,
  highlights: ReturnType<typeof executiveHighlights>,
): string {
  if (coach?.summary && coach.summary.trim().length > 20) {
    const parts = [coach.summary.trim()];
    if (coach.strengths?.length) {
      parts.push(`Strengths we noticed: ${coach.strengths.slice(0, 3).join("; ")}`);
    }
    if (coach.improvementAreas?.length) {
      parts.push(`Opportunities to grow: ${coach.improvementAreas.slice(0, 3).join("; ")}`);
    }
    parts.push(
      "Your daily practice will be tailored from this baseline so each session builds on what you need most.",
    );
    return parts.join(" ");
  }
  const { strongest, opportunity, ordered } = highlights;
  const weak = ordered.slice(-2).map((d) => d.label.toLowerCase());
  const strong = ordered.slice(0, 2).map((d) => d.label.toLowerCase());
  const s1 = strongest ? strongest.label : "several skills";
  return `Your strongest areas included ${strong.join(" and ") || s1.toLowerCase()}. The biggest opportunities are ${weak.join(" and ") || (opportunity ? opportunity.label.toLowerCase() : "your next focus areas")}. Your first week will focus on smoother delivery, clearer articulation, and pacing you can sustain — all personalized from this baseline.`;
}

export function explanationForDimension(
  key: string,
  voiceExplanations: Partial<Record<DimensionKey, string>> | undefined,
  score: number,
): string {
  const human = voiceExplanations?.[key as DimensionKey]?.trim();
  if (human && human.length > 12) return human;
  const label = labelForDimensionKey(key);
  if (score >= 78) return `${label} looks solid — keep reinforcing this habit in conversation.`;
  if (score >= 62) return `${label} is in a good range with room to polish — small reps will move the needle.`;
  return `${label} has the most headroom right now — we'll give it extra attention in your plan.`;
}
