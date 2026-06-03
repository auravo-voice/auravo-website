import type { Metadata } from "next";
// import { QuickAnalysisFlow } from "./quick-analysis-flow";

export const metadata: Metadata = {
  title: "Quick Analysis",
  description: "Try a short voice-first English snapshot — no login required.",
};

/** Quick Analysis demo — temporarily disabled (re-enable QuickAnalysisFlow when ready). */
export default function QuickAnalysisPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-muted-foreground">Quick Analysis is temporarily unavailable.</p>
    </main>
  );
  // return <QuickAnalysisFlow />;
}
