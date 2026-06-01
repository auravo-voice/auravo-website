import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDataDir, getDb } from "@/db/client";
import { practiceSession, sessionScores, sessionTranscript } from "@/db/schema";
import { AURAVO_USER_ID_COOKIE } from "@/lib/auth/auravo-user-cookie";
import { isUuidLike } from "@/lib/util/is-uuid-like";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import {
  finalizeDraftSession,
  getSimulationSession,
  listSimulationTurns,
} from "@/db/queries/simulations";
import {
  buildRehearsalCoachNote,
  computeAgendaAlignment,
  type AgendaAlignment,
} from "@/lib/meeting-prep/feedback";
import type { MeetingPlan } from "@/lib/meeting-prep/types";
import { runAnalysis, serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import { TranscriptionUnavailableError } from "@/lib/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finalize a meeting rehearsal. The learner's per-turn audio is concatenated and run through the
 * canonical {@link runAnalysis} pipeline (Whisper timings + acoustic + VAD). On top we compute
 * deterministic agenda alignment and a short coach note that combines the audio-grounded scores with
 * the conversation-shape metrics (response latency, turn balance, etc.).
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value;
  if (!userId) {
    return NextResponse.json({ error: "No active session." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* tolerate empty body */
  }
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const sessionIdRaw = obj.sessionId;
  const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw.trim() : "";
  if (!isUuidLike(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId." }, { status: 400 });
  }
  const session = await getSimulationSession(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (session.userId !== userId) return NextResponse.json({ error: "Not your session." }, { status: 403 });
  if (session.kind === "meeting_rehearsal") {
    return NextResponse.json({ error: "Session is already finalized." }, { status: 409 });
  }
  if (session.kind !== "meeting_rehearsal_draft") {
    return NextResponse.json({ error: "Wrong session kind." }, { status: 409 });
  }

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
  const agenda = typeof manifest?.agenda === "string" ? manifest.agenda : "";
  const plan = (manifest?.plan ?? null) as MeetingPlan | null;

  const turns = await listSimulationTurns(sessionId);
  const userTurns = turns.filter((t) => t.role === "user");
  if (userTurns.length < 1) {
    return NextResponse.json({ error: "Speak at least one turn before ending the rehearsal." }, { status: 400 });
  }
  const userTranscript = userTurns.map((t) => t.text).join("\n\n");
  const fullTranscript = turns
    .map((t) => `${t.role === "user" ? "You" : "Audience"}: ${t.text}`)
    .join("\n\n");

  const dataDir = getDataDir();
  const userAudioPaths = userTurns
    .filter((t) => t.audioRelativePath != null)
    .map((t) => path.join(dataDir, t.audioRelativePath as string));
  const totalDurationMs = userTurns.reduce((a, t) => a + (t.durationMs ?? 0), 0) || null;

  const conversationInput = {
    turns: turns.map((t) => ({
      role: t.role,
      text: t.text,
      durationMs: t.durationMs,
      createdAt: t.createdAt,
    })),
  };

  let analysis;
  let degraded = false;
  try {
    analysis =
      userAudioPaths.length > 0
        ? await runAnalysis({
            audio: { mode: "concat", absolutePaths: userAudioPaths, totalDurationMs },
            conversation: conversationInput,
            context: { userId, runCoachSummary: true },
          })
        : await runAnalysis({
            preTranscribed: { text: userTranscript, adapter: "meeting-rehearsal-fallback" },
            conversation: conversationInput,
            context: { userId, runCoachSummary: true },
          });
  } catch (e) {
    if (!(e instanceof TranscriptionUnavailableError)) throw e;
    degraded = true;
    analysis = await runAnalysis({
      preTranscribed: { text: userTranscript, adapter: "meeting-rehearsal-fallback" },
      conversation: conversationInput,
      context: { userId, runCoachSummary: true },
    });
  }

  const alignment: AgendaAlignment = computeAgendaAlignment(agenda, userTranscript);
  const coachNote = buildRehearsalCoachNote({
    scores: analysis.scores,
    alignment,
    userTurns: userTurns.length,
    totalDurationMs,
  });

  // Persist analysis JSON augmented with meeting-prep-specific extras (agenda alignment + coach note)
  // so /api/meeting-prep readers keep working without a schema change.
  const persistedJson = JSON.parse(serializeAnalysisForPersistence(analysis));
  persistedJson.meetingPrep = {
    alignment,
    coach: coachNote,
    mode: manifest?.mode ?? "full",
    durationMin: manifest?.durationMin ?? null,
  };

  db.transaction((tx) => {
    tx.insert(sessionTranscript)
      .values({
        id: randomUUID(),
        sessionId,
        text: fullTranscript,
        adapter: analysis.adapter,
        analysisJson: JSON.stringify(persistedJson),
        createdAt: Date.now(),
      })
      .run();
    tx.insert(sessionScores)
      .values({
        id: randomUUID(),
        sessionId,
        pronunciation: analysis.scores.pronunciation,
        grammar: analysis.scores.grammar,
        fluency: analysis.scores.fluency,
        vocabulary: analysis.scores.vocabulary,
        fillerWords: analysis.scores.filler_words,
        pacing: analysis.scores.pacing,
        createdAt: Date.now(),
      })
      .run();
  });

  finalizeDraftSession({
    sessionId,
    targetKind: "meeting_rehearsal",
    totalDurationMs,
    segmentsJson: JSON.stringify({
      ...(manifest ?? {}),
      kind: "meeting_rehearsal",
      turns: turns.map((t) => ({
        index: t.turnIndex,
        role: t.role,
        text: t.text,
        audioRelativePath: t.audioRelativePath,
        durationMs: t.durationMs,
      })),
    }),
  });

  const dimensions = scoresToRadarDimensions(analysis.scores);
  const averageScore = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);

  return NextResponse.json({
    ok: true,
    sessionId,
    averageScore,
    dimensions,
    userTurns: userTurns.length,
    totalDurationMs,
    transcript: fullTranscript.slice(0, 12_000),
    analysis: analysis.deep,
    voiceAnalysis: {
      adapter: analysis.adapter,
      durationSec: analysis.durationSec,
      derivedMetrics: analysis.voice.derivedMetrics,
      explanations: analysis.voice.explanations,
      qualityFlags: analysis.voice.qualityFlags,
    },
    conversation: analysis.conversation,
    conversationCoachNotes: analysis.conversationCoachNotes,
    coachSummary: analysis.coachSummary,
    alignment,
    coach: coachNote,
    plan,
    recommendedExercises: analysis.candidateExercises,
    degraded,
  });
}
