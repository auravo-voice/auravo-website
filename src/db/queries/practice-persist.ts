import "server-only";

import type PocketBase from "pocketbase";
import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";

export type CreatePracticeSessionInput = {
  id: string;
  userId: string;
  kind: string;
  title?: string | null;
  durationMs?: number | null;
  segmentsJson?: string | null;
  audioFile?: File | Blob | null;
};

export async function createPracticeSession(
  input: CreatePracticeSessionInput,
  pb?: PocketBase,
): Promise<void> {
  const client = pb ?? (await getServerPocketBase());
  const body: Record<string, unknown> = {
    id: input.id,
    user: input.userId,
    kind: input.kind,
    title: input.title ?? null,
    duration_ms: input.durationMs ?? null,
    segments_json: input.segmentsJson ?? null,
  };
  const files: Record<string, File | Blob> = {};
  if (input.audioFile) files.audio = input.audioFile;
  await client.collection(PB.practiceSessions).create(
    body,
    Object.keys(files).length ? { files } : undefined,
  );
}

export async function createSessionTranscript(input: {
  id: string;
  sessionId: string;
  text: string;
  adapter: string;
  analysisJson: string;
}): Promise<void> {
  const pb = await getServerPocketBase();
  await pb.collection(PB.sessionTranscripts).create({
    id: input.id,
    session: input.sessionId,
    text: input.text,
    adapter: input.adapter,
    analysis_json: input.analysisJson,
  });
}

export async function createSessionScores(input: {
  id: string;
  sessionId: string;
  pronunciation: number;
  grammar: number;
  fluency: number;
  vocabulary: number;
  fillerWords: number;
  pacing: number;
}): Promise<void> {
  const pb = await getServerPocketBase();
  await pb.collection(PB.sessionScores).create({
    id: input.id,
    session: input.sessionId,
    pronunciation: input.pronunciation,
    grammar: input.grammar,
    fluency: input.fluency,
    vocabulary: input.vocabulary,
    filler_words: input.fillerWords,
    pacing: input.pacing,
  });
}

export async function createOnboardingBaseline(userId: string, sessionId: string): Promise<void> {
  const pb = await getServerPocketBase();
  try {
    await pb.collection(PB.onboardingBaselines).getFirstListItem(`user = "${userId}"`);
    await pb.collection(PB.onboardingBaselines).update(
      (await pb.collection(PB.onboardingBaselines).getFirstListItem(`user = "${userId}"`)).id,
      { session: sessionId },
    );
  } catch {
    await pb.collection(PB.onboardingBaselines).create({
      user: userId,
      session: sessionId,
    });
  }
}

export async function updatePracticeSession(
  sessionId: string,
  patch: Record<string, unknown>,
  pb?: PocketBase,
): Promise<void> {
  const client = pb ?? (await getServerPocketBase());
  await client.collection(PB.practiceSessions).update(sessionId, patch);
}
