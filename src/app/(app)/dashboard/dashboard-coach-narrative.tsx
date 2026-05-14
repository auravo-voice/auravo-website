import { CoachDegradedBanner } from "@/components/coach-degraded-banner";
import type { DashboardNarrativeInput } from "@/lib/coach/dashboard-narrative";
import { getDashboardCoachingNarrative } from "@/lib/coach/dashboard-narrative";

/** Coach blurb + optional degraded banner — streams independently so the rest of the dashboard can paint first. */
export async function DashboardCoachNarrativeIntro({ input }: { input: DashboardNarrativeInput }) {
  const { data: copy, warning } = await getDashboardCoachingNarrative(input);
  return (
    <>
      {warning ? <CoachDegradedBanner message={warning} /> : null}
      <p className="mt-2 max-w-xl text-muted-foreground">{copy.coachBlurb}</p>
    </>
  );
}

/** Today’s session title/focus — shares one Ollama round-trip with {@link DashboardCoachNarrativeIntro} per request. */
export async function DashboardCoachNarrativeTodaySession({ input }: { input: DashboardNarrativeInput }) {
  const { data: copy } = await getDashboardCoachingNarrative(input);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-primary">Focus</p>
        <p className="font-display text-xl">{copy.todaySessionTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.todaySessionFocus}</p>
      </div>
    </div>
  );
}
