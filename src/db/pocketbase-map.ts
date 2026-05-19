import "server-only";

import type { RecordModel } from "pocketbase";
import type { UserProfileRow, SessionScoresRow } from "@/db/types";

export function pbTs(record: RecordModel, field: "created" | "updated" = "created"): number {
  const v = record[field];
  if (typeof v === "string") return Date.parse(v) || Date.now();
  return Date.now();
}

export function mapUserRecord(record: RecordModel): UserProfileRow {
  const display =
    (typeof record.display_name === "string" && record.display_name.trim()) ||
    (typeof record.name === "string" && record.name.trim()) ||
    "Learner";
  return {
    id: record.id,
    displayName: display,
    onboardingGoalId:
      typeof record.onboarding_goal_id === "string" ? record.onboarding_goal_id : null,
    createdAt: pbTs(record, "created"),
    updatedAt: pbTs(record, "updated"),
  };
}

export function mapSessionScores(record: RecordModel, sessionId: string): SessionScoresRow {
  return {
    id: record.id,
    sessionId,
    pronunciation: Number(record.pronunciation),
    grammar: Number(record.grammar),
    fluency: Number(record.fluency),
    vocabulary: Number(record.vocabulary),
    fillerWords: Number(record.filler_words),
    pacing: Number(record.pacing),
    createdAt: pbTs(record, "created"),
  };
}
