import "server-only";

import { getOnboardingBaselineForUser } from "@/db/queries/baseline";
import {
  getActiveSubscription,
  getQuickAnalysisUsage,
  recordBillableQuickAnalysisStart,
  recordBillableVocaPracticeSession,
  recordQuickAnalysisRun,
} from "@/db/queries/sqlite/quick-analysis-usage";
import { isAdminUser } from "@/lib/auth/admin";
import type { QuickAnalysisUsageSnapshot } from "@/lib/billing/quick-analysis-usage-types";
import {
  QUICK_ANALYSIS_PAYWALL_MESSAGE,
  SUBSCRIPTION_SESSIONS_EXHAUSTED_MESSAGE,
} from "@/lib/quick-analysis/constants";

export class QuickAnalysisPaywallError extends Error {
  readonly code = "PAYWALL_REQUIRED" as const;
  readonly usage: QuickAnalysisUsageSnapshot;

  constructor(usage: QuickAnalysisUsageSnapshot, message = QUICK_ANALYSIS_PAYWALL_MESSAGE) {
    super(message);
    this.name = "QuickAnalysisPaywallError";
    this.usage = usage;
  }
}

/** Unlimited Quick Analysis for admin accounts (still tracks usedToday for visibility). */
export function adminQuickAnalysisUsage(
  usage: QuickAnalysisUsageSnapshot,
  needsBaseline: boolean,
): QuickAnalysisUsageSnapshot {
  return {
    ...usage,
    canStart: true,
    remainingFree: usage.freeLimit,
    remainingSessions: usage.sessionsLimit,
    subscribed: true,
    isAdmin: true,
    needsBaseline,
  };
}

export async function shouldCountQuickAnalysisRun(userId: string): Promise<boolean> {
  return !(await isAdminUser(userId));
}

export async function getQuickAnalysisUsageForUser(userId: string): Promise<QuickAnalysisUsageSnapshot> {
  const [usage, baseline, admin] = await Promise.all([
    getQuickAnalysisUsage(userId),
    getOnboardingBaselineForUser(userId),
    isAdminUser(userId),
  ]);
  const needsBaseline = baseline == null;
  if (admin) {
    return adminQuickAnalysisUsage(usage, needsBaseline);
  }
  return {
    ...usage,
    needsBaseline,
    canStart: usage.canStart || needsBaseline,
  };
}

export async function assertCanStartQuickAnalysis(userId: string): Promise<QuickAnalysisUsageSnapshot> {
  const usage = await getQuickAnalysisUsageForUser(userId);
  if (!usage.canStart) {
    const message =
      usage.subscribed && usage.remainingSessions === 0
        ? SUBSCRIPTION_SESSIONS_EXHAUSTED_MESSAGE
        : QUICK_ANALYSIS_PAYWALL_MESSAGE;
    throw new QuickAnalysisPaywallError(usage, message);
  }
  return usage;
}

export async function assertCanRecordVocaPractice(userId: string): Promise<QuickAnalysisUsageSnapshot> {
  const usage = await getQuickAnalysisUsageForUser(userId);
  if (usage.isAdmin) return usage;
  if (usage.subscribed && !usage.canStart) {
    throw new QuickAnalysisPaywallError(usage, SUBSCRIPTION_SESSIONS_EXHAUSTED_MESSAGE);
  }
  return usage;
}

export async function recordCompletedQuickAnalysis(userId: string): Promise<void> {
  await recordBillableQuickAnalysisStart(userId);
}

/** First baseline save on the free tier (analyze route only — not subscription sessions). */
export async function recordBaselineQuickAnalysisRun(userId: string): Promise<void> {
  const subscription = await getActiveSubscription(userId);
  if (subscription) return;
  await recordQuickAnalysisRun(userId);
}

export async function recordCompletedVocaPractice(userId: string): Promise<void> {
  await recordBillableVocaPracticeSession(userId);
}
