import { Suspense } from "react";
import { AssessmentMultiRecorder } from "./assessment-multi-recorder";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ goal?: string | string[] }> };

export default async function AssessmentPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const raw = sp.goal;
  const fromQuery = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const goalId = isOnboardingGoalId(fromQuery) ? fromQuery : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Initial assessment</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Spoken baseline</h1>
        <p className="mt-2 text-muted-foreground">
          Four short prompts — a passage, two open questions, and a visual description. Progress is saved as you go, so
          refreshing or stepping away never costs you a segment.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <AssessmentMultiRecorder goalId={goalId} />
      </Suspense>
    </div>
  );
}
