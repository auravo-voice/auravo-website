import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDataDir } from "@/db/client";
import { ensureUserProfile } from "@/db/queries/user";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";
import { getTranscriptionAdapter } from "@/lib/transcription";
import {
  AURAVO_USER_ID_COOKIE,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { ASSESSMENT_SEGMENT_KINDS, isAssessmentSegmentKind } from "@/lib/assessment/segments";
import { replaceDraftSegment, listDraftSegments } from "@/db/queries/baseline-segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uploads a single initial-assessment segment, stores audio under `data/uploads`, transcribes immediately so we can
 * resume without re-transcribing on finalize, and returns the new draft state. Replaces any previous draft segment
 * of the same kind (re-record use case).
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  let userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value ?? "";
  if (!userId) userId = randomUUID();

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
  const dataDir = getDataDir();
  const uploadsDir = path.join(dataDir, "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const relativePath = path
    .join("uploads", `${segmentId}.${segmentKind}.${ext}`)
    .split(path.sep)
    .join("/");
  const absolutePath = path.join(dataDir, relativePath);
  const buf = Buffer.from(await audio.arrayBuffer());
  await fs.writeFile(absolutePath, buf);

  // Transcribe now so finalize is fast (the "15 second baseline" promise). If transcription fails we still keep
  // the file and persist an empty transcript so the learner can move on.
  let transcript: string | null = null;
  try {
    const adapter = getTranscriptionAdapter();
    const tr = await adapter.transcribe(absolutePath);
    transcript = tr.text;
  } catch {
    transcript = "";
  }

  replaceDraftSegment({
    id: segmentId,
    userId,
    segmentKind,
    audioRelativePath: relativePath,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    transcript,
  });

  const rows = await listDraftSegments(userId);

  const res = NextResponse.json({
    ok: true,
    userId,
    segmentKind,
    completedKinds: rows.map((r) => r.segmentKind),
    orderedKinds: ASSESSMENT_SEGMENT_KINDS,
  });
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  return res;
}
