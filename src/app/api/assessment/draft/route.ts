import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AURAVO_USER_ID_COOKIE } from "@/lib/auth/auravo-user-cookie";
import { isUuidLike } from "@/lib/util/is-uuid-like";
import { ensureUserProfile } from "@/db/queries/user";
import { clearDraftSegments, listDraftSegments } from "@/db/queries/baseline-segments";
import { ASSESSMENT_SEGMENT_KINDS } from "@/lib/assessment/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — returns which segments are already recorded so the client can resume. */
export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value;
  if (!userId || !isUuidLike(userId)) {
    return NextResponse.json({
      segments: [],
      completedKinds: [],
      orderedKinds: ASSESSMENT_SEGMENT_KINDS,
    });
  }
  await ensureUserProfile(userId);
  const rows = await listDraftSegments(userId);
  return NextResponse.json({
    segments: rows.map((r) => ({
      segmentKind: r.segmentKind,
      durationMs: r.durationMs,
      transcript: r.transcript,
      createdAt: r.createdAt,
    })),
    completedKinds: rows.map((r) => r.segmentKind),
    orderedKinds: ASSESSMENT_SEGMENT_KINDS,
  });
}

/** DELETE — wipes the in-progress draft (Start over). */
export async function DELETE() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value;
  if (!userId || !isUuidLike(userId)) {
    return NextResponse.json({ ok: true, cleared: 0 });
  }
  clearDraftSegments(userId);
  return NextResponse.json({ ok: true });
}
