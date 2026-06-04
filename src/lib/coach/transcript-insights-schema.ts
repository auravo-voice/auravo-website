import { z } from "zod";

function asTrimmedString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

const coachingPatternSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") {
    return { pattern: "", evidence: "", impact: "", fix: "" };
  }
  const row = raw as Record<string, unknown>;
  return {
    pattern: asTrimmedString(row.pattern ?? row.name ?? row.title),
    evidence: asTrimmedString(row.evidence ?? row.example ?? row.quote),
    impact: asTrimmedString(row.impact ?? row.why),
    fix: asTrimmedString(row.fix ?? row.suggestion ?? row.recommendation),
  };
}, z.object({
  pattern: z.string(),
  evidence: z.string(),
  impact: z.string(),
  fix: z.string(),
}));

const acousticPatternSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") {
    return { pattern: "", timestamps: "", fix: "" };
  }
  const row = raw as Record<string, unknown>;
  const ts = row.timestamps ?? row.time_range ?? row.time ?? row.timestamp ?? row.when ?? "";
  return {
    pattern: asTrimmedString(row.pattern ?? row.name),
    timestamps: Array.isArray(ts) ? ts.map((t) => asTrimmedString(t)).filter(Boolean).join(", ") : asTrimmedString(ts),
    fix: asTrimmedString(row.fix ?? row.suggestion),
  };
}, z.object({
  pattern: z.string(),
  timestamps: z.string(),
  fix: z.string(),
}));

export const groqTranscriptInsightsSchema = z.object({
  patterns: z.array(coachingPatternSchema).default([]),
  acoustic_patterns: z.array(acousticPatternSchema).optional(),
  acousticPatterns: z.array(acousticPatternSchema).optional(),
  biggest_issue: z.preprocess((v) => asTrimmedString(v), z.string()).optional(),
  biggestIssue: z.preprocess((v) => asTrimmedString(v), z.string()).optional(),
  strength: z.preprocess((v) => asTrimmedString(v), z.string()).optional(),
});

export type GroqTranscriptInsightsPayload = z.infer<typeof groqTranscriptInsightsSchema>;

/** Coerce alternate Groq key names before Zod parse. */
export function normalizeGroqTranscriptInsightsPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const o = parsed as Record<string, unknown>;
  const acoustic = o.acoustic_patterns ?? o.acousticPatterns;
  return {
    ...o,
    acoustic_patterns: acoustic,
    biggest_issue: o.biggest_issue ?? o.biggestIssue,
  };
}
