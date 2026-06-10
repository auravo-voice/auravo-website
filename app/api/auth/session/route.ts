import { NextResponse } from "next/server";

import { getAuthSessionSnapshot } from "@/lib/auth/session-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the current auth session from HTTP-only cookies (for client sync). */
export async function GET() {
  const session = await getAuthSessionSnapshot();
  return NextResponse.json(session);
}
