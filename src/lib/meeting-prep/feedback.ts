import "server-only";

/**
 * Agenda-alignment is computed deterministically (not via LLM) so the feedback is reproducible and learners
 * can see exactly which phrases drove it. Lowercase, tokenise, drop stopwords + very short tokens, then compute
 * jaccard-style overlap between agenda terms and rehearsal-transcript terms.
 */
const STOPWORDS = new Set(
  [
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "have",
    "from",
    "into",
    "about",
    "your",
    "their",
    "they",
    "them",
    "are",
    "was",
    "were",
    "will",
    "would",
    "could",
    "should",
    "been",
    "being",
    "but",
    "not",
    "very",
    "much",
    "some",
    "many",
    "any",
    "all",
    "just",
    "what",
    "when",
    "where",
    "which",
    "who",
    "whom",
    "why",
    "how",
    "than",
    "then",
    "also",
    "only",
    "even",
    "more",
    "most",
    "such",
    "like",
    "you",
    "yours",
    "ours",
    "we're",
    "i'm",
    "it's",
  ].map((w) => w.toLowerCase()),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

export type AgendaAlignment = {
  /** 0–100 score: portion of agenda key terms that appear in the rehearsal transcript. */
  score: number;
  /** Up to 6 agenda terms that the learner did NOT mention — surfaced as "remember to cover". */
  missedTerms: string[];
  /** Up to 6 agenda terms the learner mentioned clearly — surfaced as "you covered". */
  hitTerms: string[];
  /** Raw tokens used (for debugging / future highlighting). */
  agendaTermCount: number;
};

export function computeAgendaAlignment(agenda: string, rehearsalTranscript: string): AgendaAlignment {
  const agendaTokens = new Set(tokenize(agenda));
  if (agendaTokens.size === 0) {
    return { score: 0, missedTerms: [], hitTerms: [], agendaTermCount: 0 };
  }
  const transcriptTokens = new Set(tokenize(rehearsalTranscript));
  const hit = [...agendaTokens].filter((t) => transcriptTokens.has(t));
  const missed = [...agendaTokens].filter((t) => !transcriptTokens.has(t));
  const score = Math.round((hit.length / agendaTokens.size) * 100);
  return {
    score,
    missedTerms: missed.slice(0, 6),
    hitTerms: hit.slice(0, 6),
    agendaTermCount: agendaTokens.size,
  };
}

/**
 * Build a tiny structured note (4 short lines) summarising the rehearsal. Deterministic — no LLM — so feedback
 * arrives instantly with zero coach risk. We map our standard heuristic dims onto the spec's "persuasiveness" /
 * "clarity" / "pacing" / "filler words" / "agenda alignment" labels.
 */
export function buildRehearsalCoachNote(input: {
  scores: { pronunciation: number; grammar: number; fluency: number; vocabulary: number; filler_words: number; pacing: number };
  alignment: AgendaAlignment;
  userTurns: number;
  totalDurationMs: number | null;
}): { note: string; topFix: string; strongest: string } {
  const { scores, alignment, userTurns, totalDurationMs } = input;
  // Map heuristics → spec dimensions. Confidence ≈ fluency, clarity ≈ pronunciation, persuasiveness ≈ (clarity + grammar)/2.
  const persuasiveness = Math.round((scores.pronunciation + scores.grammar) / 2);
  const clarity = scores.pronunciation;
  const confidence = scores.fluency;
  const pacing = scores.pacing;
  const fillers = scores.filler_words;

  const entries: { label: string; score: number; hint: string }[] = [
    {
      label: "Clarity",
      score: clarity,
      hint: "Trim a sentence in your opening so it lands cleaner.",
    },
    {
      label: "Confidence tone",
      score: confidence,
      hint: "Pause where you currently hedge ('I think', 'kind of'); silence reads as confidence.",
    },
    {
      label: "Pacing",
      score: pacing,
      hint:
        pacing < 60
          ? "You spoke very fast / very slow — aim for ~140 words a minute next pass."
          : "Pacing felt steady; push to vary it for emphasis at the close.",
    },
    {
      label: "Filler words",
      score: fillers,
      hint: "Replace one 'um/like' with a deliberate half-beat of silence on the next rehearsal.",
    },
    {
      label: "Persuasiveness",
      score: persuasiveness,
      hint: "Lead with the headline before the supporting evidence.",
    },
    {
      label: "Agenda alignment",
      score: alignment.score,
      hint:
        alignment.missedTerms.length > 0
          ? `You did not mention: ${alignment.missedTerms.slice(0, 3).join(", ")}.`
          : "You covered every key agenda term.",
    },
  ];
  entries.sort((a, b) => a.score - b.score);
  const topFix = entries[0]!;
  const strongest = entries[entries.length - 1]!;
  const minutes = totalDurationMs == null ? "—" : (totalDurationMs / 60_000).toFixed(1);
  const note = `${userTurns} ${userTurns === 1 ? "turn" : "turns"} of speech (~${minutes} min). Top fix: ${topFix.label.toLowerCase()} (${topFix.score}) — ${topFix.hint} Strongest: ${strongest.label.toLowerCase()} (${strongest.score}).`;
  return { note, topFix: `${topFix.label}: ${topFix.hint}`, strongest: `${strongest.label}` };
}
