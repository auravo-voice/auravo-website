import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { onboardingBaseline, practiceSession, sessionScores, userProfile } from "@/db/schema";

export type BaselineBundle = {
  user: typeof userProfile.$inferSelect;
  scores: typeof sessionScores.$inferSelect;
  sessionId: string;
};

/** Owner of any practice row with this id (handoff path; do not use for authorization beyond local MVP). */
export async function getPracticeSessionOwnerId(sessionId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ userId: practiceSession.userId })
    .from(practiceSession)
    .where(eq(practiceSession.id, sessionId))
    .limit(1);
  return rows[0]?.userId ?? null;
}

/** Owner of a saved onboarding assessment row (used when `?session=` is present on the dashboard). */
export async function getUserIdForOnboardingPracticeSession(sessionId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.select().from(practiceSession).where(eq(practiceSession.id, sessionId)).limit(1);
  const row = rows[0];
  if (!row || row.kind !== "onboarding_assessment") return null;
  return row.userId;
}

/**
 * Loads user + scores for this practice session id (does not depend on `onboarding_baseline` row).
 * Use when `?session=` is present so the dashboard matches the assessment you just saved.
 */
export async function getBaselineBundleForPracticeSession(sessionId: string): Promise<BaselineBundle | null> {
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

export async function getOnboardingBaselineForUser(userId: string): Promise<BaselineBundle | null> {
  const db = getDb();
  const base = await db.select().from(onboardingBaseline).where(eq(onboardingBaseline.userId, userId)).limit(1);
  const row = base[0];
  if (!row) return null;
  const scoreRows = await db.select().from(sessionScores).where(eq(sessionScores.sessionId, row.sessionId)).limit(1);
  const score = scoreRows[0];
  if (!score) return null;
  const users = await db.select().from(userProfile).where(eq(userProfile.id, userId)).limit(1);
  const user = users[0];
  if (!user) return null;
  return { user, scores: score, sessionId: row.sessionId };
}
