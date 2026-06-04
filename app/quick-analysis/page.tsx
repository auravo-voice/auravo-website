import type { Metadata } from "next";
import { QuickAnalysisFlow } from "./quick-analysis-flow";

export const metadata: Metadata = {
  title: "Quick Analysis — Auravo",
  description: "A short voice-first English snapshot for demos — no login required.",
};

export default function QuickAnalysisPage() {
  return <QuickAnalysisFlow />;
}
