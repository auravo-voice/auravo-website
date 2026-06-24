export type QuickAnalysisUsageSnapshot = {
  usedToday: number;
  freeLimit: number;
  remainingFree: number;
  subscribed: boolean;
  subscriptionExpiresAt: number | null;
  /** Included coach sessions (Quick Analysis + Voca) when subscribed. */
  sessionsLimit: number | null;
  sessionsUsed: number | null;
  remainingSessions: number | null;
  canStart: boolean;
  /** True when the learner has not saved a full-path baseline yet. */
  needsBaseline: boolean;
  /** Admins bypass daily limits and paywall. */
  isAdmin?: boolean;
};
