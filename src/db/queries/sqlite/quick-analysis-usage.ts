import "server-only";

import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { quickAnalysisRun, userSubscription } from "@/db/schema";
import { toLocalDayKey } from "@/db/queries/sqlite/sessions";
import type { QuickAnalysisUsageSnapshot } from "@/lib/billing/quick-analysis-usage-types";
import {
  isQuickAnalysisPlanId,
  QUICK_ANALYSIS_PLANS,
} from "@/lib/billing/plans";
import { QUICK_ANALYSIS_FREE_DAILY_LIMIT } from "@/lib/quick-analysis/constants";

export type { QuickAnalysisUsageSnapshot };

export type ActiveSubscription = {
  planId: string;
  expiresAt: number;
  sessionsLimit: number;
  sessionsUsed: number;
};

function resolveSessionsLimit(planId: string, storedLimit: number | null): number {
  if (storedLimit != null && storedLimit > 0) return storedLimit;
  if (isQuickAnalysisPlanId(planId)) return QUICK_ANALYSIS_PLANS[planId].sessionLimit;
  return 0;
}

export async function getActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
  const db = getDb();
  const now = Date.now();
  const row = db
    .select()
    .from(userSubscription)
    .where(and(eq(userSubscription.userId, userId), gte(userSubscription.expiresAt, now)))
    .get();
  if (!row) return null;
  const sessionsLimit = resolveSessionsLimit(row.planId, row.sessionsLimit);
  const sessionsUsed = row.sessionsUsed ?? 0;
  return {
    planId: row.planId,
    expiresAt: row.expiresAt,
    sessionsLimit,
    sessionsUsed,
  };
}

export async function countQuickAnalysisRunsToday(userId: string, now = Date.now()): Promise<number> {
  const db = getDb();
  const dayKey = toLocalDayKey(now);
  const rows = db
    .select({ id: quickAnalysisRun.id })
    .from(quickAnalysisRun)
    .where(and(eq(quickAnalysisRun.userId, userId), eq(quickAnalysisRun.dayKey, dayKey)))
    .all();
  return rows.length;
}

export async function getQuickAnalysisUsage(userId: string): Promise<QuickAnalysisUsageSnapshot> {
  const subscription = await getActiveSubscription(userId);
  const usedToday = await countQuickAnalysisRunsToday(userId);
  const freeLimit = QUICK_ANALYSIS_FREE_DAILY_LIMIT;
  const remainingFree = Math.max(0, freeLimit - usedToday);
  const subscribed = subscription != null;
  const sessionsLimit = subscription?.sessionsLimit ?? null;
  const sessionsUsed = subscription?.sessionsUsed ?? null;
  const remainingSessions =
    subscription != null ? Math.max(0, subscription.sessionsLimit - subscription.sessionsUsed) : null;
  const canStart = subscribed
    ? (remainingSessions ?? 0) > 0
    : usedToday < freeLimit;
  return {
    usedToday,
    freeLimit,
    remainingFree,
    subscribed,
    subscriptionExpiresAt: subscription?.expiresAt ?? null,
    sessionsLimit,
    sessionsUsed,
    remainingSessions,
    canStart,
    needsBaseline: false,
  };
}

export async function recordQuickAnalysisRun(userId: string, now = Date.now()): Promise<void> {
  const db = getDb();
  db.insert(quickAnalysisRun)
    .values({
      id: crypto.randomUUID(),
      userId,
      dayKey: toLocalDayKey(now),
      createdAt: now,
    })
    .run();
}

/** Reserve one coach session when starting Quick Analysis (non-baseline). */
export async function recordBillableQuickAnalysisStart(userId: string, now = Date.now()): Promise<void> {
  const subscription = await getActiveSubscription(userId);
  if (subscription) {
    await incrementSubscriptionSessionsUsed(userId, now);
    return;
  }
  await recordQuickAnalysisRun(userId, now);
}

/** Count a completed Voca practice exercise against the subscription pool. */
export async function recordBillableVocaPracticeSession(userId: string, now = Date.now()): Promise<void> {
  const subscription = await getActiveSubscription(userId);
  if (!subscription) return;
  await incrementSubscriptionSessionsUsed(userId, now);
}

export async function incrementSubscriptionSessionsUsed(userId: string, now = Date.now()): Promise<void> {
  const db = getDb();
  const row = db.select().from(userSubscription).where(eq(userSubscription.userId, userId)).get();
  if (!row) return;
  db.update(userSubscription)
    .set({
      sessionsUsed: (row.sessionsUsed ?? 0) + 1,
      updatedAt: now,
    })
    .where(eq(userSubscription.userId, userId))
    .run();
}

export async function upsertUserSubscription(input: {
  userId: string;
  planId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  expiresAt: number;
  sessionsLimit: number;
  now?: number;
}): Promise<void> {
  const db = getDb();
  const now = input.now ?? Date.now();
  const existing = db.select().from(userSubscription).where(eq(userSubscription.userId, input.userId)).get();
  if (existing) {
    const expiresAt = Math.max(existing.expiresAt, input.expiresAt);
    db.update(userSubscription)
      .set({
        planId: input.planId,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        expiresAt,
        sessionsLimit: input.sessionsLimit,
        sessionsUsed: 0,
        updatedAt: now,
      })
      .where(eq(userSubscription.userId, input.userId))
      .run();
    return;
  }
  db.insert(userSubscription)
    .values({
      userId: input.userId,
      planId: input.planId,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      expiresAt: input.expiresAt,
      sessionsLimit: input.sessionsLimit,
      sessionsUsed: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
