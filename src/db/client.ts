import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { INIT_SQL } from "@/db/init-sql";
import * as schema from "@/db/schema";

let singleton: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (singleton) return singleton;
  const root = process.cwd();
  const dataDir = process.env.AURAVO_DB_DIR ?? path.join(root, "data");
  const dbFile = process.env.AURAVO_DB_FILE ?? "auravo.sqlite";
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
  const dbPath = path.join(dataDir, dbFile);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(INIT_SQL);
  // Additive migrations — better-sqlite3 is sync; `try` per column so an existing column doesn't crash startup.
  try {
    sqlite.exec("ALTER TABLE session_transcript ADD COLUMN analysis_json TEXT;");
  } catch {
    /* column already present */
  }
  try {
    sqlite.exec("ALTER TABLE practice_session ADD COLUMN segments_json TEXT;");
  } catch {
    /* column already present */
  }
  singleton = drizzle(sqlite, { schema });
  return singleton;
}

export function getDataDir(): string {
  const root = process.cwd();
  return process.env.AURAVO_DB_DIR ?? path.join(root, "data");
}
