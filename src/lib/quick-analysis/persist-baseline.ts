import "server-only";

import {
  createOnboardingBaseline,
  createPracticeSession,
  createSessionScores,
  createSessionTranscript,
} from "@/db/queries/practice-persist";
import { ensureUserProfile } from "@/db/queries/user";
import { writeBaselineHandoffToken } from "@/lib/assessment/baseline-handoff-disk";
import type { CanonicalAnalysis } from "@/lib/analysis/run-analysis";
import { serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";

export type PersistQuickAnalysisBaselineInput = {
  userId: string;
  analysis: CanonicalAnalysis;
  /** Polished display transcript (may differ slightly from analysis.transcript). */
  displayTranscript: string;
  durationMs?: number | null;
  goalId?: string | null;
  segmentCount: number;
};

export async function persistQuickAnalysisBaseline(
  input: PersistQuickAnalysisBaselineInput,
): Promise<string> {
  const { userId, analysis, displayTranscript, durationMs, segmentCount } = input;
  const goalId =
    input.goalId != null && isOnboardingGoalId(input.goalId) ? input.goalId.trim() : null;

  if (goalId != null) {
    await ensureUserProfile(userId, { onboardingGoalId: goalId });
  }

  const segmentsJson = JSON.stringify({
    source: "quick_analysis",
    segmentCount,
  });

  const sessionId = await createPracticeSession({
    userId,
    kind: "onboarding_assessment",
    title: "Quick Analysis",
    durationMs: durationMs ?? null,
    segmentsJson,
  });

  await createSessionTranscript({
    sessionId,
    text: displayTranscript.length > 0 ? displayTranscript : analysis.transcript,
    adapter: analysis.adapter,
    analysisJson: serializeAnalysisForPersistence(analysis),
  });

  await createSessionScores({
    sessionId,
    pronunciation: analysis.scores.pronunciation,
    grammar: analysis.scores.grammar,
    fluency: analysis.scores.fluency,
    vocabulary: analysis.scores.vocabulary,
    fillerWords: analysis.scores.filler_words,
    pacing: analysis.scores.pacing,
  });

  await createOnboardingBaseline(userId, sessionId);

  try {
    writeBaselineHandoffToken(sessionId, userId);
  } catch {
    /* disk handoff is best-effort; SQLite row remains the source of truth */
  }

  return sessionId;
}
