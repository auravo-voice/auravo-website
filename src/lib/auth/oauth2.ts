import "server-only";

import type { NextRequest } from "next/server";
import { getPocketBaseUrl } from "@/lib/pocketbase";
import { PB } from "@/db/collections";

/** Public site origin (correct behind nginx/Cloudflare; avoids `localhost:3000` in OAuth). */
export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwardedProto ||
    (request.nextUrl.protocol === "https:" ? "https" : "http");

  if (host && !/^localhost(:\d+)?$/i.test(host) && !host.startsWith("127.0.0.1")) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // Dev fallback only — production should never reach localhost here.
  return request.nextUrl.origin.replace(/\/$/, "");
}

/** OAuth callback URL on this Next.js app (must match Google / PocketBase redirect config). */
export function getOAuth2CallbackUrl(request: NextRequest): string {
  return `${getPublicOrigin(request)}/api/auth/oauth2/callback`;
}

/** Build an absolute URL on the public host (for redirects after OAuth). */
export function publicUrl(request: NextRequest, pathname: string): URL {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, `${getPublicOrigin(request)}/`);
}

export async function getOAuth2Provider(providerName: string) {
  const PocketBase = (await import("pocketbase")).default;
  const pb = new PocketBase(getPocketBaseUrl());
  const methods = await pb.collection(PB.users).listAuthMethods();
  if (!methods.oauth2?.enabled) return null;
  return methods.oauth2.providers.find((p) => p.name === providerName) ?? null;
}
