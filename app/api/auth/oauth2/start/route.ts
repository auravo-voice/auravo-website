import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AURAVO_OAUTH_COOKIE_MAX_AGE_SEC,
  AURAVO_OAUTH_PROVIDER_COOKIE,
  AURAVO_OAUTH_REDIRECT_COOKIE,
  type StoredOAuthProvider,
} from "@/lib/auth/oauth2-constants";
import { getOAuth2CallbackUrl, getOAuth2Provider } from "@/lib/auth/oauth2";
import { isPocketBaseAuthEnabled } from "@/lib/storage/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AURAVO_OAUTH_COOKIE_MAX_AGE_SEC,
};

export async function GET(request: NextRequest) {
  if (!isPocketBaseAuthEnabled()) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Set NEXT_PUBLIC_POCKETBASE_URL to enable Google sign-in.")}`,
        request.url,
      ),
    );
  }

  const providerName = request.nextUrl.searchParams.get("provider")?.trim() || "google";
  const redirectAfter =
    request.nextUrl.searchParams.get("redirect")?.trim() || "/dashboard";
  const safeRedirect = redirectAfter.startsWith("/") && !redirectAfter.startsWith("//")
    ? redirectAfter
    : "/dashboard";

  let provider;
  try {
    provider = await getOAuth2Provider(providerName);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not reach PocketBase.";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, request.url),
    );
  }

  if (!provider) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(`Sign-in with ${providerName} is not enabled on the server.`)}`,
        request.url,
      ),
    );
  }

  const callbackUrl = getOAuth2CallbackUrl(request);
  const authUrl = `${provider.authURL}${encodeURIComponent(callbackUrl)}`;

  const stored: StoredOAuthProvider = {
    name: provider.name,
    state: provider.state,
    codeVerifier: provider.codeVerifier,
  };

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(AURAVO_OAUTH_PROVIDER_COOKIE, JSON.stringify(stored), cookieOpts);
  res.cookies.set(AURAVO_OAUTH_REDIRECT_COOKIE, safeRedirect, cookieOpts);
  return res;
}
