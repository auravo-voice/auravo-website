import "server-only";
import { z } from "zod";
import { ollamaChatStructured } from "@/lib/ollama/chat-json";
import { getCoachOllamaTimeoutMs } from "@/lib/ollama/env";
import { AUDIENCES, MEETING_TYPES, type AudienceId, type MeetingType, type MeetingPlan } from "./types";

const planSchema = z.object({
  opening: z.string().min(8).max(800),
  talkingPoints: z
    .array(z.object({ label: z.string().min(3).max(120), hint: z.string().min(4).max(280) }))
    .min(2)
    .max(7),
  transitions: z.array(z.string().min(4).max(180)).min(0).max(5),
  closing: z.string().min(8).max(800),
  anticipatedQuestions: z.array(z.string().min(4).max(200)).min(2).max(6),
  pushback: z.string().min(8).max(600),
});

type PlanResponse = z.infer<typeof planSchema>;

function meetingTypeLabel(id: MeetingType): string {
  return MEETING_TYPES.find((m) => m.id === id)?.label ?? id;
}
function audienceLabel(id: AudienceId): string {
  return AUDIENCES.find((a) => a.id === id)?.label ?? id;
}

const SYSTEM = `You are Auravo's meeting prep coach.
Return ONLY JSON (no markdown, no preamble). Shape:
{
  "opening": short, confident spoken opener (2-3 sentences, ends with a hook),
  "talkingPoints": 3-5 items, each { "label": short title, "hint": one-sentence rehearsal cue },
  "transitions": 1-3 short transition lines that bridge talking points,
  "closing": 2-3 sentences ending with a clear ask or next step,
  "anticipatedQuestions": 3-5 likely audience questions (full sentences ending in '?'),
  "pushback": 2-3 sentences describing the strongest objection and how to handle it briefly
}
Plain English, no jargon unless the agenda uses it. Never invent numbers the agenda did not mention.`;

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
  const agenda = input.agenda.trim().slice(0, 8000);
  const userPrompt = `Meeting type: ${meetingTypeLabel(input.meetingType)}
Audience: ${audienceLabel(input.audience)}
Target duration: ${input.durationMin} minutes

Agenda / notes:
"""
${agenda}
"""

Draft a plan the learner will rehearse aloud. Keep every sentence speakable in one breath.`;

  try {
    const data: PlanResponse = await ollamaChatStructured({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      schema: planSchema,
      numPredict: 900,
      timeoutMs: getCoachOllamaTimeoutMs(),
    });
    return {
      plan: {
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
      },
      warning: null,
    };
  } catch (e) {
    // Fallback plan so the rehearsal flow is never blocked by Ollama being slow.
    return {
      plan: {
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
      },
      warning: e instanceof Error ? e.message : "Could not reach the local coach.",
    };
  }
}
