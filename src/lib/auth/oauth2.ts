import "server-only";

import type { NextRequest } from "next/server";
import { getPocketBaseUrl } from "@/lib/pocketbase";
import { PB } from "@/db/collections";

/** OAuth callback URL on this Next.js app (must match Google / PocketBase redirect config). */
export function getOAuth2CallbackUrl(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = fromEnv ? fromEnv.replace(/\/$/, "") : request.nextUrl.origin;
  return `${base}/api/auth/oauth2/callback`;
}

export async function getOAuth2Provider(providerName: string) {
  const PocketBase = (await import("pocketbase")).default;
  const pb = new PocketBase(getPocketBaseUrl());
  const methods = await pb.collection(PB.users).listAuthMethods();
  if (!methods.oauth2?.enabled) return null;
  return methods.oauth2.providers.find((p) => p.name === providerName) ?? null;
}
