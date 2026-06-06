export type QuickAnalysisUsageSnapshot = {
  usedToday: number;
  freeLimit: number;
  remainingFree: number;
  subscribed: boolean;
  subscriptionExpiresAt: number | null;
  canStart: boolean;
};
