"use client";

import Link from "next/link";

import { AnalysisResultsLayout } from "@/app/quick-analysis/components/AnalysisResultsLayout";
import { DemoAmbient } from "@/app/quick-analysis/components/DemoAmbient";
import { Button } from "@/components/ui/button";
import type { AssessmentBaselinePayload } from "@/lib/assessment/baseline-results-payload";
import type { BaselineAnalysisLayoutInput } from "@/lib/assessment/baseline-to-results-layout";
import { warningBannerClass } from "@/lib/ui/warning-styles";

type Props = {
  results: AssessmentBaselinePayload;
  layout: BaselineAnalysisLayoutInput;
};

export function BaselineResultsView({ results, layout }: Props) {
  return (
    <div className="relative w-full">
      <DemoAmbient />
      <div className="relative z-10">
        {results.degraded ? (
          <p className={`mb-6 ${warningBannerClass}`}>
            We used a simplified analysis path for this result. Your plan still works — you may get
            richer detail on your next full recording.
          </p>
        ) : null}
        {!layout.fromQuickAnalysisSnapshot ? (
          <p className={`mb-6 ${warningBannerClass}`}>
            This baseline was saved before we stored the full Quick Analysis view. Re-run Quick
            Analysis to see per-question transcript highlights and coaching cards exactly as before.
          </p>
        ) : null}
        <AnalysisResultsLayout
          scores={layout.scores}
          transcriptSegments={layout.transcriptSegments}
          phoneticMap={layout.phoneticMap}
          highlightSource={layout.pronunciationHighlightSource}
          coachSummary={layout.coachSummary}
          grammar={layout.grammar}
          subtitle={layout.subtitle}
          footer={
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button variant="glow" asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/quick-analysis">Run Quick Analysis again</Link>
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
