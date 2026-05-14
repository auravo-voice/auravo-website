import "server-only";
import { z } from "zod";
import { ollamaChatStructured, type OllamaMessage } from "@/lib/ollama/chat-json";
import { getCoachOllamaTimeoutMs } from "@/lib/ollama/env";
import { buildRehearsalSystemPrompt } from "./persona";
import type { MeetingPlan, MeetingPrepContext } from "./types";

const rehearsalTurnSchema = z.object({
  reply: z.string().min(1).max(600),
  kind: z.enum(["question", "pushback", "continue"]),
});

export type RehearsalTurnReply = z.infer<typeof rehearsalTurnSchema>;

/** Generate the audience's reaction to one user turn during a meeting rehearsal. */
export async function generateRehearsalReply(input: {
  ctx: MeetingPrepContext;
  plan: MeetingPlan;
  history: { role: "user" | "assistant"; text: string }[];
  userTurn: string;
  turnIndex: number;
}): Promise<{ reply: string; kind: RehearsalTurnReply["kind"]; warning: string | null }> {
  const { ctx, plan, history, userTurn, turnIndex } = input;
  const messages: OllamaMessage[] = [
    { role: "system", content: buildRehearsalSystemPrompt(ctx, plan) },
  ];
  for (const t of history) {
    messages.push({ role: t.role, content: t.text });
  }
  messages.push({ role: "user", content: userTurn });

  try {
    const out = await ollamaChatStructured({
      messages,
      schema: rehearsalTurnSchema,
      numPredict: 220,
      timeoutMs: getCoachOllamaTimeoutMs(),
    });
    return { reply: out.reply.trim(), kind: out.kind, warning: null };
  } catch (e) {
    // Deterministic fallback so the rehearsal never wedges on Ollama outage.
    const fallback =
      turnIndex < 1
        ? { reply: "Got it — keep going.", kind: "continue" as const }
        : turnIndex % 2 === 0
        ? { reply: "Quick question — what's the single most important number behind that?", kind: "question" as const }
        : { reply: "I hear it, but I'd want to see why it doesn't slip. Walk me through the risk.", kind: "pushback" as const };
    return { ...fallback, warning: e instanceof Error ? e.message : "AI audience is unavailable." };
  }
}
