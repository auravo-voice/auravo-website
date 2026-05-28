import { NextResponse } from "next/server";
import { getPracticeSessionOwnerId, getUserIdForOnboardingPracticeSession } from "@/db/queries/baseline";
import { consumeBaselineHandoffUserId } from "@/lib/assessment/baseline-handoff-disk";
import {
  AURAVO_PENDING_BASELINE_SESSION_COOKIE,
  AURAVO_USER_ID_COOKIE,
  auravoPendingBaselineSessionCookieOptions,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { isUuidLike } from "@/lib/util/is-uuid-like";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safari often does not persist `Set-Cookie` from the assessment `fetch()` before a navigation.
 * The client stores `{ sessionId }` in `sessionStorage`, POSTs here, then reloads so this response applies cookies.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  const raw =
    body && typeof body === "object" && "sessionId" in body
      ? typeof (body as { sessionId: unknown }).sessionId === "string"
        ? (body as { sessionId: string }).sessionId.trim()
        : ""
      : "";
  const bodyUserId =
    body && typeof body === "object" && "userId" in body && typeof (body as { userId: unknown }).userId === "string"
      ? (body as { userId: string }).userId.trim()
      : null;
  if (!isUuidLike(raw)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  let userId = consumeBaselineHandoffUserId(raw);
  if (!userId) {
    userId = (await getUserIdForOnboardingPracticeSession(raw)) ?? (await getPracticeSessionOwnerId(raw));
  }
  if (!userId) {
    return NextResponse.json({ error: "Unknown session." }, { status: 404 });
  }
  if (bodyUserId && isUuidLike(bodyUserId) && bodyUserId !== userId) {
    return NextResponse.json({ error: "Session mismatch." }, { status: 409 });
  }

  const res = NextResponse.json({ ok: true as const, userId });
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  res.cookies.set(AURAVO_PENDING_BASELINE_SESSION_COOKIE, "", {
    ...auravoPendingBaselineSessionCookieOptions(),
    maxAge: 0,
  });
  return res;
}
