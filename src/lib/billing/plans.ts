export type QuickAnalysisPlanId = "monthly" | "yearly";

export type QuickAnalysisPlan = {
  id: QuickAnalysisPlanId;
  label: string;
  amountPaise: number;
  displayAmount: string;
  durationDays: number;
};

export const QUICK_ANALYSIS_PLANS: Record<QuickAnalysisPlanId, QuickAnalysisPlan> = {
  monthly: {
    id: "monthly",
    label: "Monthly",
    amountPaise: 50_000,
    displayAmount: "₹500",
    durationDays: 30,
  },
  yearly: {
    id: "yearly",
    label: "Yearly",
    amountPaise: 500_000,
    displayAmount: "₹5,000",
    durationDays: 365,
  },
};

export function isQuickAnalysisPlanId(value: string): value is QuickAnalysisPlanId {
  return value === "monthly" || value === "yearly";
}
