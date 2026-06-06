import "server-only";

import {
  getQuickAnalysisUsage,
  recordQuickAnalysisRun,
} from "@/db/queries/sqlite/quick-analysis-usage";
import type { QuickAnalysisUsageSnapshot } from "@/lib/billing/quick-analysis-usage-types";
import { QUICK_ANALYSIS_PAYWALL_MESSAGE } from "@/lib/quick-analysis/constants";

export class QuickAnalysisPaywallError extends Error {
  readonly code = "PAYWALL_REQUIRED" as const;
  readonly usage: QuickAnalysisUsageSnapshot;

  constructor(usage: QuickAnalysisUsageSnapshot, message = QUICK_ANALYSIS_PAYWALL_MESSAGE) {
    super(message);
    this.name = "QuickAnalysisPaywallError";
    this.usage = usage;
  }
}

export async function assertCanStartQuickAnalysis(userId: string): Promise<QuickAnalysisUsageSnapshot> {
  const usage = await getQuickAnalysisUsage(userId);
  if (!usage.canStart) {
    throw new QuickAnalysisPaywallError(usage);
  }
  return usage;
}

export async function recordCompletedQuickAnalysis(userId: string): Promise<void> {
  await recordQuickAnalysisRun(userId);
}
