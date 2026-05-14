import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { practiceSession } from "@/db/schema";
import { ensureUserProfile } from "@/db/queries/user";
import { insertSimulationTurnSync } from "@/db/queries/simulations";
import {
  AURAVO_USER_ID_COOKIE,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import {
  isAudienceId,
  isMeetingType,
  isRehearsalDifficulty,
  isRehearsalMode,
  type MeetingPlan,
  type MeetingRehearsalManifest,
} from "@/lib/meeting-prep/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function looksLikePlan(v: unknown): v is MeetingPlan {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.opening === "string" &&
    typeof o.closing === "string" &&
    Array.isArray(o.talkingPoints) &&
    Array.isArray(o.transitions) &&
    Array.isArray(o.anticipatedQuestions) &&
    typeof o.pushback === "string"
  );
}

/** Create a draft rehearsal session and seed it with the audience's opening cue (e.g. "Begin whenever ready"). */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  let userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value ?? "";
  if (!userId) userId = randomUUID();

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
  const difficulty = obj.difficulty;
  const mode = obj.mode;
  const durationMin =
    typeof obj.durationMin === "number" && Number.isFinite(obj.durationMin)
      ? Math.max(5, Math.min(120, Math.round(obj.durationMin)))
      : 30;
  const plan = obj.plan;

  if (agenda.length < 10) return NextResponse.json({ error: "Missing agenda." }, { status: 400 });
  if (!isMeetingType(meetingType)) return NextResponse.json({ error: "Invalid meeting type." }, { status: 400 });
  if (!isAudienceId(audience)) return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
  if (!isRehearsalDifficulty(difficulty)) return NextResponse.json({ error: "Invalid difficulty." }, { status: 400 });
  if (!isRehearsalMode(mode)) return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  if (!looksLikePlan(plan)) return NextResponse.json({ error: "Plan shape is invalid." }, { status: 400 });

  await ensureUserProfile(userId);

  const sessionId = randomUUID();
  const now = Date.now();

  const manifest: MeetingRehearsalManifest = {
    kind: "meeting_rehearsal",
    agenda,
    meetingType,
    audience,
    difficulty,
    mode,
    durationMin,
    plan,
  };

  const opener =
    mode === "quick"
      ? `Five-minute quick prep. Hit your opener first — 30 seconds, top of the meeting.`
      : `Whenever you are ready, deliver your opening as if the meeting just started. I'll interject when something needs probing.`;

  const db = getDb();
  db.transaction((tx) => {
    tx.insert(practiceSession)
      .values({
        id: sessionId,
        userId,
        kind: "meeting_rehearsal_draft",
        title: meetingType === "presentation" ? "Presentation rehearsal" : "Meeting rehearsal",
        audioRelativePath: `uploads/${sessionId}.placeholder`,
        durationMs: null,
        createdAt: now,
        segmentsJson: JSON.stringify(manifest),
      })
      .run();
  });
  insertSimulationTurnSync({
    id: randomUUID(),
    sessionId,
    turnIndex: 0,
    role: "assistant",
    text: opener,
    audioRelativePath: null,
    durationMs: null,
  });

  const res = NextResponse.json({
    ok: true,
    userId,
    sessionId,
    opener,
    mode,
    durationMin,
  });
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  return res;
}
