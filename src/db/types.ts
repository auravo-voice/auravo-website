import type { sessionScores, userProfile } from "@/db/schema";

export type UserProfileRow = typeof userProfile.$inferSelect;
export type SessionScoresRow = typeof sessionScores.$inferSelect;
