import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDataDir, getDb } from "@/db/client";
import {
  onboardingBaseline,
  practiceSession,
  sessionScores,
  sessionTranscript,
} from "@/db/schema";

export type CreatePracticeSessionInput = {
  id?: string;
  userId: string;
  kind: string;
  title?: string | null;
  durationMs?: number | null;
  segmentsJson?: string | null;
  audioRelativePath?: string;
  audioFile?: File | Blob | null;
};

/** Creates a practice session row; saves optional audio under `data/uploads/`. */
export async function createPracticeSession(input: CreatePracticeSessionInput): Promise<string> {
  const db = getDb();
  const id = input.id ?? randomUUID();
  const dataDir = getDataDir();
  let audioRelativePath = input.audioRelativePath?.trim() ?? "";

  if (input.audioFile) {
    const ext = input.audioFile.type?.includes("mp4") ? "m4a" : "webm";
    audioRelativePath = path.join("uploads", `${id}.${ext}`).split(path.sep).join("/");
    await fs.mkdir(path.join(dataDir, "uploads"), { recursive: true });
    const buf = Buffer.from(await input.audioFile.arrayBuffer());
    await fs.writeFile(path.join(dataDir, audioRelativePath), buf);
  }

  if (!audioRelativePath) {
    audioRelativePath = "uploads/placeholder.webm";
  }

  db.insert(practiceSession)
    .values({
      id,
      userId: input.userId,
      kind: input.kind,
      title: input.title ?? null,
      audioRelativePath,
      durationMs: input.durationMs ?? null,
      segmentsJson: input.segmentsJson ?? null,
      createdAt: Date.now(),
    })
    .run();

  return id;
}

export async function createSessionTranscript(input: {
  sessionId: string;
  text: string;
  adapter: string;
  analysisJson: string;
}): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  db.insert(sessionTranscript)
    .values({
      id,
      sessionId: input.sessionId,
      text: input.text,
      adapter: input.adapter,
      analysisJson: input.analysisJson,
      createdAt: Date.now(),
    })
    .run();
  return id;
}

export async function createSessionScores(input: {
  sessionId: string;
  pronunciation: number;
  grammar: number;
  fluency: number;
  vocabulary: number;
  fillerWords: number;
  pacing: number;
}): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  db.insert(sessionScores)
    .values({
      id,
      sessionId: input.sessionId,
      pronunciation: input.pronunciation,
      grammar: input.grammar,
      fluency: input.fluency,
      vocabulary: input.vocabulary,
      fillerWords: input.fillerWords,
      pacing: input.pacing,
      createdAt: Date.now(),
    })
    .run();
  return id;
}

export async function createOnboardingBaseline(userId: string, sessionId: string): Promise<void> {
  const db = getDb();
  const existing = await db
    .select()
    .from(onboardingBaseline)
    .where(eq(onboardingBaseline.userId, userId))
    .limit(1);
  if (existing[0]) {
    db.update(onboardingBaseline)
      .set({ sessionId })
      .where(eq(onboardingBaseline.userId, userId))
      .run();
    return;
  }
  db.insert(onboardingBaseline)
    .values({
      userId,
      sessionId,
      createdAt: Date.now(),
    })
    .run();
}

export async function updatePracticeSession(
  sessionId: string,
  patch: {
    kind?: string;
    durationMs?: number | null;
    segmentsJson?: string | null;
    title?: string | null;
    audioRelativePath?: string;
  },
): Promise<void> {
  const db = getDb();
  db.update(practiceSession)
    .set({
      ...(patch.kind != null ? { kind: patch.kind } : {}),
      ...(patch.durationMs !== undefined ? { durationMs: patch.durationMs } : {}),
      ...(patch.segmentsJson !== undefined ? { segmentsJson: patch.segmentsJson } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.audioRelativePath != null ? { audioRelativePath: patch.audioRelativePath } : {}),
    })
    .where(eq(practiceSession.id, sessionId))
    .run();
}
