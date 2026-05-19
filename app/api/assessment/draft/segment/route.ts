import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/db/queries/user";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";
import { getTranscriptionAdapter } from "@/lib/transcription";
import { ASSESSMENT_SEGMENT_KINDS, isAssessmentSegmentKind } from "@/lib/assessment/segments";
import { replaceDraftSegment, listDraftSegments } from "@/db/queries/baseline-segments";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uploads a single initial-assessment segment, stores audio under `data/uploads`, transcribes immediately so we can
 * resume without re-transcribing on finalize, and returns the new draft state. Replaces any previous draft segment
 * of the same kind (re-record use case).
 */
export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;
  const userId = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const segmentKindRaw = form.get("segmentKind");
  const segmentKind = typeof segmentKindRaw === "string" ? segmentKindRaw.trim() : "";
  if (!isAssessmentSegmentKind(segmentKind)) {
    return NextResponse.json({ error: "Invalid segment kind." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  const durationRaw = form.get("durationMs");
  const durationMs =
    typeof durationRaw === "string" && durationRaw.trim() !== "" ? Number.parseInt(durationRaw, 10) : NaN;

  const goalRaw = form.get("goalId");
  const goalId = typeof goalRaw === "string" && goalRaw.trim() !== "" ? goalRaw.trim() : null;
  if (goalId != null && !isOnboardingGoalId(goalId)) {
    return NextResponse.json({ error: "Invalid goal id." }, { status: 400 });
  }
  await ensureUserProfile(userId, goalId != null ? { onboardingGoalId: goalId } : {});

  const segmentId = randomUUID();
  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const { absolutePath, relativePath } = await writeTempAudioFile(
    `${segmentId}.${segmentKind}`,
    audio,
    ext,
  );

  let transcript: string | null = null;
  try {
    const adapter = getTranscriptionAdapter();
    const tr = await adapter.transcribe(absolutePath);
    transcript = tr.text;
  } catch {
    transcript = "";
  }

  await replaceDraftSegment({
    id: segmentId,
    userId,
    segmentKind,
    audioRelativePath: relativePath,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    transcript,
    audioFile: audio,
  });

  const rows = await listDraftSegments(userId);

  return NextResponse.json({
    ok: true,
    userId,
    segmentKind,
    completedKinds: rows.map((r) => r.segmentKind),
    orderedKinds: ASSESSMENT_SEGMENT_KINDS,
  });
}
