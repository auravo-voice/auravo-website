import { CoachDegradedBanner } from "@/components/coach-degraded-banner";
import type { DashboardNarrativeInput } from "@/lib/coach/dashboard-narrative";
import { getDashboardCoachingNarrative } from "@/lib/coach/dashboard-narrative";

/** Coach blurb + optional degraded banner — streams independently so the rest of the dashboard can paint first. */
export async function DashboardCoachNarrativeIntro({ input }: { input: DashboardNarrativeInput }) {
  const { data: copy, warning } = await getDashboardCoachingNarrative(input);
  return (
    <>
      {warning ? <CoachDegradedBanner message={warning} /> : null}
      <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{copy.coachBlurb}</p>
    </>
  );
}

/** Today’s session title/focus — shares one Ollama round-trip with {@link DashboardCoachNarrativeIntro} per request. */
export async function DashboardCoachNarrativeTodaySession({ input }: { input: DashboardNarrativeInput }) {
  const { data: copy } = await getDashboardCoachingNarrative(input);
  return (
    <div>
      <p className="text-[13px] font-medium text-muted-foreground">Focus</p>
      <p className="mt-1 font-display text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">
        {copy.todaySessionTitle}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{copy.todaySessionFocus}</p>
    </div>
  );
}
