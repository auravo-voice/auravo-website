import "server-only";

import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";
import { pbTs } from "@/db/pocketbase-map";
import { pocketBaseFileUrl } from "@/lib/storage/audio-path";
import {
  isMissingPocketBaseCollection,
  POCKETBASE_WEB_COLLECTIONS_HINT,
} from "@/lib/pocketbase/errors";
import type { AssessmentSegmentKind } from "@/lib/assessment/segments";

export type DraftSegmentRow = {
  segmentKind: AssessmentSegmentKind;
  audioRelativePath: string;
  durationMs: number | null;
  transcript: string | null;
  createdAt: number;
};

const SEGMENT_KINDS: AssessmentSegmentKind[] = ["passage", "open_q1", "open_q2", "visual"];

function segmentAudioRef(record: { id: string; audio?: string }): string {
  const file = typeof record.audio === "string" ? record.audio : "";
  if (!file) return "";
  return pocketBaseFileUrl(PB.baselineSegments, record.id, file);
}

function rethrowIfNotMissingCollection(error: unknown): never {
  if (isMissingPocketBaseCollection(error)) {
    throw new Error(`${POCKETBASE_WEB_COLLECTIONS_HINT} (collection: ${PB.baselineSegments})`);
  }
  throw error;
}

export async function listDraftSegments(userId: string): Promise<DraftSegmentRow[]> {
  const pb = await getServerPocketBase();
  try {
    const rows = await pb.collection(PB.baselineSegments).getFullList({
      filter: `user = "${userId}" && (session = "" || session = null)`,
    });
    return rows
      .filter((r) => SEGMENT_KINDS.includes(r.segment_kind as AssessmentSegmentKind))
      .map((r) => ({
        segmentKind: r.segment_kind as AssessmentSegmentKind,
        audioRelativePath: segmentAudioRef(r as { id: string; audio?: string }),
        durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
        transcript: typeof r.transcript === "string" ? r.transcript : null,
        createdAt: pbTs(r),
      }));
  } catch (error) {
    if (isMissingPocketBaseCollection(error)) {
      console.warn(`[baseline_segments] ${POCKETBASE_WEB_COLLECTIONS_HINT}`);
      return [];
    }
    throw error;
  }
}

export async function replaceDraftSegment(input: {
  id: string;
  userId: string;
  segmentKind: AssessmentSegmentKind;
  audioRelativePath: string;
  durationMs: number | null;
  transcript: string | null;
  audioFile?: File | Blob;
}): Promise<void> {
  const pb = await getServerPocketBase();
  try {
    const existing = await pb.collection(PB.baselineSegments).getFullList({
      filter: `user = "${input.userId}" && segment_kind = "${input.segmentKind}" && (session = "" || session = null)`,
    });
    for (const row of existing) {
      await pb.collection(PB.baselineSegments).delete(row.id);
    }
    const files: Record<string, File | Blob> = {};
    if (input.audioFile) files.audio = input.audioFile;
    await pb.collection(PB.baselineSegments).create(
      {
        id: input.id,
        user: input.userId,
        segment_kind: input.segmentKind,
        duration_ms: input.durationMs,
        transcript: input.transcript,
        session: "",
      },
      Object.keys(files).length ? { files } : undefined,
    );
  } catch (error) {
    rethrowIfNotMissingCollection(error);
  }
}

export async function attachDraftSegmentsToSession(userId: string, sessionId: string): Promise<void> {
  const pb = await getServerPocketBase();
  try {
    const rows = await pb.collection(PB.baselineSegments).getFullList({
      filter: `user = "${userId}" && (session = "" || session = null)`,
    });
    for (const row of rows) {
      await pb.collection(PB.baselineSegments).update(row.id, { session: sessionId });
    }
  } catch (error) {
    rethrowIfNotMissingCollection(error);
  }
}

export async function clearDraftSegments(userId: string): Promise<void> {
  const pb = await getServerPocketBase();
  try {
    const rows = await pb.collection(PB.baselineSegments).getFullList({
      filter: `user = "${userId}" && (session = "" || session = null)`,
    });
    for (const row of rows) {
      await pb.collection(PB.baselineSegments).delete(row.id);
    }
  } catch (error) {
    if (isMissingPocketBaseCollection(error)) return;
    throw error;
  }
}
