import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/db/queries/user";
import { clearDraftSegments, listDraftSegments } from "@/db/queries/baseline-segments";
import { ASSESSMENT_SEGMENT_KINDS } from "@/lib/assessment/segments";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { isMissingPocketBaseCollection, POCKETBASE_WEB_COLLECTIONS_HINT } from "@/lib/pocketbase/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — returns which segments are already recorded so the client can resume. */
export async function GET() {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;
  const userId = auth;

  await ensureUserProfile(userId);
  try {
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
  } catch (e) {
    if (isMissingPocketBaseCollection(e) || (e instanceof Error && e.message.includes("baseline_segments"))) {
      return NextResponse.json(
        {
          segments: [],
          completedKinds: [],
          orderedKinds: ASSESSMENT_SEGMENT_KINDS,
          pocketBaseSetupRequired: true,
          message: POCKETBASE_WEB_COLLECTIONS_HINT,
        },
        { status: 200 },
      );
    }
    throw e;
  }
}

/** DELETE — wipes the in-progress draft (Start over). */
export async function DELETE() {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;
  await clearDraftSegments(auth);
  return NextResponse.json({ ok: true });
}
