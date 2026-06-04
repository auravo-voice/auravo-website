import "server-only";

/** Whisper model for Quick Analysis only (`tiny` by default — much faster than `small`). */
export function getQuickAnalysisWhisperModel(): string {
  return (process.env.QUICK_ANALYSIS_WHISPER_MODEL ?? "tiny").trim() || "tiny";
}

/** Temporarily overrides `FASTER_WHISPER_MODEL` for the duration of `fn`. */
export async function withQuickAnalysisWhisperModel<T>(fn: () => Promise<T>): Promise<T> {
  const quickModel = getQuickAnalysisWhisperModel();
  const previousModel = process.env.FASTER_WHISPER_MODEL;
  process.env.FASTER_WHISPER_MODEL = quickModel;
  try {
    return await fn();
  } finally {
    if (previousModel !== undefined) process.env.FASTER_WHISPER_MODEL = previousModel;
    else delete process.env.FASTER_WHISPER_MODEL;
  }
}
