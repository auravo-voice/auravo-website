import type { QuickAnalysisWordConfidence } from "@/app/quick-analysis/pronunciation-types";

/** Apply polished spellings to Whisper tokens when word counts still match. */
export function displayWordConfidencesWithPolishedTranscript(
  wordConfidences: QuickAnalysisWordConfidence[],
  polishedTranscript: string,
): QuickAnalysisWordConfidence[] {
  if (wordConfidences.length === 0) return wordConfidences;

  const polishedTokens = polishedTranscript.match(/\S+/g) ?? [];
  const whisperTokens = wordConfidences.map((w) => w.word.trim()).filter(Boolean);
  if (polishedTokens.length !== whisperTokens.length) return wordConfidences;

  return wordConfidences.map((w, index) => {
    const polished = polishedTokens[index];
    if (!polished) return w;
    const leading = w.word.match(/^[\s\n]+/)?.[0] ?? "";
    return { ...w, word: `${leading}${polished}` };
  });
}
