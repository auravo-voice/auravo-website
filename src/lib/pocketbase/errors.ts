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

/** Human-readable message from PocketBase validation (400) or other API errors. */
export function pocketBaseErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : "Request failed.";
  }
  const data = error.response?.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object") {
    const parts: string[] = [];
    for (const [field, detail] of Object.entries(data)) {
      if (detail && typeof detail === "object" && "message" in (detail as object)) {
        const m = (detail as { message?: string }).message;
        if (m) parts.push(`${field}: ${m}`);
      } else if (typeof detail === "string") {
        parts.push(`${field}: ${detail}`);
      }
    }
    if (parts.length > 0) return parts.join(" ");
  }
  return error.response?.message ?? error.message ?? "PocketBase request failed.";
}
