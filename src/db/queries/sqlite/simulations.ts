import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { practiceSession, simulationTurn } from "@/db/schema";

export type SimulationTurnRow = {
  id: string;
  turnIndex: number;
  role: "user" | "assistant";
  text: string;
  audioRelativePath: string | null;
  durationMs: number | null;
  createdAt: number;
};

export async function listSimulationTurns(sessionId: string): Promise<SimulationTurnRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(simulationTurn)
    .where(eq(simulationTurn.sessionId, sessionId))
    .orderBy(asc(simulationTurn.turnIndex));
  return rows.map((r) => ({
    id: r.id,
    turnIndex: r.turnIndex,
    role: r.role === "assistant" ? "assistant" : "user",
    text: r.text,
    audioRelativePath: r.audioRelativePath,
    durationMs: r.durationMs,
    createdAt: r.createdAt,
  }));
}

export async function getSimulationSession(sessionId: string): Promise<{
  userId: string;
  kind: string;
  title: string | null;
  segmentsJson: string | null;
  createdAt: number;
} | null> {
  const db = getDb();
  const rows = await db
    .select({
      userId: practiceSession.userId,
      kind: practiceSession.kind,
      title: practiceSession.title,
      segmentsJson: practiceSession.segmentsJson,
      createdAt: practiceSession.createdAt,
    })
    .from(practiceSession)
    .where(eq(practiceSession.id, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

export function insertSimulationTurnSync(input: {
  id: string;
  sessionId: string;
  turnIndex: number;
  role: "user" | "assistant";
  text: string;
  audioRelativePath: string | null;
  durationMs: number | null;
}): void {
  const db = getDb();
  db.insert(simulationTurn)
    .values({
      id: input.id,
      sessionId: input.sessionId,
      turnIndex: input.turnIndex,
      role: input.role,
      text: input.text,
      audioRelativePath: input.audioRelativePath,
      durationMs: input.durationMs,
      createdAt: Date.now(),
    })
    .run();
}

/** Async alias for routes that `await` persistence. */
export async function insertSimulationTurn(
  input: Parameters<typeof insertSimulationTurnSync>[0],
): Promise<string> {
  insertSimulationTurnSync(input);
  return input.id;
}

export async function finalizeSimulationSession(input: {
  sessionId: string;
  totalDurationMs: number | null;
  segmentsJson: string;
}): Promise<void> {
  finalizeDraftSession({
    sessionId: input.sessionId,
    targetKind: "simulation",
    totalDurationMs: input.totalDurationMs,
    segmentsJson: input.segmentsJson,
  });
}

export function finalizeDraftSession(input: {
  sessionId: string;
  targetKind: string;
  totalDurationMs: number | null;
  segmentsJson: string;
}): void {
  const db = getDb();
  db.update(practiceSession)
    .set({
      kind: input.targetKind,
      durationMs: input.totalDurationMs,
      segmentsJson: input.segmentsJson,
    })
    .where(eq(practiceSession.id, input.sessionId))
    .run();
}
