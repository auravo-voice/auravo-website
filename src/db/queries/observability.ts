import "server-only";

import { isPocketBaseStorage } from "@/lib/storage/env";
import {
  listObservabilitySessions as listSqliteObservabilitySessions,
  upsertRecordingReview as upsertSqliteRecordingReview,
  type ExpectedSimilarity,
  type ObservabilitySessionRow,
} from "@/db/queries/sqlite/observability";

export type { ExpectedSimilarity, ObservabilitySessionRow };

export async function listObservabilitySessions(limit = 100): Promise<ObservabilitySessionRow[]> {
  if (isPocketBaseStorage()) {
    // Observability dashboard is currently wired for local SQLite session data.
    return [];
  }
  return listSqliteObservabilitySessions(limit);
}

export async function upsertRecordingReview(input: {
  sessionId: string;
  reviewerUserId: string;
  expectedSimilarity: ExpectedSimilarity;
  note: string;
}): Promise<void> {
  if (isPocketBaseStorage()) {
    throw new Error("Recording review write is unavailable when AURAVO_STORAGE=pocketbase.");
  }
  return upsertSqliteRecordingReview(input);
}
