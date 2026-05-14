import type { Difficulty, Scenario } from "./library";

const DIFFICULTY_MODIFIERS: Record<Difficulty, string> = {
  easy: "Difficulty: Easy. Be warm and encouraging. Acknowledge what the user does well before any follow-up. Ask one clarifying question per turn; never stack questions. Avoid pushback unless answers are seriously off-topic.",
  medium:
    "Difficulty: Medium. Be professional and balanced. After each user turn, name one thing that landed, then probe one weaker part with a single follow-up question.",
  hard:
    "Difficulty: Hard. Be skeptical and challenging. Press on vague claims, push back on round numbers, and ask multi-part follow-ups when the user generalises. Stay civil; do not be hostile or sarcastic.",
};

/**
 * System prompt for the AI partner in a turn-by-turn simulation. Combines the scenario's fixed persona summary,
 * difficulty modifier, and rigid output rules so the runner can safely append the model's reply to the transcript.
 *
 * Keep this prompt strictly behavioural — the schema we ask for is `{ reply: string }` only, so any drift away from
 * the persona shows up in the reply text and is easy to spot during QA.
 */
export function buildPersonaSystemPrompt(scenario: Scenario, difficulty: Difficulty): string {
  return [
    scenario.personaSummary,
    DIFFICULTY_MODIFIERS[difficulty],
    `Stay strictly in character as ${scenario.personaName}. Never break character. Never explain what you are doing.`,
    "Keep replies to two to four sentences. Do not deliver long monologues.",
    "Ask one question per reply unless the scenario explicitly calls for several short questions.",
    "Do not invent facts about the user. If you need information to advance the scenario, ask for it.",
    scenario.topics.length > 0
      ? `If the conversation stalls, naturally weave in one of these threads: ${scenario.topics
          .map((t) => `"${t}"`)
          .join(", ")}.`
      : "",
    "Respond ONLY with valid JSON of the form { \"reply\": \"...\" } — no markdown, no preamble.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Build a short user-visible context line shown above the conversation while a simulation is live. */
export function describeSimulationHeader(scenario: Scenario, difficulty: Difficulty): string {
  const diffWord = difficulty === "easy" ? "easy" : difficulty === "hard" ? "hard" : "medium";
  return `${scenario.title} · ${diffWord} · with ${scenario.personaName}`;
}
