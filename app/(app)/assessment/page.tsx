import { redirect } from "next/navigation";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ goal?: string | string[] }> };

/** Legacy route — Quick Analysis is the initial assessment. */
export default async function AssessmentPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const raw = sp.goal;
  const fromQuery = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const goalId = isOnboardingGoalId(fromQuery) ? fromQuery : null;
  const dest = goalId ? `/quick-analysis?goal=${encodeURIComponent(goalId)}` : "/quick-analysis";
  redirect(dest);
}
