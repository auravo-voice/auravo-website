import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  onboardingBaseline,
  practiceSession,
  sessionScores,
  userProfile,
} from "@/db/schema";
import type { SessionScoresRow, UserProfileRow } from "@/db/types";

export type BaselineBundle = {
  user: UserProfileRow;
  scores: SessionScoresRow;
  sessionId: string;
};

export async function getPracticeSessionOwnerId(sessionId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ userId: practiceSession.userId })
    .from(practiceSession)
    .where(eq(practiceSession.id, sessionId))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export async function getUserIdForOnboardingPracticeSession(sessionId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.select().from(practiceSession).where(eq(practiceSession.id, sessionId)).limit(1);
  const row = rows[0];
  if (!row || row.kind !== "onboarding_assessment") return null;
  return row.userId;
}

export async function getBaselineBundleForPracticeSession(
  sessionId: string,
): Promise<BaselineBundle | null> {
  const db = getDb();
  const pr = await db.select().from(practiceSession).where(eq(practiceSession.id, sessionId)).limit(1);
  const ps = pr[0];
  if (!ps || ps.kind !== "onboarding_assessment") return null;
  const sr = await db.select().from(sessionScores).where(eq(sessionScores.sessionId, sessionId)).limit(1);
  const score = sr[0];
  if (!score) return null;
  const ur = await db.select().from(userProfile).where(eq(userProfile.id, ps.userId)).limit(1);
  const user = ur[0];
  if (!user) return null;
  return { user, scores: score, sessionId };
}

async function latestOnboardingAssessmentSessionId(userId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: practiceSession.id })
    .from(practiceSession)
    .innerJoin(sessionScores, eq(sessionScores.sessionId, practiceSession.id))
    .where(
      and(eq(practiceSession.userId, userId), eq(practiceSession.kind, "onboarding_assessment")),
    )
    .orderBy(desc(practiceSession.createdAt))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function repairOnboardingBaselineLink(userId: string, sessionId: string): Promise<void> {
  const db = getDb();
  const existing = await db
    .select()
    .from(onboardingBaseline)
    .where(eq(onboardingBaseline.userId, userId))
    .limit(1);
  if (existing[0]) {
    db.update(onboardingBaseline)
      .set({ sessionId })
      .where(eq(onboardingBaseline.userId, userId))
      .run();
    return;
  }
  db.insert(onboardingBaseline)
    .values({ userId, sessionId, createdAt: Date.now() })
    .run();
}

/**
 * Primary: `onboarding_baseline` row. Fallback: newest scored `onboarding_assessment` session.
 */
export async function getOnboardingBaselineForUser(userId: string): Promise<BaselineBundle | null> {
  const db = getDb();
  const base = await db
    .select()
    .from(onboardingBaseline)
    .where(eq(onboardingBaseline.userId, userId))
    .limit(1);
  const linkedSessionId = base[0]?.sessionId ?? null;

  if (linkedSessionId) {
    const fromLink = await getBaselineBundleForPracticeSession(linkedSessionId);
    if (fromLink && fromLink.user.id === userId) return fromLink;
  }

  const latestSessionId = await latestOnboardingAssessmentSessionId(userId);
  if (!latestSessionId) return null;

  const fromSession = await getBaselineBundleForPracticeSession(latestSessionId);
  if (!fromSession || fromSession.user.id !== userId) return null;

  await repairOnboardingBaselineLink(userId, latestSessionId);
  return fromSession;
}
