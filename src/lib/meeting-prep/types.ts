export const MEETING_TYPES = [
  { id: "presentation", label: "Presentation" },
  { id: "negotiation", label: "Negotiation" },
  { id: "standup", label: "Stand-up / status" },
  { id: "one_on_one", label: "1-on-1" },
  { id: "panel", label: "Panel / Q&A" },
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number]["id"];

export const AUDIENCES = [
  { id: "peers", label: "Peers" },
  { id: "leadership", label: "Leadership" },
  { id: "clients", label: "Clients / customers" },
  { id: "mixed", label: "Mixed group" },
  { id: "academic", label: "Academic committee" },
] as const;
export type AudienceId = (typeof AUDIENCES)[number]["id"];

export const REHEARSAL_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type RehearsalDifficulty = (typeof REHEARSAL_DIFFICULTIES)[number];

export type RehearsalMode = "full" | "quick";

export function isMeetingType(v: unknown): v is MeetingType {
  return typeof v === "string" && (MEETING_TYPES as readonly { id: string }[]).some((m) => m.id === v);
}
export function isAudienceId(v: unknown): v is AudienceId {
  return typeof v === "string" && (AUDIENCES as readonly { id: string }[]).some((a) => a.id === v);
}
export function isRehearsalDifficulty(v: unknown): v is RehearsalDifficulty {
  return v === "easy" || v === "medium" || v === "hard";
}
export function isRehearsalMode(v: unknown): v is RehearsalMode {
  return v === "full" || v === "quick";
}

/** Meeting plan returned by the coach (and editable by the learner before rehearsal). */
export type MeetingPlan = {
  opening: string;
  talkingPoints: { id: string; label: string; hint: string }[];
  transitions: string[];
  closing: string;
  anticipatedQuestions: string[];
  pushback: string;
};

export type MeetingPrepContext = {
  agenda: string;
  meetingType: MeetingType;
  audience: AudienceId;
  durationMin: number;
  mode: RehearsalMode;
  difficulty: RehearsalDifficulty;
};

export type MeetingRehearsalManifest = MeetingPrepContext & {
  kind: "meeting_rehearsal";
  plan: MeetingPlan;
};
