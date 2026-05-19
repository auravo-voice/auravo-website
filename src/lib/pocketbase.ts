import PocketBase from "pocketbase";

/** Public PocketBase API URL (browser + server). */
export function getPocketBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_POCKETBASE_URL is not set.");
  }
  return url.replace(/\/$/, "");
}

/** Cookie name used by the PocketBase JS SDK auth store. */
export const PB_AUTH_COOKIE = "pb_auth";

/** Client-side PocketBase instance (use in `"use client"` components only). */
export function createBrowserPocketBase(): PocketBase {
  return new PocketBase(getPocketBaseUrl());
}
