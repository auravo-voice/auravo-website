import "server-only";

import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";

/** Returns user id or a 401 JSON response for API routes. */
export async function requireApiUserId(): Promise<string | NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return userId;
}

export function isAuthError(result: string | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
