import "server-only";
import type { TranscriptionAdapter, TranscriptionResult } from "@/lib/transcription/types";

export class PlaceholderTranscriptionAdapter implements TranscriptionAdapter {
  readonly name = "placeholder";

  async transcribe(audioAbsolutePath: string): Promise<TranscriptionResult> {
    void audioAbsolutePath;
    return {
      text: [
        "This is a placeholder transcript until a local Whisper adapter is configured.",
        "I am practicing speaking aloud to establish a baseline for my coaching goals.",
        "I want to improve clarity pacing and reduce filler words like um and uh during answers.",
        "Sometimes I say could of when I mean could have and i forget to capitalize I after a period.The assessment covers pronunciation grammar fluency vocabulary fillers and pacing over several sentences.",
      ].join(" "),
    };
  }
}
