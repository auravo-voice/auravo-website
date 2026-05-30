import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import PocketBase from "pocketbase";
import { ensureUserProfile } from "@/db/queries/user";
import { getPocketBaseUrl } from "@/lib/pocketbase";
import { PB } from "@/db/collections";
import { applyPocketBaseAuthCookie } from "@/lib/pocketbase/server";
import {
  AURAVO_OAUTH_PROVIDER_COOKIE,
  AURAVO_OAUTH_REDIRECT_COOKIE,
  type StoredOAuthProvider,
} from "@/lib/auth/oauth2-constants";
import {
  AURAVO_USER_ID_COOKIE,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { getOAuth2CallbackUrl } from "@/lib/auth/oauth2";
import { isSqliteStorage } from "@/lib/storage/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginWithError(request: NextRequest, message: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerRaw = request.cookies.get(AURAVO_OAUTH_PROVIDER_COOKIE)?.value;
  const redirectAfter = request.cookies.get(AURAVO_OAUTH_REDIRECT_COOKIE)?.value ?? "/dashboard";

  if (!code) {
    return loginWithError(request, "Google sign-in was cancelled or did not return a code.");
  }
  if (!providerRaw) {
    return loginWithError(request, "OAuth session expired. Try signing in again.");
  }

  let provider: StoredOAuthProvider;
  try {
    provider = JSON.parse(providerRaw) as StoredOAuthProvider;
  } catch {
    return loginWithError(request, "Invalid OAuth session. Try again.");
  }

  if (!provider.state || provider.state !== state) {
    return loginWithError(request, "OAuth state mismatch. Try again.");
  }

  const callbackUrl = getOAuth2CallbackUrl(request);
  const pb = new PocketBase(getPocketBaseUrl());

  try {
    await pb.collection(PB.users).authWithOAuth2Code(
      provider.name,
      code,
      provider.codeVerifier,
      callbackUrl,
      {
        emailVisibility: true,
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google sign-in failed.";
    return loginWithError(request, msg);
  }

  const meta = pb.authStore.record as { name?: string; email?: string } | null;
  const display =
    (typeof meta?.name === "string" && meta.name.trim()) ||
    (typeof meta?.email === "string" && meta.email.split("@")[0]) ||
    "Learner";

  const userId = pb.authStore.record?.id;
  if (userId) {
    try {
      await pb.collection(PB.users).update(userId, {
        name: display,
        display_name: display,
      });
    } catch {
      /* optional profile fields */
    }
    if (isSqliteStorage()) {
      await ensureUserProfile(userId, { displayName: display });
    }
  }

  const dest = redirectAfter.startsWith("/") ? redirectAfter : "/dashboard";
  const res = NextResponse.redirect(new URL(dest, request.url));
  applyPocketBaseAuthCookie(res, pb);
  res.cookies.delete(AURAVO_OAUTH_PROVIDER_COOKIE);
  res.cookies.delete(AURAVO_OAUTH_REDIRECT_COOKIE);
  if (userId && isSqliteStorage()) {
    res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  }
  return res;
}
