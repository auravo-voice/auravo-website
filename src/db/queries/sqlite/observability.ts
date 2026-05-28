import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { practiceSession, recordingReview, sessionScores, sessionTranscript, userProfile } from "@/db/schema";

const OBSERVABILITY_KINDS = [
  "onboarding_assessment",
  "daily_practice",
  "simulation",
  "simulation_draft",
  "meeting_rehearsal",
  "meeting_rehearsal_draft",
] as const;

export type ExpectedSimilarity = "similar" | "partially_similar" | "not_similar" | "unknown";

export type ObservabilitySessionRow = {
  sessionId: string;
  userId: string;
  displayName: string;
  kind: string;
  createdAt: number;
  durationMs: number | null;
  hasAudio: boolean;
  hasTranscript: boolean;
  transcriptChars: number;
  adapter: string | null;
  scoresAverage: number | null;
  degraded: boolean;
  coachFallbackUsed: boolean;
  wpm: number | null;
  fillerPerMinute: number | null;
  longPauseCount: number | null;
  pauseCount: number | null;
  asrConfidenceMean: number | null;
  review: {
    expectedSimilarity: ExpectedSimilarity;
    note: string;
    reviewerUserId: string;
    updatedAt: number;
  } | null;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseAnalysis(analysisJson: string | null): {
  degraded: boolean;
  coachFallbackUsed: boolean;
  wpm: number | null;
  fillerPerMinute: number | null;
  longPauseCount: number | null;
  pauseCount: number | null;
  asrConfidenceMean: number | null;
} {
  if (!analysisJson?.trim()) {
    return {
      degraded: false,
      coachFallbackUsed: false,
      wpm: null,
      fillerPerMinute: null,
      longPauseCount: null,
      pauseCount: null,
      asrConfidenceMean: null,
    };
  }
  try {
    const o = JSON.parse(analysisJson) as Record<string, unknown>;
    const voice = (o.voiceAnalysis ?? {}) as Record<string, unknown>;
    const dm = (voice.derivedMetrics ?? {}) as Record<string, unknown>;
    const asr = (voice.asrConfidence ?? {}) as Record<string, unknown>;
    const coach = (o.coachSummary ?? {}) as Record<string, unknown>;
    return {
      degraded: o.degraded === true,
      coachFallbackUsed: coach.fallbackUsed === true,
      wpm: num(dm.wpm),
      fillerPerMinute: num(dm.fillerRatePerMin),
      longPauseCount: num(dm.longPauseCount),
      pauseCount: num(dm.pauseCount),
      asrConfidenceMean: num(asr.mean),
    };
  } catch {
    return {
      degraded: false,
      coachFallbackUsed: false,
      wpm: null,
      fillerPerMinute: null,
      longPauseCount: null,
      pauseCount: null,
      asrConfidenceMean: null,
    };
  }
}

function asExpectedSimilarity(v: string | null | undefined): ExpectedSimilarity {
  if (v === "similar" || v === "partially_similar" || v === "not_similar" || v === "unknown") return v;
  return "unknown";
}

function averageScores(row: {
  pronunciation: number | null;
  grammar: number | null;
  fluency: number | null;
  vocabulary: number | null;
  fillerWords: number | null;
  pacing: number | null;
}): number | null {
  const vals = [
    row.pronunciation,
    row.grammar,
    row.fluency,
    row.vocabulary,
    row.fillerWords,
    row.pacing,
  ];
  const nums = vals.filter((v): v is number => typeof v === "number");
  if (nums.length !== vals.length) return null;
  const total = nums.reduce((a, b) => a + b, 0);
  return Math.round(total / nums.length);
}

export async function listObservabilitySessions(limit = 100): Promise<ObservabilitySessionRow[]> {
  const db = getDb();
  const cap = Math.max(10, Math.min(limit, 500));
  const rows = await db
    .select({
      sessionId: practiceSession.id,
      userId: practiceSession.userId,
      displayName: userProfile.displayName,
      kind: practiceSession.kind,
      createdAt: practiceSession.createdAt,
      durationMs: practiceSession.durationMs,
      audioRelativePath: practiceSession.audioRelativePath,
      transcript: sessionTranscript.text,
      adapter: sessionTranscript.adapter,
      analysisJson: sessionTranscript.analysisJson,
      pronunciation: sessionScores.pronunciation,
      grammar: sessionScores.grammar,
      fluency: sessionScores.fluency,
      vocabulary: sessionScores.vocabulary,
      fillerWords: sessionScores.fillerWords,
      pacing: sessionScores.pacing,
      reviewExpectedSimilarity: recordingReview.expectedSimilarity,
      reviewNote: recordingReview.note,
      reviewUpdatedAt: recordingReview.updatedAt,
      reviewerUserId: recordingReview.reviewerUserId,
    })
    .from(practiceSession)
    .innerJoin(userProfile, eq(userProfile.id, practiceSession.userId))
    .leftJoin(sessionTranscript, eq(sessionTranscript.sessionId, practiceSession.id))
    .leftJoin(sessionScores, eq(sessionScores.sessionId, practiceSession.id))
    .leftJoin(recordingReview, eq(recordingReview.sessionId, practiceSession.id))
    .where(inArray(practiceSession.kind, OBSERVABILITY_KINDS as unknown as string[]))
    .orderBy(desc(practiceSession.createdAt))
    .limit(cap);

  return rows.map((r) => {
    const parsed = parseAnalysis(r.analysisJson);
    return {
      sessionId: r.sessionId,
      userId: r.userId,
      displayName: r.displayName,
      kind: r.kind,
      createdAt: r.createdAt,
      durationMs: r.durationMs,
      hasAudio: Boolean(r.audioRelativePath),
      hasTranscript: Boolean(r.transcript?.trim()),
      transcriptChars: r.transcript?.length ?? 0,
      adapter: r.adapter ?? null,
      scoresAverage: averageScores(r),
      degraded: parsed.degraded,
      coachFallbackUsed: parsed.coachFallbackUsed,
      wpm: parsed.wpm,
      fillerPerMinute: parsed.fillerPerMinute,
      longPauseCount: parsed.longPauseCount,
      pauseCount: parsed.pauseCount,
      asrConfidenceMean: parsed.asrConfidenceMean,
      review:
        r.reviewExpectedSimilarity != null && r.reviewerUserId != null && r.reviewUpdatedAt != null
          ? {
              expectedSimilarity: asExpectedSimilarity(r.reviewExpectedSimilarity),
              note: r.reviewNote ?? "",
              reviewerUserId: r.reviewerUserId,
              updatedAt: r.reviewUpdatedAt,
            }
          : null,
    };
  });
}

export async function upsertRecordingReview(input: {
  sessionId: string;
  reviewerUserId: string;
  expectedSimilarity: ExpectedSimilarity;
  note: string;
}): Promise<void> {
  const db = getDb();
  const now = Date.now();

  const owner = await db
    .select({ userId: practiceSession.userId })
    .from(practiceSession)
    .where(eq(practiceSession.id, input.sessionId))
    .limit(1);
  if (!owner[0]) throw new Error("Unknown session id.");

  // Keep this lightweight: signed-in users can annotate any row in this local dashboard.
  await db
    .insert(recordingReview)
    .values({
      sessionId: input.sessionId,
      reviewerUserId: input.reviewerUserId,
      expectedSimilarity: input.expectedSimilarity,
      note: input.note.slice(0, 1200),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: recordingReview.sessionId,
      set: {
        expectedSimilarity: input.expectedSimilarity,
        note: input.note.slice(0, 1200),
        reviewerUserId: input.reviewerUserId,
        updatedAt: now,
      },
      where: and(eq(recordingReview.sessionId, input.sessionId)),
    });
}
