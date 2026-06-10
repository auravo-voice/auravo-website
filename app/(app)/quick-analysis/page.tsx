import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { QuickAnalysisFlow } from "@/app/quick-analysis/quick-analysis-flow";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";

export const metadata: Metadata = {
  title: "Quick Analysis — Auravo",
  description: "Your spoken baseline — a short voice-first snapshot with Voca.",
};

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ goal?: string | string[] }> };

export default async function QuickAnalysisPage({ searchParams }: PageProps) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login?redirect=/quick-analysis");
  }

  const sp = searchParams ? await searchParams : {};
  const raw = sp.goal;
  const fromQuery = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const goalId = isOnboardingGoalId(fromQuery) ? fromQuery : null;

  return <QuickAnalysisFlow goalId={goalId} />;
}
