import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import PocketBase from "pocketbase";
import { getPocketBaseUrl, PB_AUTH_COOKIE } from "@/lib/pocketbase";

export type ServerPocketBase = PocketBase;

/** Server PocketBase client with auth loaded from the `pb_auth` cookie. */
export const getServerPocketBase = cache(async (): Promise<ServerPocketBase> => {
  const pb = new PocketBase(getPocketBaseUrl());
  pb.autoCancellation(false);
  const cookieStore = await cookies();
  const raw = cookieStore.get(PB_AUTH_COOKIE)?.value;
  if (raw) {
    pb.authStore.loadFromCookie(`${PB_AUTH_COOKIE}=${raw}`, PB_AUTH_COOKIE);
  }
  return pb;
});

export function pocketBaseAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

/** Persist auth store to Next cookies after login/signup/OAuth. */
export async function savePocketBaseAuthCookie(pb: PocketBase): Promise<void> {
  const cookieStore = await cookies();
  const exported = pb.authStore.exportToCookie({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  const match = exported.match(new RegExp(`${PB_AUTH_COOKIE}=([^;]+)`));
  const value = match?.[1];
  if (!value) return;
  cookieStore.set(PB_AUTH_COOKIE, decodeURIComponent(value), pocketBaseAuthCookieOptions());
}

/** Clear PocketBase auth cookie on logout. */
export async function clearPocketBaseAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PB_AUTH_COOKIE);
}
