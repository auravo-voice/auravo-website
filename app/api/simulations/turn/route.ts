import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUuidLike } from "@/lib/util/is-uuid-like";
import { getTranscriptionAdapter } from "@/lib/transcription";
import {
  getSimulationSession,
  insertSimulationTurn,
  listSimulationTurns,
} from "@/db/queries/simulations";
import {
  generateSimulationReply,
  type SimulationTranscriptTurn,
} from "@/lib/simulations/turn-coach";
import {
  getScenarioById,
  isDifficulty,
  type Difficulty,
  type Scenario,
} from "@/lib/simulations/library";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolvePersonaContext(
  segmentsJson: string | null,
): { scenario: Scenario; difficulty: Difficulty } | { error: string } {
  if (!segmentsJson) return { error: "Simulation manifest is missing." };
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(segmentsJson) as Record<string, unknown>;
  } catch {
    return { error: "Could not parse simulation manifest." };
  }
  const difficultyRaw = manifest.difficulty;
  if (!isDifficulty(difficultyRaw)) return { error: "Invalid difficulty on session." };
  const difficulty = difficultyRaw;
  if (manifest.scenarioId === "custom" && manifest.custom && typeof manifest.custom === "object") {
    const c = manifest.custom as Record<string, unknown>;
    const title = typeof c.title === "string" ? c.title : "Custom practice scenario";
    const description = typeof c.description === "string" ? c.description : "";
    const personaName = typeof c.personaName === "string" ? c.personaName : "your partner";
    const personaSummary =
      typeof c.personaSummary === "string"
        ? c.personaSummary
        : "You play a realistic conversation partner described by the learner.";
    const opener = typeof c.opener === "string" ? c.opener : "";
    const topics = Array.isArray(c.topics)
      ? (c.topics.filter((t) => typeof t === "string") as string[])
      : [];
    const scenario: Scenario = {
      id: "custom",
      title,
      description,
      category: "interview",
      recommendedMinutes: { min: 3, max: 8 },
      personaName,
      personaSummary,
      opener,
      topics,
    };
    return { scenario, difficulty };
  }
  if (typeof manifest.scenarioId !== "string") return { error: "Invalid scenarioId on session." };
  const scenario = getScenarioById(manifest.scenarioId);
  if (!scenario) return { error: "Unknown scenarioId on session." };
  return { scenario, difficulty };
}

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
  if (session.kind !== "simulation_draft") {
    return NextResponse.json({ error: "Session is already finalized." }, { status: 409 });
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
    sessionId,
    turnIndex: nextIndex,
    role: "user",
    text: userText,
    audioRelativePath: relativePath,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    audioFile: audio,
  });

  const personaResolution = resolvePersonaContext(session.segmentsJson);
  if ("error" in personaResolution) {
    return NextResponse.json({ error: personaResolution.error }, { status: 500 });
  }
  const history: SimulationTranscriptTurn[] = existing.map((t) => ({ role: t.role, text: t.text }));

  const { reply: assistantText, warning } = await generateSimulationReply({
    scenario: personaResolution.scenario,
    difficulty: personaResolution.difficulty,
    history,
    userTurn: userText,
  });

  await insertSimulationTurn({
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
    assistantTurn: { index: nextIndex + 1, text: assistantText },
    coachWarning: warning,
  });
}
