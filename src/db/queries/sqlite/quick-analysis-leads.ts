import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db/client";
import { quickAnalysisLead } from "@/db/schema";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";

export type InsertQuickAnalysisLeadInput = {
  name: string;
  email: string;
  phone: string;
  scores: SixDimensionScores;
};

export async function insertQuickAnalysisLead(input: InsertQuickAnalysisLeadInput): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  const db = getDb();
  await db.insert(quickAnalysisLead).values({
    id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    pronunciation: input.scores.pronunciation,
    grammar: input.scores.grammar,
    fluency: input.scores.fluency,
    vocabulary: input.scores.vocabulary,
    fillerWords: input.scores.filler_words,
    pacing: input.scores.pacing,
    createdAt: now,
  });
  return id;
}
