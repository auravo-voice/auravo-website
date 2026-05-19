import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSessionScores, createSessionTranscript } from "@/db/queries/practice-persist";
import { isUuidLike } from "@/lib/util/is-uuid-like";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import {
  finalizeSimulationSession,
  getSimulationSession,
  listSimulationTurns,
} from "@/db/queries/simulations";
import { runAnalysis, serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import { TranscriptionUnavailableError } from "@/lib/transcription";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { getServerPocketBase } from "@/lib/pocketbase/server";
import { resolveAudioAbsolutePaths } from "@/lib/storage/audio-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;
  const userId = auth;

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
  if (session.kind === "simulation") {
    return NextResponse.json({ error: "Session is already finalized." }, { status: 409 });
  }
  if (session.kind !== "simulation_draft") {
    return NextResponse.json({ error: "Wrong session kind." }, { status: 409 });
  }

  const turns = await listSimulationTurns(sessionId);
  const userTurns = turns.filter((t) => t.role === "user");
  if (userTurns.length < 1) {
    return NextResponse.json({ error: "Record at least one turn before ending the simulation." }, { status: 400 });
  }
  const userTranscript = userTurns.map((t) => t.text).join("\n\n");
  const fullTranscript = turns
    .map((t) => `${t.role === "user" ? "You" : "Partner"}: ${t.text}`)
    .join("\n\n");

  const pb = await getServerPocketBase();
  const audioRefs = userTurns.map((t) => t.audioRelativePath).filter((p): p is string => p != null);
  const userAudioPaths = await resolveAudioAbsolutePaths(audioRefs, pb);
  const totalDurationMs = userTurns.reduce((a, t) => a + (t.durationMs ?? 0), 0) || null;

  let analysis;
  let degraded = false;
  try {
    analysis =
      userAudioPaths.length > 0
        ? await runAnalysis({
            audio: { mode: "concat", absolutePaths: userAudioPaths, totalDurationMs },
            conversation: {
              turns: turns.map((t) => ({
                role: t.role,
                text: t.text,
                durationMs: t.durationMs,
                createdAt: t.createdAt,
              })),
            },
            context: { userId, runCoachSummary: true },
          })
        : await runAnalysis({
            preTranscribed: { text: userTranscript, adapter: "simulation-fallback" },
            conversation: {
              turns: turns.map((t) => ({
                role: t.role,
                text: t.text,
                durationMs: t.durationMs,
                createdAt: t.createdAt,
              })),
            },
            context: { userId, runCoachSummary: true },
          });
  } catch (e) {
    if (!(e instanceof TranscriptionUnavailableError)) throw e;
    degraded = true;
    analysis = await runAnalysis({
      preTranscribed: { text: userTranscript, adapter: "simulation-fallback" },
      conversation: {
        turns: turns.map((t) => ({
          role: t.role,
          text: t.text,
          durationMs: t.durationMs,
          createdAt: t.createdAt,
        })),
      },
      context: { userId, runCoachSummary: true },
    });
  }

  await createSessionTranscript({
    sessionId,
    text: fullTranscript,
    adapter: analysis.adapter,
    analysisJson: serializeAnalysisForPersistence(analysis),
  });
  await createSessionScores({
    sessionId,
    pronunciation: analysis.scores.pronunciation,
    grammar: analysis.scores.grammar,
    fluency: analysis.scores.fluency,
    vocabulary: analysis.scores.vocabulary,
    fillerWords: analysis.scores.filler_words,
    pacing: analysis.scores.pacing,
  });

  await finalizeSimulationSession({
    sessionId,
    totalDurationMs,
    segmentsJson: JSON.stringify({
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
    recommendedExercises: analysis.candidateExercises,
    degraded,
  });
}
