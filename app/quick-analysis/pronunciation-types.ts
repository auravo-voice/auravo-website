export type QuickAnalysisWordConfidence = {
  word: string;
  confidence: number;
  start: number;
  end: number;
};

export type QuickAnalysisTranscriptSegment = {
  label: string;
  transcript: string;
  wordConfidences: QuickAnalysisWordConfidence[];
};

export const PRONUNCIATION_RED_THRESHOLD = 0.6;
export const PRONUNCIATION_YELLOW_THRESHOLD = 0.85;
