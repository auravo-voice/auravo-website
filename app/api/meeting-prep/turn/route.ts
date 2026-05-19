import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUuidLike } from "@/lib/util/is-uuid-like";
import { getTranscriptionAdapter } from "@/lib/transcription";
import {
  getSimulationSession,
  insertSimulationTurn,
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
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;
  const userId = auth;

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
  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const { absolutePath, relativePath } = await writeTempAudioFile(
    `${sessionId}.turn-${turnAudioId}`,
    audio,
    ext,
  );

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
  await insertSimulationTurn({
    id: randomUUID(),
    sessionId,
    turnIndex: nextIndex,
    role: "user",
    text: userText,
    audioRelativePath: relativePath,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    audioFile: audio,
  });

  let manifest: Record<string, unknown> | null = null;
  try {
    manifest = session.segmentsJson ? (JSON.parse(session.segmentsJson) as Record<string, unknown>) : null;
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

  await insertSimulationTurn({
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
