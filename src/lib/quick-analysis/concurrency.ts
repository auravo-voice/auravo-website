import "server-only";

import { QUICK_ANALYSIS_BUSY_MESSAGE, QUICK_ANALYSIS_MAX_PARALLEL } from "@/lib/quick-analysis/constants";

let active = 0;

function acquireSlot(): void {
  if (active >= QUICK_ANALYSIS_MAX_PARALLEL) {
    throw new QuickAnalysisBusyError();
  }
  active += 1;
}

function releaseSlot(): void {
  active = Math.max(0, active - 1);
}

export class QuickAnalysisBusyError extends Error {
  readonly code = "SERVER_BUSY" as const;

  constructor(message = QUICK_ANALYSIS_BUSY_MESSAGE) {
    super(message);
    this.name = "QuickAnalysisBusyError";
  }
}

/** Runs `fn` only when a global analysis slot is available. */
export async function withQuickAnalysisConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}
