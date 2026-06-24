export type QuickAnalysisPlanId = "monthly" | "yearly";

export type QuickAnalysisPlan = {
  id: QuickAnalysisPlanId;
  label: string;
  amountPaise: number;
  displayAmount: string;
  durationDays: number;
  /** Combined Quick Analysis + Voca coach sessions included in the plan. */
  sessionLimit: number;
};

export const QUICK_ANALYSIS_PLANS: Record<QuickAnalysisPlanId, QuickAnalysisPlan> = {
  monthly: {
    id: "monthly",
    label: "Monthly",
    amountPaise: 70_000,
    displayAmount: "₹700",
    durationDays: 30,
    sessionLimit: 50,
  },
  yearly: {
    id: "yearly",
    label: "Yearly",
    amountPaise: 700_000,
    displayAmount: "₹7,000",
    durationDays: 365,
    sessionLimit: 500,
  },
};

export function isQuickAnalysisPlanId(value: string): value is QuickAnalysisPlanId {
  return value === "monthly" || value === "yearly";
}
