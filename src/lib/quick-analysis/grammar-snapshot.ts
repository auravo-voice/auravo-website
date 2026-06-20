import type { GrammarFlag } from "@/lib/assessment/baseline-analysis-types";

/** Grammar feedback shown in Quick Analysis results (Groq + legacy flags). */
export type QuickAnalysisGrammarSnapshot = {
  summary: string | null;
  strengths: string[];
  flags: GrammarFlag[];
};

export function grammarSnapshotFromAnalysis(analysis: {
  grammarAnalysis: { summary: string; strengths: string[] } | null;
  deep: { grammarFlags: GrammarFlag[] };
}): QuickAnalysisGrammarSnapshot {
  return {
    summary: analysis.grammarAnalysis?.summary?.trim() || null,
    strengths: analysis.grammarAnalysis?.strengths ?? [],
    flags: analysis.deep.grammarFlags ?? [],
  };
}
