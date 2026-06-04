import { z } from "zod";

const coachingPatternSchema = z.object({
  pattern: z.string(),
  evidence: z.string(),
  impact: z.string(),
  fix: z.string(),
});

const acousticPatternSchema = z.object({
  pattern: z.string(),
  timestamps: z.string(),
  fix: z.string(),
});

export const groqTranscriptInsightsSchema = z.object({
  patterns: z.array(coachingPatternSchema).default([]),
  acoustic_patterns: z.array(acousticPatternSchema).optional(),
  acousticPatterns: z.array(acousticPatternSchema).optional(),
  biggest_issue: z.string().optional(),
  biggestIssue: z.string().optional(),
  strength: z.string().optional(),
});

export type GroqTranscriptInsightsPayload = z.infer<typeof groqTranscriptInsightsSchema>;
