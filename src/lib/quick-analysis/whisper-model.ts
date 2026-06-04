import "server-only";

/** Whisper model for Quick Analysis — defaults to the same `FASTER_WHISPER_MODEL` as the main assessment. */
export function getQuickAnalysisWhisperModel(): string {
  const env = (process.env.QUICK_ANALYSIS_WHISPER_MODEL ?? process.env.FASTER_WHISPER_MODEL ?? "small").trim();
  return env || "small";
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
