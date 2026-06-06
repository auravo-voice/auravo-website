import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { QuickAnalysisFlow } from "@/app/quick-analysis/quick-analysis-flow";
import { getAuthenticatedUserId } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Quick Analysis — Auravo",
  description: "A short voice-first English snapshot with Voca — sign in required.",
};

export const dynamic = "force-dynamic";

export default async function QuickAnalysisPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login?redirect=/quick-analysis");
  }

  return <QuickAnalysisFlow />;
}
