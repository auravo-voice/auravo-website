import { describe, expect, it } from "vitest";

import { adminQuickAnalysisUsage } from "@/lib/billing/quick-analysis-entitlement";
import type { QuickAnalysisUsageSnapshot } from "@/lib/billing/quick-analysis-usage-types";

describe("adminQuickAnalysisUsage", () => {
  const base: QuickAnalysisUsageSnapshot = {
    usedToday: 3,
    freeLimit: 3,
    remainingFree: 0,
    subscribed: false,
    subscriptionExpiresAt: null,
    sessionsLimit: null,
    sessionsUsed: null,
    remainingSessions: null,
    canStart: false,
    needsBaseline: false,
  };

  it("grants unlimited starts for admins", () => {
    const usage = adminQuickAnalysisUsage(base, false);
    expect(usage.canStart).toBe(true);
    expect(usage.isAdmin).toBe(true);
    expect(usage.subscribed).toBe(true);
  });

  it("preserves needsBaseline for first-time admins", () => {
    const usage = adminQuickAnalysisUsage(base, true);
    expect(usage.needsBaseline).toBe(true);
    expect(usage.canStart).toBe(true);
  });
});
