import { ClientResponseError } from "pocketbase";

/** PocketBase returns 404 "Missing collection context." when the collection was never created in admin. */
export function isMissingPocketBaseCollection(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false;
  if (error.status !== 404) return false;
  const msg = error.response?.message ?? error.message ?? "";
  return msg.toLowerCase().includes("missing collection context");
}

export const POCKETBASE_WEB_COLLECTIONS_HINT =
  "Create the web data collections in PocketBase admin — see docs/POCKETBASE.md (baseline_segments, practice_sessions, etc.).";
