import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import {
  getBaselineBundleForPracticeSession,
  getOnboardingBaselineForUser,
  getPracticeSessionOwnerId,
} from "@/db/queries/baseline";
import { PB } from "@/db/collections";
import { getDb } from "@/db/client";
import { sessionTranscript } from "@/db/schema";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import type { AssessmentBaselinePayload } from "@/lib/assessment/baseline-results-payload";
import { buildBaselineLayoutInput } from "@/lib/assessment/baseline-to-results-layout";
import { buildAssessmentPayloadFromPersisted } from "@/lib/assessment/parse-baseline-payload";
import { buildSegmentTranscriptRows } from "@/lib/assessment/segment-transcripts";
import { listSessionSegments } from "@/db/queries/baseline-segments";
import { getOnboardingGoalLabel, isOnboardingGoalId } from "@/lib/coach/dashboard";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { isPocketBaseStorage } from "@/lib/storage/env";
import { getServerPocketBase } from "@/lib/pocketbase/server";

async function fetchSessionTranscript(sessionId: string): Promise<{ transcript: string; analysisJson: string | null }> {
  if (isPocketBaseStorage()) {
    const pb = await getServerPocketBase();
    try {
      const t = await pb.collection(PB.sessionTranscripts).getFirstListItem(`session = "${sessionId}"`);
      return {
        transcript: typeof t.text === "string" ? t.text : "",
        analysisJson: typeof t.analysis_json === "string" ? t.analysis_json : null,
      };
    } catch {
      return { transcript: "", analysisJson: null };
    }
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(sessionTranscript)
    .where(eq(sessionTranscript.sessionId, sessionId))
    .limit(1);
  const t = rows[0];
  if (!t) return { transcript: "", analysisJson: null };
  return {
    transcript: t.text,
    analysisJson: t.analysisJson ?? null,
  };
}

async function loadBaselineResultsForUserUncached(
  userId: string,
  sessionId?: string | null,
): Promise<{ results: AssessmentBaselinePayload; layout: ReturnType<typeof buildBaselineLayoutInput> } | null> {
  let bundle =
    sessionId != null && sessionId.trim() !== ""
      ? await getBaselineBundleForPracticeSession(sessionId.trim())
      : null;

  if (bundle && bundle.user.id !== userId) return null;
  if (!bundle) bundle = await getOnboardingBaselineForUser(userId);
  if (!bundle || bundle.user.id !== userId) return null;

  const { transcript, analysisJson } = await fetchSessionTranscript(bundle.sessionId);

  const scores: SixDimensionScores = {
    pronunciation: bundle.scores.pronunciation,
    grammar: bundle.scores.grammar,
    fluency: bundle.scores.fluency,
    vocabulary: bundle.scores.vocabulary,
    filler_words: bundle.scores.fillerWords,
    pacing: bundle.scores.pacing,
  };
  const dimensions = scoresToRadarDimensions(scores);

  const storedGoalId = isOnboardingGoalId(bundle.user.onboardingGoalId ?? undefined)
    ? bundle.user.onboardingGoalId
    : undefined;
  const goalLabel = getOnboardingGoalLabel(storedGoalId) ?? null;

  const segmentRows = await listSessionSegments(bundle.sessionId);
  const segmentTranscripts = buildSegmentTranscriptRows(segmentRows);

  const results = buildAssessmentPayloadFromPersisted({
    userId: bundle.user.id,
    sessionId: bundle.sessionId,
    transcript,
    segmentTranscripts,
    dimensions,
    goalLabel,
    analysisJson,
  });

  return {
    results,
    layout: buildBaselineLayoutInput(results, analysisJson),
  };
}

/** Cached across navigations; baseline data changes rarely after assessment. */
export const loadBaselineResultsForUser = cache(async (userId: string, sessionId?: string | null) => {
  const sid = sessionId?.trim() || "latest";
  return unstable_cache(
    () => loadBaselineResultsForUserUncached(userId, sessionId),
    ["baseline-results-v3", userId, sid],
    { revalidate: 120 },
  )();
});

/** Load baseline results when only a session id is known (checks ownership). */
export async function loadBaselineResultsForSession(
  sessionId: string,
  expectedUserId?: string | null,
): Promise<{ results: AssessmentBaselinePayload; layout: ReturnType<typeof buildBaselineLayoutInput> } | null> {
  const ownerId = await getPracticeSessionOwnerId(sessionId);
  if (!ownerId) return null;
  if (expectedUserId && ownerId !== expectedUserId) return null;
  return loadBaselineResultsForUser(ownerId, sessionId);
}
