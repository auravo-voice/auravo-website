import { NextResponse } from "next/server";
import { generateMeetingPlan } from "@/lib/meeting-prep/plan";
import { isAudienceId, isMeetingType } from "@/lib/meeting-prep/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate the editable rehearsal plan (opening + talking points + transitions + closing + Qs + pushback). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const agenda = typeof obj.agenda === "string" ? obj.agenda.trim() : "";
  const meetingType = obj.meetingType;
  const audience = obj.audience;
  const durationMin =
    typeof obj.durationMin === "number" && Number.isFinite(obj.durationMin)
      ? Math.max(5, Math.min(120, Math.round(obj.durationMin)))
      : 30;
  if (agenda.length < 10) {
    return NextResponse.json(
      { error: "Paste an agenda or topic (at least one sentence)." },
      { status: 400 },
    );
  }
  if (!isMeetingType(meetingType)) {
    return NextResponse.json({ error: "Invalid meeting type." }, { status: 400 });
  }
  if (!isAudienceId(audience)) {
    return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
  }
  const { plan, warning } = await generateMeetingPlan({ agenda, meetingType, audience, durationMin });
  return NextResponse.json({ plan, usedFallback: warning != null });
}
