import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createOnboardingBaseline,
  createPracticeSession,
  createSessionScores,
  createSessionTranscript,
} from "@/db/queries/practice-persist";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import { getOnboardingGoalLabel, isOnboardingGoalId } from "@/lib/coach/dashboard";
import { ensureUserProfile } from "@/db/queries/user";
import { writeBaselineHandoffToken } from "@/lib/assessment/baseline-handoff-disk";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_USER_ID_COOKIE,
  auravoPendingBaselineSessionCookieOptions,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import {
  ASSESSMENT_SEGMENT_KINDS,
  segmentDisplayLabel,
  type AssessmentSegmentKind,
} from "@/lib/assessment/segments";
import {
  attachDraftSegmentsToSession,
  listDraftSegments,
} from "@/db/queries/baseline-segments";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { resolveDraftSegmentAudio } from "@/lib/storage/audio-path";
import { isPocketBaseStorage } from "@/lib/storage/env";
import { getServerPocketBase } from "@/lib/pocketbase/server";
import { runAnalysis, serializeAnalysisForPersistence } from "@/lib/analysis/run-analysis";
import { buildSegmentTranscriptRows } from "@/lib/assessment/segment-transcripts";
import { TranscriptionUnavailableError } from "@/lib/transcription";
import { getTranscriptionAdapter } from "@/lib/transcription";
import { mergeSegmentTranscriptions } from "@/lib/assessment/merge-segment-transcriptions";
import { parseSegmentTranscriptMeta } from "@/lib/assessment/segment-transcript-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finalize the initial assessment. The four segment audios are concatenated with ffmpeg and run
 * through the canonical {@link runAnalysis} pipeline — this is intentionally the highest-quality
 * analysis flow in the product because the resulting baseline drives the entire learning path.
 *
 * If real transcription is unavailable, we fall back to the already-stored per-segment transcripts
 * (concatenated as plain text) so the learner still gets a baseline; the response includes a
 * `degraded: true` flag and the UI surfaces a warning.
 */
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
  const goalRaw = body && typeof body === "object" && "goalId" in body ? (body as { goalId?: unknown }).goalId : null;
  const goalId = typeof goalRaw === "string" && goalRaw.trim() !== "" ? goalRaw.trim() : null;
  if (goalId != null && !isOnboardingGoalId(goalId)) {
    return NextResponse.json({ error: "Invalid goal id." }, { status: 400 });
  }
  await ensureUserProfile(userId, goalId != null ? { onboardingGoalId: goalId } : {});

  const drafts = await listDraftSegments(userId);
  const haveByKind: Partial<Record<AssessmentSegmentKind, (typeof drafts)[number]>> = {};
  for (const d of drafts) haveByKind[d.segmentKind] = d;
  const missing = ASSESSMENT_SEGMENT_KINDS.filter((k) => !haveByKind[k]);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Still need ${missing.length} segment${missing.length === 1 ? "" : "s"}: ${missing
          .map(segmentDisplayLabel)
          .join(", ")}.`,
        missing,
      },
      { status: 400 },
    );
  }

  const orderedDrafts = ASSESSMENT_SEGMENT_KINDS.map((k) => haveByKind[k]!);
  const pb = isPocketBaseStorage() ? await getServerPocketBase() : undefined;
  let absolutePaths: string[];
  try {
    absolutePaths = await Promise.all(
      orderedDrafts.map((d) => resolveDraftSegmentAudio(userId, d, pb)),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load segment audio.";
    return NextResponse.json(
      { error: `${msg} Re-record any missing segment and try again.` },
      { status: 422 },
    );
  }
  const totalDurationMs = orderedDrafts.reduce((a, d) => a + (d.durationMs ?? 0), 0) || null;
  const fallbackTranscript = orderedDrafts
    .map((d) => (d.transcript ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  const stitched = mergeSegmentTranscriptions(
    orderedDrafts.map((d) => ({
      text: d.transcript ?? "",
      durationMs: d.durationMs,
      meta: parseSegmentTranscriptMeta(d.transcriptMetaJson),
    })),
  );
  const adapterName = getTranscriptionAdapter().name;

  // Run the canonical analysis on the concatenated audio. When every segment was transcribed at
  // upload with word timings, skip re-Whisper on finalize (saves ~30–90s) while acoustic/VAD still
  // run on the full concat WAV. Otherwise fall back to full concat transcription.
  let analysis;
  let degraded = false;
  try {
    analysis = await runAnalysis({
      audio: { mode: "concat", absolutePaths, totalDurationMs },
      ...(stitched
        ? {
            preTranscribed: { ...stitched, adapter: adapterName },
            reusePreTranscription: true,
          }
        : {}),
      context: {
        userId,
        runCoachSummary: true,
        learnerContextHint: { displayName: "Learner" },
      },
    });
  } catch (e) {
    if (!(e instanceof TranscriptionUnavailableError)) {
      console.error("[assessment/finalize] runAnalysis failed:", e);
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      return NextResponse.json({ error: msg, code: "analysis_failed" }, { status: 500 });
    }
    if (fallbackTranscript.length < 1) {
      return NextResponse.json(
        {
          error:
            "Speech recognition is unavailable on the server right now. Re-record your segments in a quiet room, or try again in a few minutes.",
          code: "transcription_unavailable",
        },
        { status: 503 },
      );
    }
    degraded = true;
    analysis = await runAnalysis({
      preTranscribed: { text: fallbackTranscript, adapter: "draft-segments-fallback" },
      context: { userId, runCoachSummary: true },
    });
  }

  if (analysis.transcript.length < 1) {
    return NextResponse.json(
      { error: "Could not transcribe your recordings. Try re-recording at least one segment." },
      { status: 422 },
    );
  }

  const primaryAudio = orderedDrafts[0]!.audioRelativePath;
  const manifest = orderedDrafts.map((d) => ({
    kind: d.segmentKind,
    audioRelativePath: d.audioRelativePath,
    durationMs: d.durationMs,
  }));

  const sessionId = await createPracticeSession({
    userId,
    kind: "onboarding_assessment",
    title: "Initial assessment",
    audioRelativePath: primaryAudio,
    durationMs: totalDurationMs,
    segmentsJson: JSON.stringify(manifest),
  });
  await createSessionTranscript({
    sessionId,
    text: analysis.transcript,
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
  await createOnboardingBaseline(userId, sessionId);
  await attachDraftSegmentsToSession(userId, sessionId);

  try {
    writeBaselineHandoffToken(sessionId, userId);
  } catch {
    /* disk handoff is best-effort; SQLite row remains the source of truth */
  }

  const dimensions = scoresToRadarDimensions(analysis.scores);
  const averageScore = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);
  const segmentTranscripts = buildSegmentTranscriptRows(orderedDrafts);

  const res = NextResponse.json({
    ok: true,
    userId,
    sessionId,
    transcript: analysis.transcript.slice(0, 12_000),
    segmentTranscripts,
    dimensions,
    averageScore,
    goalLabel: goalId != null ? getOnboardingGoalLabel(goalId) ?? null : null,
    analysis: analysis.deep,
    voiceAnalysis: {
      adapter: analysis.adapter,
      modelName: analysis.modelName,
      durationSec: analysis.durationSec,
      derivedMetrics: analysis.voice.derivedMetrics,
      explanations: analysis.voice.explanations,
      qualityFlags: analysis.voice.qualityFlags,
      acousticAvailable: analysis.voice.acousticFeatures != null,
      vadAvailable: analysis.voice.vadFeatures != null,
    },
    coachSummary: analysis.coachSummary,
    recommendedExercises: analysis.candidateExercises,
    degraded,
  });
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  res.cookies.set(AURAVO_PENDING_BASELINE_SESSION_COOKIE, sessionId, auravoPendingBaselineSessionCookieOptions());
  return res;
}
