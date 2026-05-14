import type { OllamaMessage } from "@/lib/ollama/chat-json";
import type {
  AudienceId,
  MeetingPlan,
  MeetingPrepContext,
  RehearsalDifficulty,
  RehearsalMode,
} from "./types";
import { AUDIENCES, MEETING_TYPES } from "./types";

const DIFFICULTY: Record<RehearsalDifficulty, string> = {
  easy:
    "Difficulty: Supportive audience. Mostly nod the speaker along. Ask at most one short clarifying question per turn. Lead with what landed before any nudge.",
  medium:
    "Difficulty: Engaged audience. After most user turns, ask exactly one probing question or request a concrete example. Stay polite but precise.",
  hard:
    "Difficulty: Skeptical audience. Push back on round numbers and vague claims. Ask multi-part follow-ups. Stay civil; do not be hostile.",
};

const MODE_NOTE: Record<RehearsalMode, string> = {
  full: "This is a full rehearsal. Let the speaker present in chunks; you interject between turns.",
  quick:
    "This is a 5-minute QUICK PREP rehearsal. Be efficient: keep your turns under 20 words. Move quickly through the strongest objection and the toughest likely question. Do not waste turns on warmth.",
};

function audienceLabel(id: AudienceId): string {
  return AUDIENCES.find((a) => a.id === id)?.label ?? id;
}
function meetingLabel(id: MeetingPrepContext["meetingType"]): string {
  return MEETING_TYPES.find((m) => m.id === id)?.label ?? id;
}

/**
 * Build the system prompt for the AI "audience" during a meeting rehearsal. The persona is grounded in the agenda,
 * context, and plan, so the AI can ask agenda-aware follow-ups instead of generic small talk.
 */
export function buildRehearsalSystemPrompt(ctx: MeetingPrepContext, plan: MeetingPlan): string {
  const audience = audienceLabel(ctx.audience);
  const meetingType = meetingLabel(ctx.meetingType);
  const talkingPointSummary = plan.talkingPoints.map((tp) => `- ${tp.label}: ${tp.hint}`).join("\n");
  const anticipated = plan.anticipatedQuestions.slice(0, 4).map((q) => `- ${q}`).join("\n");
  return [
    `You play the audience for the learner's rehearsal: a ${audience.toLowerCase()} group at a ${meetingType.toLowerCase()}. The meeting target length is about ${ctx.durationMin} minutes; the agenda is:`,
    `"""\n${ctx.agenda.trim().slice(0, 6000)}\n"""`,
    `The learner's plan includes:\nOpening: ${plan.opening}\nTalking points:\n${talkingPointSummary}\nClosing: ${plan.closing}`,
    anticipated ? `Likely questions you might ask:\n${anticipated}` : "",
    DIFFICULTY[ctx.difficulty],
    MODE_NOTE[ctx.mode],
    "Stay in character as the audience. Never explain what you are doing. Never break character.",
    "Keep replies to 1-3 sentences. Mix three reply types and label them: a short question, a brief pushback, or a one-sentence 'continue' (e.g. 'Got it — keep going.').",
    "Respond ONLY with valid JSON: { \"reply\": string, \"kind\": \"question\" | \"pushback\" | \"continue\" }. No markdown. No preamble.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildRehearsalChatHistory(
  prior: { role: "user" | "assistant"; text: string }[],
): OllamaMessage[] {
  return prior.map((t) => ({ role: t.role, content: t.text }));
}
