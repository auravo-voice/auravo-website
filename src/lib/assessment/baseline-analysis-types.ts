export type GrammarFlag = {
  label: string;
  excerpt: string;
  suggestion: string;
};

export type PronunciationTip = {
  heardAs: string;
  confidence: number;
  tip: string;
};

export type BaselineAnalysis = {
  grammarFlags: GrammarFlag[];
  pronunciationTips: PronunciationTip[];
};

export type AsrWordHint = { token: string; probability: number };
