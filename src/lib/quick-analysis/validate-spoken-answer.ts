/** Minimum audio payload (~0.5s webm) — matches deterministic quick analysis. */
export const MIN_SPOKEN_ANSWER_BYTES = 800;

/** Reject instant mic tap-without-speaking. */
export const MIN_SPOKEN_ANSWER_MS = 600;

export function validateSpokenAnswer(
  blob: Blob,
  browserTranscript: string,
  recordingMs: number,
): string | null {
  if (blob.size < MIN_SPOKEN_ANSWER_BYTES) {
    return "We didn't catch any speech. Hold the mic, say your answer out loud, then tap again to stop.";
  }
  if (recordingMs > 0 && recordingMs < MIN_SPOKEN_ANSWER_MS && blob.size < 2000) {
    return "That was too short. Hold the mic a little longer while you speak, then tap again to stop.";
  }

  const wordCount = browserTranscript.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount >= 1) return null;

  // No live captions — allow substantial audio; server Whisper will transcribe.
  if (blob.size >= 3000) return null;

  return "We didn't hear any words. Say your answer clearly, then tap the mic again to stop.";
}
