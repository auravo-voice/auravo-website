import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDataDir, getDb } from "@/db/client";
import { practiceSession } from "@/db/schema";
import { AURAVO_USER_ID_COOKIE } from "@/lib/auth/auravo-user-cookie";
import { isUuidLike } from "@/lib/util/is-uuid-like";
import { getTranscriptionAdapter } from "@/lib/transcription";
import {
  getSimulationSession,
  insertSimulationTurnSync,
  listSimulationTurns,
} from "@/db/queries/simulations";
import { generateRehearsalReply } from "@/lib/meeting-prep/turn-coach";
import {
  isAudienceId,
  isMeetingType,
  isRehearsalDifficulty,
  isRehearsalMode,
  type MeetingPlan,
  type MeetingPrepContext,
} from "@/lib/meeting-prep/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records one user turn during a meeting rehearsal and produces the AI audience's reaction (question / pushback /
 * continue). Mirrors the simulations turn handler but uses the rehearsal persona built from the agenda + plan.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value;
  if (!userId) {
    return NextResponse.json({ error: "No active session." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const sessionIdRaw = form.get("sessionId");
  const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw.trim() : "";
  if (!isUuidLike(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId." }, { status: 400 });
  }
  const session = await getSimulationSession(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (session.userId !== userId) return NextResponse.json({ error: "Not your session." }, { status: 403 });
  if (session.kind !== "meeting_rehearsal_draft") {
    return NextResponse.json({ error: "Session is not an open rehearsal draft." }, { status: 409 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }
  const durationRaw = form.get("durationMs");
  const durationMs =
    typeof durationRaw === "string" && durationRaw.trim() !== "" ? Number.parseInt(durationRaw, 10) : NaN;

  const turnAudioId = randomUUID();
  const dataDir = getDataDir();
  const uploadsDir = path.join(dataDir, "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const relativePath = path
    .join("uploads", `${sessionId}.turn-${turnAudioId}.${ext}`)
    .split(path.sep)
    .join("/");
  const absolutePath = path.join(dataDir, relativePath);
  const buf = Buffer.from(await audio.arrayBuffer());
  await fs.writeFile(absolutePath, buf);

  let userText = "";
  try {
    const adapter = getTranscriptionAdapter();
    const tr = await adapter.transcribe(absolutePath);
    userText = tr.text;
  } catch {
    userText = "";
  }
  if (!userText.trim()) {
    userText = "(unclear audio — could not transcribe)";
  }

  const existing = await listSimulationTurns(sessionId);
  const nextIndex = existing.length;
  insertSimulationTurnSync({
    id: randomUUID(),
    sessionId,
    turnIndex: nextIndex,
    role: "user",
    text: userText,
    audioRelativePath: relativePath,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
  });

  // Refresh audio_relative_path on the first user turn so legacy joins have something useful.
  if (nextIndex <= 1) {
    const db = getDb();
    db.update(practiceSession)
      .set({ audioRelativePath: relativePath })
      .where(eq(practiceSession.id, sessionId))
      .run();
  }

  // Pull the rehearsal manifest stored at /start time.
  const db = getDb();
  const rows = await db
    .select({ segmentsJson: practiceSession.segmentsJson })
    .from(practiceSession)
    .where(eq(practiceSession.id, sessionId))
    .limit(1);
  let manifest: Record<string, unknown> | null = null;
  try {
    manifest = rows[0]?.segmentsJson ? (JSON.parse(rows[0].segmentsJson) as Record<string, unknown>) : null;
  } catch {
    manifest = null;
  }
  if (!manifest) {
    return NextResponse.json({ error: "Rehearsal manifest is missing." }, { status: 500 });
  }
  if (
    !isMeetingType(manifest.meetingType) ||
    !isAudienceId(manifest.audience) ||
    !isRehearsalDifficulty(manifest.difficulty) ||
    !isRehearsalMode(manifest.mode) ||
    typeof manifest.agenda !== "string" ||
    typeof manifest.durationMin !== "number" ||
    !manifest.plan ||
    typeof manifest.plan !== "object"
  ) {
    return NextResponse.json({ error: "Rehearsal manifest is malformed." }, { status: 500 });
  }
  const ctx: MeetingPrepContext = {
    agenda: manifest.agenda,
    meetingType: manifest.meetingType,
    audience: manifest.audience,
    difficulty: manifest.difficulty,
    mode: manifest.mode,
    durationMin: manifest.durationMin,
  };
  const plan = manifest.plan as MeetingPlan;

  // Skip the opening assistant cue when building chat history so it doesn't bias replies.
  const history = existing
    .filter((t) => !(t.turnIndex === 0 && t.role === "assistant"))
    .map((t) => ({ role: t.role, text: t.text }));

  const { reply: assistantText, kind: replyKind, warning } = await generateRehearsalReply({
    ctx,
    plan,
    history,
    userTurn: userText,
    turnIndex: nextIndex,
  });

  insertSimulationTurnSync({
    id: randomUUID(),
    sessionId,
    turnIndex: nextIndex + 1,
    role: "assistant",
    text: assistantText,
    audioRelativePath: null,
    durationMs: null,
  });

  return NextResponse.json({
    ok: true,
    sessionId,
    userTurn: { index: nextIndex, text: userText, audioRelativePath: relativePath },
    assistantTurn: { index: nextIndex + 1, text: assistantText, kind: replyKind },
    coachWarning: warning,
  });
}
