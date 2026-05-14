import "server-only";
import type { TranscriptionAdapter, TranscriptionResult } from "@/lib/transcription/types";
import { PlaceholderTranscriptionAdapter } from "@/lib/transcription/placeholder";
import { FasterWhisperTranscriptionAdapter } from "@/lib/transcription/faster-whisper";

/**
 * Thrown by the strict faster-whisper adapter when transcription fails and placeholder fallback
 * has not been explicitly allowed. Routes performing real voice analysis catch this and surface
 * a clear error to the client instead of pretending placeholder text is real.
 */
export class TranscriptionUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TranscriptionUnavailableError";
  }
}

function placeholderFallbackAllowed(): boolean {
  // Default is OFF so production / live demos never silently emit dummy text into the scorer.
  // Explicitly allow with AURAVO_ALLOW_PLACEHOLDER_FALLBACK=1 (useful in early local dev or when iterating
  // on the UI without recording every change).
  const v = (process.env.AURAVO_ALLOW_PLACEHOLDER_FALLBACK ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

class FasterWhisperWithOptionalPlaceholder implements TranscriptionAdapter {
  readonly name: string;

  constructor(
    private readonly faster: FasterWhisperTranscriptionAdapter,
    private readonly placeholder: PlaceholderTranscriptionAdapter,
    private readonly allowFallback: boolean,
  ) {
    this.name = allowFallback ? "faster-whisper+placeholder" : "faster-whisper-strict";
  }

  async transcribe(audioAbsolutePath: string): Promise<TranscriptionResult> {
    try {
      const r = await this.faster.transcribe(audioAbsolutePath);
      const text = r.text.trim();
      if (text) return r;
      // Empty transcript: depending on policy, either fall back or surface the failure.
      if (this.allowFallback) {
        console.error(
          "[transcription] faster-whisper returned empty transcript; using placeholder (AURAVO_ALLOW_PLACEHOLDER_FALLBACK=1).",
        );
        return this.placeholder.transcribe(audioAbsolutePath);
      }
      throw new TranscriptionUnavailableError(
        "Whisper returned an empty transcript. Try recording again with a clearer microphone, or set AURAVO_ALLOW_PLACEHOLDER_FALLBACK=1 in dev.",
      );
    } catch (e) {
      if (e instanceof TranscriptionUnavailableError) throw e;
      if (this.allowFallback) {
        console.error("[transcription] faster-whisper failed; using placeholder.", e);
        return this.placeholder.transcribe(audioAbsolutePath);
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new TranscriptionUnavailableError(
        `Local transcription failed: ${msg}. Ensure faster-whisper is installed (npm run setup:transcription) and the audio file is readable.`,
        e,
      );
    }
  }
}

export type { TranscriptionAdapter, TranscriptionResult } from "@/lib/transcription/types";
export { PlaceholderTranscriptionAdapter } from "@/lib/transcription/placeholder";
export { FasterWhisperTranscriptionAdapter } from "@/lib/transcription/faster-whisper";

/**
 * Resolves the adapter from `TRANSCRIPTION_PROVIDER`.
 *  - `placeholder` (default): dummy text, fine for empty-codebase smoke tests, NOT for real analysis.
 *  - `faster-whisper`: real Whisper transcription. In production this throws on failure unless
 *    `AURAVO_ALLOW_PLACEHOLDER_FALLBACK=1` is set.
 */
export function getTranscriptionAdapter(): TranscriptionAdapter {
  const provider = (process.env.TRANSCRIPTION_PROVIDER ?? "placeholder").toLowerCase().trim();
  const placeholder = new PlaceholderTranscriptionAdapter();

  if (provider !== "faster-whisper") {
    if (provider !== "placeholder") {
      console.error(`[transcription] Unknown TRANSCRIPTION_PROVIDER="${provider}"; using placeholder.`);
    }
    return placeholder;
  }

  return new FasterWhisperWithOptionalPlaceholder(
    new FasterWhisperTranscriptionAdapter(),
    placeholder,
    placeholderFallbackAllowed(),
  );
}

/** True only when real audio-derived analysis is possible. Used to gate the rich analysis pipeline. */
export function isRealTranscriptionConfigured(): boolean {
  return (process.env.TRANSCRIPTION_PROVIDER ?? "").toLowerCase().trim() === "faster-whisper";
}
