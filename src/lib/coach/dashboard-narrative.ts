import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { ONBOARDING_GOALS } from "@/data/onboarding-goals";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { ollamaChatStructured } from "@/lib/ollama/chat-json";
import { getCoachOllamaTimeoutMs } from "@/lib/ollama/env";

const narrativeSchema = z.object({
  coachBlurb: z.string().max(500),
  todaySessionTitle: z.string().max(200),
  todaySessionFocus: z.string().max(120),
});

const SYSTEM = `You are Auravo's Voca coach. Output JSON only (no markdown).
Fields: coachBlurb (one short encouraging sentence), todaySessionTitle (practice session title), todaySessionFocus (one skill phrase).
Rules:
- Do NOT output or invent any numeric scores or percentages.
- Do NOT contradict the provided measured scores; speak qualitatively only.
- Keep titles actionable for spoken practice.`;

function weakestKey(scores: SixDimensionScores): keyof SixDimensionScores {
  const keys = Object.keys(scores) as (keyof SixDimensionScores)[];
  return keys.reduce((a, b) => (scores[a] <= scores[b] ? a : b));
}

function templateNarrative(input: {
  scores: SixDimensionScores;
  displayName: string;
  goalLabel?: string;
}): z.infer<typeof narrativeSchema> {
  const w = weakestKey(input.scores);
  const focusMap: Record<keyof SixDimensionScores, string> = {
    pronunciation: "clearer consonants and word stress",
    grammar: "tighter sentence structure under slight pressure",
    fluency: "smoother flow between ideas when speaking aloud",
    vocabulary: "more precise word choice in answers",
    filler_words: "fewer filler words in structured answers",
    pacing: "steady pacing with intentional pauses",
  };
  return {
    coachBlurb: input.goalLabel
      ? `Hi ${input.displayName}—your baseline is saved. We will lean into ${focusMap[w]} while you work toward ${input.goalLabel}.`
      : `Hi ${input.displayName}—your baseline is saved. Next up: ${focusMap[w]} in short voice blocks.`,
    todaySessionTitle: "Voice baseline: short structured answers",
    todaySessionFocus: focusMap[w],
  };
}

export type DashboardNarrativeInput = {
  scores: SixDimensionScores;
  displayName: string;
  onboardingGoalId?: string | null;
};

async function computeDashboardCoachingNarrative(input: DashboardNarrativeInput): Promise<{
  data: z.infer<typeof narrativeSchema>;
  warning: string | null;
}> {
  const goalLabel =
    input.onboardingGoalId && isOnboardingGoalId(input.onboardingGoalId)
      ? ONBOARDING_GOALS.find((g) => g.id === input.onboardingGoalId)?.title
      : undefined;

  const userPayload = JSON.stringify({
    displayName: input.displayName,
    measuredScores: input.scores,
    goalLabel: goalLabel ?? null,
  });

  try {
    const data = await ollamaChatStructured({
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Learner context (JSON). Write copy only—never restate numbers as new scores.\n${userPayload}`,
        },
      ],
      schema: narrativeSchema,
      numPredict: 320,
      timeoutMs: getCoachOllamaTimeoutMs(),
    });
    return { data, warning: null };
  } catch {
    return {
      data: templateNarrative({ ...input, goalLabel }),
      warning: "Preparing your personalized coaching insights…",
    };
  }
}

const cacheKeyForNarrative = (input: DashboardNarrativeInput) =>
  JSON.stringify({
    scores: input.scores,
    displayName: input.displayName,
    goal: input.onboardingGoalId ?? null,
  });

/**
 * Per-request dedupe (React `cache`) + cross-request memo (`unstable_cache`) so Home navigation stays fast when
 * scores and profile have not changed.
 */
export const getDashboardCoachingNarrative = cache(async (input: DashboardNarrativeInput) => {
  const key = cacheKeyForNarrative(input);
  return unstable_cache(
    async () => computeDashboardCoachingNarrative(input),
    ["dashboard-coaching-narrative", key],
    { revalidate: 1800 },
  )();
});
