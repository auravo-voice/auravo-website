/**
 * Stop a MediaRecorder and build a blob from collected chunks.
 * Calls `requestData()` before `stop()` so Safari/WebKit flush the last frame.
 */
export async function stopMediaRecorderAndBuildBlob(
  mr: MediaRecorder,
  chunks: BlobPart[],
): Promise<Blob> {
  await new Promise<void>((resolve) => {
    mr.onstop = () => resolve();
    try {
      if (mr.state === "recording" && typeof mr.requestData === "function") {
        mr.requestData();
      }
    } catch {
      /* some browsers throw if not recording */
    }
    if (mr.state !== "inactive") {
      mr.stop();
    } else {
      resolve();
    }
  });
  return new Blob(chunks, { type: mr.mimeType || "audio/webm" });
}

export type RecordingValidationOpts = {
  /** Minimum file size — below this the container is effectively empty (not a volume check). */
  minBytes?: number;
  minDurationMs?: number;
  shortDurationMessage?: string;
  emptyCaptureMessage?: string;
};

const DEFAULT_MIN_BYTES = 200;
const DEFAULT_MIN_DURATION_MS = 1_500;

/**
 * Returns a user-facing error string, or null if the recording looks usable.
 * Note: this does NOT measure loudness — only duration and whether bytes were captured.
 */
export function recordingValidationError(
  blob: Blob,
  durationMs: number,
  opts: RecordingValidationOpts = {},
): string | null {
  const minBytes = opts.minBytes ?? DEFAULT_MIN_BYTES;
  const minDurationMs = opts.minDurationMs ?? DEFAULT_MIN_DURATION_MS;
  const shortMsg =
    opts.shortDurationMessage ??
    "Recording was very short. Speak for at least a few seconds, then tap Stop.";
  const emptyMsg =
    opts.emptyCaptureMessage ??
    "No audio was captured. Check your microphone, pick the correct input in system settings, and try again.";

  if (durationMs < minDurationMs) {
    return shortMsg;
  }
  if (blob.size < minBytes) {
    return emptyMsg;
  }
  return null;
}
