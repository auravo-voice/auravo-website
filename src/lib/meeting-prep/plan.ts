import "server-only";
import { z } from "zod";
import { ollamaChatStructured } from "@/lib/ollama/chat-json";
import { getCoachOllamaTimeoutMs } from "@/lib/ollama/env";
import { AUDIENCES, MEETING_TYPES, type AudienceId, type MeetingType, type MeetingPlan } from "./types";

const talkingPointSchema = z.object({
  label: z.string().min(3).max(72),
  hint: z.string().min(4).max(120),
});

function buildPlanSchema(compact: boolean) {
  return z.object({
    opening: z.string().min(8).max(compact ? 280 : 400),
    talkingPoints: z.array(talkingPointSchema).min(3).max(compact ? 3 : 4),
    transitions: z.array(z.string().min(4).max(100)).min(1).max(compact ? 2 : 3),
    closing: z.string().min(8).max(compact ? 280 : 400),
    anticipatedQuestions: z.array(z.string().min(4).max(120)).min(3).max(compact ? 3 : 4),
    pushback: z.string().min(8).max(compact ? 240 : 360),
  });
}

type PlanResponse = z.infer<ReturnType<typeof buildPlanSchema>>;

function meetingTypeLabel(id: MeetingType): string {
  return MEETING_TYPES.find((m) => m.id === id)?.label ?? id;
}
function audienceLabel(id: AudienceId): string {
  return AUDIENCES.find((a) => a.id === id)?.label ?? id;
}

const SYSTEM_COMPACT = `Meeting prep coach. Return JSON only (no markdown).
All fields are plain strings or arrays of strings/objects as specified — never nest pushback or closing inside arrays.
Shape: { "opening": string, "talkingPoints": [3× {"label": string, "hint": string}], "transitions": [2 strings], "closing": string, "anticipatedQuestions": [3 strings ending in ?], "pushback": string (one paragraph, NOT an array) }
Be terse. Use only facts from the agenda.`;

const SYSTEM_FULL = `Meeting prep coach. Return JSON only (no markdown).
All fields are plain strings or arrays as specified — pushback and closing must be strings, not arrays.
Shape: { "opening": string, "talkingPoints": [3-4× {"label": string, "hint": string}], "transitions": [2-3 strings], "closing": string, "anticipatedQuestions": [3-4 strings ending in ?], "pushback": string }
Be concise. Use only facts from the agenda.`;

const FALLBACK_PLAN: MeetingPlan = {
  opening:
    "Thanks for the time. I want to cover three things in our window: where we are, what I am asking for, and what I'd like us to commit to by the end.",
  talkingPoints: [
    { id: "tp-1", label: "State of play", hint: "30 seconds: the headline status in plain language." },
    { id: "tp-2", label: "What I need", hint: "Be specific: who, what, by when." },
    { id: "tp-3", label: "Risks to flag", hint: "Name the one risk worth their attention, calmly." },
  ],
  transitions: ["So with that in mind…", "That brings us to the ask.", "Before we wrap, one risk to flag."],
  closing:
    "To recap: we are here, I need X by Y, and I'll send a one-page follow-up. Anything I missed before we close?",
  anticipatedQuestions: [
    "How confident are you in the timeline?",
    "What would have to be true for this to slip?",
    "Who else has weighed in?",
  ],
  pushback:
    "If they push on cost, anchor on the cost of inaction first, then walk through the trade-off with a single concrete number.",
};

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asString).filter(Boolean).join(" ");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (typeof o.content === "string") return o.content;
  }
  return v == null ? "" : String(v);
}

function asStringList(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    const s = asString(item).trim();
    return s ? [s] : [];
  });
}

/** Coerce common Qwen/JSON mistakes (e.g. pushback returned as an array) before Zod. */
export function normalizeMeetingPlanJson(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const o = parsed as Record<string, unknown>;
  return {
    opening: asString(o.opening),
    closing: asString(o.closing),
    pushback: asString(o.pushback),
    transitions: asStringList(o.transitions),
    anticipatedQuestions: asStringList(o.anticipatedQuestions),
    talkingPoints: Array.isArray(o.talkingPoints)
      ? o.talkingPoints.map((item) => {
          if (typeof item === "string") {
            const t = item.trim();
            return { label: t.slice(0, 72) || "Point", hint: t };
          }
          if (item && typeof item === "object") {
            const p = item as Record<string, unknown>;
            return {
              label: asString(p.label ?? p.title ?? "Point").trim(),
              hint: asString(p.hint ?? p.cue ?? p.description ?? p.text ?? "").trim(),
            };
          }
          return item;
        })
      : o.talkingPoints,
  };
}

function mapPlanResponse(data: PlanResponse): MeetingPlan {
  return {
    opening: data.opening.trim(),
    talkingPoints: data.talkingPoints.map((p, i) => ({
      id: `tp-${i + 1}`,
      label: p.label.trim(),
      hint: p.hint.trim(),
    })),
    transitions: data.transitions.map((t) => t.trim()).filter(Boolean),
    closing: data.closing.trim(),
    anticipatedQuestions: data.anticipatedQuestions.map((q) => q.trim()).filter(Boolean),
    pushback: data.pushback.trim(),
  };
}

/**
 * Generate a structured meeting plan from the learner's agenda + context. Used by the meeting-prep page as the
 * "Talking Point Coach" step before the rehearsal. Learners can edit any field before starting rehearsal.
 */
export async function generateMeetingPlan(input: {
  agenda: string;
  meetingType: MeetingType;
  audience: AudienceId;
  durationMin: number;
}): Promise<{ plan: MeetingPlan; warning: string | null }> {
  const compact = input.durationMin <= 10;
  const agendaCap = compact ? 1_500 : 3_000;
  const agenda = input.agenda.trim().slice(0, agendaCap);
  const userPrompt = `Type: ${meetingTypeLabel(input.meetingType)} | Audience: ${audienceLabel(input.audience)} | ${input.durationMin} min

Agenda:
"""
${agenda}
"""`;

  try {
    const data: PlanResponse = await ollamaChatStructured({
      messages: [
        { role: "system", content: compact ? SYSTEM_COMPACT : SYSTEM_FULL },
        { role: "user", content: userPrompt },
      ],
      schema: buildPlanSchema(compact),
      normalize: normalizeMeetingPlanJson,
      numPredict: compact ? 380 : 520,
      numCtx: compact ? 2_048 : 3_072,
      temperature: 0.3,
      timeoutMs: getCoachOllamaTimeoutMs(),
    });
    return { plan: mapPlanResponse(data), warning: null };
  } catch (e) {
    return {
      plan: FALLBACK_PLAN,
      warning: e instanceof Error ? e.message : "Could not reach the local coach.",
    };
  }
}
