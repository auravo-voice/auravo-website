import "server-only";
import { unstable_cache } from "next/cache";
import { ollamaChatStructured } from "@/lib/ollama/chat-json";
import { getCoachOllamaTimeoutMs } from "@/lib/ollama/env";
import { coachFailureWarning, type CoachServeResult } from "@/lib/coach/coach-serve-result";
import { FALLBACK_PROGRESS } from "@/lib/coach/fallbacks";
import { progressJournalSchema, type ProgressJournalPayload } from "@/lib/coach/schemas";

const SYSTEM = `You are Auravo's progress journal synthesizer.
Return JSON only (no markdown).
Shape:
{
  "timeline": array of 4 to 8 past speaking sessions (synthetic but realistic), each:
    { "id": unique string id, "date": "YYYY-MM-DD", "title": string, "scenario": short tag, "durationSec": integer 300-1800, "score": number 55-92 },
  Dates should be recent and descending.
  "milestones": array of 2-4 achievements { "id", "label", "date" "YYYY-MM-DD" },
  "weeklyTrend": exactly 7 integers 40-95 representing relative speaking quality index for the last 7 weeks (oldest first),
  "summary": optional one sentence.
}`;

export async function getProgressJournalCoachServing(): Promise<CoachServeResult<ProgressJournalPayload>> {
  try {
    const data = await unstable_cache(
      async () =>
        ollamaChatStructured({
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: "Generate a plausible progress journal for an active Auravo user improving interview and meeting skills.",
            },
          ],
          schema: progressJournalSchema,
          numPredict: 2400,
          timeoutMs: getCoachOllamaTimeoutMs(),
        }),
      ["auravo-coach-progress-journal-v1"],
      { revalidate: 300 },
    )();
    return { data, warning: null };
  } catch (e) {
    return { data: FALLBACK_PROGRESS, warning: coachFailureWarning(e) };
  }
}
