import "server-only";
import { z } from "zod";
import { ollamaChatStructured, type OllamaMessage } from "@/lib/ollama/chat-json";
import { getCoachOllamaTimeoutMs } from "@/lib/ollama/env";
import { buildPersonaSystemPrompt } from "@/lib/simulations/persona";
import type { Difficulty, Scenario } from "@/lib/simulations/library";

const turnSchema = z.object({
  reply: z.string().min(1).max(900),
});

export type SimulationTranscriptTurn = { role: "user" | "assistant"; text: string };

/**
 * Generates the AI partner's next reply given the scenario, difficulty, and prior turns. Always returns a string —
 * on Ollama failure we surface a transparent fallback so the runner can keep moving rather than wedging the UI.
 */
export async function generateSimulationReply(input: {
  scenario: Scenario;
  difficulty: Difficulty;
  history: SimulationTranscriptTurn[];
  userTurn: string;
}): Promise<{ reply: string; warning: string | null }> {
  const { scenario, difficulty, history, userTurn } = input;
  const messages: OllamaMessage[] = [
    { role: "system", content: buildPersonaSystemPrompt(scenario, difficulty) },
  ];
  for (const t of history) {
    messages.push({ role: t.role, content: t.text });
  }
  messages.push({ role: "user", content: userTurn });

  try {
    const out = await ollamaChatStructured({
      messages,
      schema: turnSchema,
      numPredict: 320,
      timeoutMs: getCoachOllamaTimeoutMs(),
    });
    return { reply: out.reply.trim(), warning: null };
  } catch (e) {
    return {
      reply:
        "I'm here — I lost the thread for a moment. Could you say a bit more about that, or pick the part you want me to push on?",
      warning: e instanceof Error ? e.message : "AI partner is unavailable.",
    };
  }
}

const customScenarioSchema = z.object({
  title: z.string().min(4).max(120),
  description: z.string().min(10).max(280),
  personaName: z.string().min(1).max(40),
  personaSummary: z.string().min(20).max(800),
  opener: z.string().min(8).max(420),
  topics: z.array(z.string().min(2).max(120)).min(0).max(6),
});

export type GeneratedCustomScenario = z.infer<typeof customScenarioSchema>;

/** Expands a free-text description into a single transient scenario for the custom simulation flow. */
export async function generateCustomScenario(input: {
  description: string;
}): Promise<{ scenario: GeneratedCustomScenario; warning: string | null }> {
  const desc = input.description.trim().slice(0, 800);
  const messages: OllamaMessage[] = [
    {
      role: "system",
      content: `You generate a single simulation scenario in JSON for a turn-by-turn voice practice tool.
Return ONLY JSON of the form:
{
  "title": short title,
  "description": one-sentence summary the learner sees,
  "personaName": short name or role (e.g. "Maya", "the panel"),
  "personaSummary": 2-4 sentences describing exactly who the AI is playing, the setting, and what they care about,
  "opener": the AI's first message to the learner (2-3 sentences, ending with a question),
  "topics": up to 4 short follow-up themes the AI can weave in
}
Keep it realistic, plain English, no emojis, no markdown.`,
    },
    {
      role: "user",
      content: `Generate a scenario based on this learner description:\n\n${desc}`,
    },
  ];

  try {
    const data = await ollamaChatStructured({
      messages,
      schema: customScenarioSchema,
      numPredict: 480,
      timeoutMs: getCoachOllamaTimeoutMs(),
    });
    return { scenario: data, warning: null };
  } catch (e) {
    return {
      scenario: {
        title: "Custom practice scenario",
        description: desc.slice(0, 200),
        personaName: "your partner",
        personaSummary:
          "You play a realistic conversation partner described by the learner. Stay grounded in what the learner asked for; if details are missing, ask one clarifying question.",
        opener:
          "Thanks for setting this up. Before we get into it — can you set the scene for me in one or two sentences? What are you trying to practise here?",
        topics: [],
      },
      warning: e instanceof Error ? e.message : "Could not reach the local coach.",
    };
  }
}
