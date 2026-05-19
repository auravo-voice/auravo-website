import "server-only";

import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";
import { pbTs } from "@/db/pocketbase-map";
import { pocketBaseFileUrl } from "@/lib/storage/audio-path";

export type SimulationTurnRow = {
  id: string;
  turnIndex: number;
  role: "user" | "assistant";
  text: string;
  audioRelativePath: string | null;
  durationMs: number | null;
  createdAt: number;
};

function turnAudioRef(record: { id: string; audio?: string }): string | null {
  const file = typeof record.audio === "string" ? record.audio : "";
  if (!file) return null;
  return pocketBaseFileUrl(PB.simulationTurns, record.id, file);
}

export async function listSimulationTurns(sessionId: string): Promise<SimulationTurnRow[]> {
  const pb = await getServerPocketBase();
  const rows = await pb.collection(PB.simulationTurns).getFullList({
    filter: `session = "${sessionId}"`,
    sort: "turn_index",
  });
  return rows.map((r) => ({
    id: r.id,
    turnIndex: Number(r.turn_index),
    role: r.role === "assistant" ? "assistant" : "user",
    text: String(r.text),
    audioRelativePath: turnAudioRef(r as { id: string; audio?: string }),
    durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
    createdAt: pbTs(r),
  }));
}

export async function getSimulationSession(sessionId: string): Promise<{
  userId: string;
  kind: string;
  title: string | null;
  segmentsJson: string | null;
  createdAt: number;
} | null> {
  const pb = await getServerPocketBase();
  try {
    const row = await pb.collection(PB.practiceSessions).getOne(sessionId);
    const userId = typeof row.user === "string" ? row.user : null;
    if (!userId) return null;
    return {
      userId,
      kind: String(row.kind),
      title: typeof row.title === "string" ? row.title : null,
      segmentsJson: typeof row.segments_json === "string" ? row.segments_json : null,
      createdAt: pbTs(row),
    };
  } catch {
    return null;
  }
}

export async function insertSimulationTurn(input: {
  id: string;
  sessionId: string;
  turnIndex: number;
  role: "user" | "assistant";
  text: string;
  audioRelativePath: string | null;
  durationMs: number | null;
  audioFile?: File | Blob | null;
}): Promise<void> {
  const pb = await getServerPocketBase();
  const body: Record<string, unknown> = {
    id: input.id,
    session: input.sessionId,
    turn_index: input.turnIndex,
    role: input.role,
    text: input.text,
    duration_ms: input.durationMs,
  };
  const files: Record<string, File | Blob> = {};
  if (input.audioFile) {
    files.audio = input.audioFile;
  }
  await pb.collection(PB.simulationTurns).create(body, Object.keys(files).length ? { files } : undefined);
}

/** @deprecated Sync alias — calls async insert. */
export function insertSimulationTurnSync(input: Parameters<typeof insertSimulationTurn>[0]): void {
  void insertSimulationTurn(input);
}

export async function finalizeSimulationSession(input: {
  sessionId: string;
  totalDurationMs: number | null;
  segmentsJson: string;
}): Promise<void> {
  await finalizeDraftSession({
    sessionId: input.sessionId,
    targetKind: "simulation",
    totalDurationMs: input.totalDurationMs,
    segmentsJson: input.segmentsJson,
  });
}

export async function finalizeDraftSession(input: {
  sessionId: string;
  targetKind: string;
  totalDurationMs: number | null;
  segmentsJson: string;
}): Promise<void> {
  const pb = await getServerPocketBase();
  await pb.collection(PB.practiceSessions).update(input.sessionId, {
    kind: input.targetKind,
    duration_ms: input.totalDurationMs,
    segments_json: input.segmentsJson,
  });
}
