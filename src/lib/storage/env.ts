import "server-only";

export type StorageBackend = "sqlite" | "pocketbase";

/** Where practice data, scores, and sessions are stored. Default: local SQLite. */
export function getStorageBackend(): StorageBackend {
  const raw = process.env.AURAVO_STORAGE?.trim().toLowerCase();
  if (raw === "pocketbase" || raw === "pb") return "pocketbase";
  return "sqlite";
}

export function isPocketBaseStorage(): boolean {
  return getStorageBackend() === "pocketbase";
}

export function isSqliteStorage(): boolean {
  return !isPocketBaseStorage();
}

/** True when `NEXT_PUBLIC_POCKETBASE_URL` is set (Google / email auth via PocketBase). */
export function isPocketBaseAuthEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim();
  return Boolean(url && url.length > 0);
}
