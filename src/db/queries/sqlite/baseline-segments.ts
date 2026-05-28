import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { baselineSegment } from "@/db/schema";
import type { AssessmentSegmentKind } from "@/lib/assessment/segments";

export type DraftSegmentRow = {
  segmentKind: AssessmentSegmentKind;
  audioRelativePath: string;
  durationMs: number | null;
  transcript: string | null;
  createdAt: number;
};

/** All in-progress segments for this learner (session_id IS NULL). */
export async function listDraftSegments(userId: string): Promise<DraftSegmentRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      segmentKind: baselineSegment.segmentKind,
      audioRelativePath: baselineSegment.audioRelativePath,
      durationMs: baselineSegment.durationMs,
      transcript: baselineSegment.transcript,
      createdAt: baselineSegment.createdAt,
    })
    .from(baselineSegment)
    .where(and(eq(baselineSegment.userId, userId), isNull(baselineSegment.sessionId)));
  return rows
    .filter(
      (r): r is DraftSegmentRow =>
        r.segmentKind === "passage" ||
        r.segmentKind === "open_q1" ||
        r.segmentKind === "open_q2" ||
        r.segmentKind === "visual",
    )
    .map((r) => ({ ...r, segmentKind: r.segmentKind as AssessmentSegmentKind }));
}

/** Overwrites any existing draft segment of the same kind (re-record case). */
export function replaceDraftSegment(input: {
  id: string;
  userId: string;
  segmentKind: AssessmentSegmentKind;
  audioRelativePath: string;
  durationMs: number | null;
  transcript: string | null;
}): void {
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(baselineSegment)
      .where(
        and(
          eq(baselineSegment.userId, input.userId),
          eq(baselineSegment.segmentKind, input.segmentKind),
          isNull(baselineSegment.sessionId),
        ),
      )
      .run();
    tx.insert(baselineSegment)
      .values({
        id: input.id,
        userId: input.userId,
        segmentKind: input.segmentKind,
        audioRelativePath: input.audioRelativePath,
        durationMs: input.durationMs,
        transcript: input.transcript,
        sessionId: null,
        createdAt: Date.now(),
      })
      .run();
  });
}

/** Mark all draft segments for this user as belonging to the freshly-created practice_session. */
export function attachDraftSegmentsToSession(userId: string, sessionId: string): void {
  const db = getDb();
  db.update(baselineSegment)
    .set({ sessionId })
    .where(and(eq(baselineSegment.userId, userId), isNull(baselineSegment.sessionId)))
    .run();
}

/** Wipe any in-progress segments (e.g. learner taps "Start over"). */
export function clearDraftSegments(userId: string): void {
  const db = getDb();
  db.delete(baselineSegment)
    .where(and(eq(baselineSegment.userId, userId), isNull(baselineSegment.sessionId)))
    .run();
}
