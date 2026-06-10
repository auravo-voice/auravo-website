import "server-only";

import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { quickAnalysisRun, userSubscription } from "@/db/schema";
import { toLocalDayKey } from "@/db/queries/sqlite/sessions";
import type { QuickAnalysisUsageSnapshot } from "@/lib/billing/quick-analysis-usage-types";
import { QUICK_ANALYSIS_FREE_DAILY_LIMIT } from "@/lib/quick-analysis/constants";

export type { QuickAnalysisUsageSnapshot };

export async function getActiveSubscription(userId: string): Promise<{
  planId: string;
  expiresAt: number;
} | null> {
  const db = getDb();
  const now = Date.now();
  const row = db
    .select()
    .from(userSubscription)
    .where(and(eq(userSubscription.userId, userId), gte(userSubscription.expiresAt, now)))
    .get();
  if (!row) return null;
  return { planId: row.planId, expiresAt: row.expiresAt };
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
  const canStart = subscribed || usedToday < freeLimit;
  return {
    usedToday,
    freeLimit,
    remainingFree,
    subscribed,
    subscriptionExpiresAt: subscription?.expiresAt ?? null,
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

export async function upsertUserSubscription(input: {
  userId: string;
  planId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  expiresAt: number;
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
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
