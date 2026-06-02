import "server-only";
import { unstable_cache } from "next/cache";
import { groqChatStructured } from "@/lib/groq/chat-json";
import { getGroqCoachTimeoutMs } from "@/lib/groq/env";
import { coachFailureWarning, type CoachServeResult } from "@/lib/coach/coach-serve-result";
import { FALLBACK_SCENARIOS } from "@/lib/coach/fallbacks";
import { scenariosLibrarySchema, type ScenariosLibraryPayload } from "@/lib/coach/schemas";

const SYSTEM = `You are Auravo's simulation library curator for professional speaking practice.
Return JSON only (no markdown).
Shape: { "scenarios": array of 6 to 12 items, each { "id": unique string, "title": string, "category": one of Interviews | Client calls | Meetings | Pitch | Academic, "difficulty": "Easy" | "Medium" | "Hard" } }.
Titles must be specific and varied.`;

function scenariosUserMessage(q: string, c: string): string {
  if (c) {
    return `Create 6-10 custom practice scenarios tailored to this learner request:\n"""${c}"""\nEach scenario should be actionable for voice rehearsal.`;
  }
  if (q) {
    return `Return 6-12 scenarios filtered or themed around: "${q}". If narrow, still fill with closely related practice scenarios.`;
  }
  return "Return a balanced default library mixing interviews, client calls, meetings, pitches, and academic speaking.";
}

async function fetchScenariosModel(q: string, c: string): Promise<ScenariosLibraryPayload> {
  return groqChatStructured({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: scenariosUserMessage(q, c) },
    ],
    schema: scenariosLibrarySchema,
    maxTokens: 1600,
    timeoutMs: getGroqCoachTimeoutMs(),
  });
}

export async function getScenariosLibraryServing(options: {
  searchQuery?: string;
  customDescription?: string;
}): Promise<CoachServeResult<ScenariosLibraryPayload>> {
  const q = options.searchQuery?.trim() ?? "";
  const c = options.customDescription?.trim() ?? "";
  try {
    const data = await unstable_cache(
      () => fetchScenariosModel(q, c),
      ["auravo-coach-scenarios-v1", q, c],
      { revalidate: 300 },
    )();
    return { data, warning: null };
  } catch (e) {
    return { data: FALLBACK_SCENARIOS, warning: coachFailureWarning(e) };
  }
}
