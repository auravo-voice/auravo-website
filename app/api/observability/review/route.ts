import { NextResponse } from "next/server";
import { isAuthError } from "@/lib/auth/require-auth";
import { requireAdminApiUserId } from "@/lib/auth/admin";
import { upsertRecordingReview, type ExpectedSimilarity } from "@/db/queries/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asExpectedSimilarity(v: unknown): ExpectedSimilarity | null {
  if (v === "similar" || v === "partially_similar" || v === "not_similar" || v === "unknown") return v;
  return null;
}

export async function POST(req: Request) {
  const auth = await requireAdminApiUserId();
  if (isAuthError(auth)) return auth;
  const reviewerUserId = auth;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionId = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  const expectedSimilarity = asExpectedSimilarity(o.expectedSimilarity);
  const note = typeof o.note === "string" ? o.note.trim() : "";

  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  if (!expectedSimilarity) {
    return NextResponse.json({ error: "expectedSimilarity is required." }, { status: 400 });
  }

  try {
    await upsertRecordingReview({ sessionId, reviewerUserId, expectedSimilarity, note });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save review.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
