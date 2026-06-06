import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const userProfile = sqliteTable("user_profile", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  onboardingGoalId: text("onboarding_goal_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const practiceSession = sqliteTable("practice_session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userProfile.id),
  kind: text("kind").notNull(),
  title: text("title"),
  audioRelativePath: text("audio_relative_path").notNull(),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at").notNull(),
  /** JSON manifest of segment files when the session is multi-part (initial assessment, multi-turn simulation, etc.). */
  segmentsJson: text("segments_json"),
});

/**
 * Per-turn record of a simulated conversation (Phase D). The `practice_session` row is created up front with
 * `kind="simulation_draft"` and flipped to `"simulation"` on finalize so abandoned simulations do not count toward
 * streaks. User turns own audio files (replay in Phase F); assistant turns are text-only.
 */
export const simulationTurn = sqliteTable("simulation_turn", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => practiceSession.id),
  turnIndex: integer("turn_index").notNull(),
  /** "user" | "assistant" */
  role: text("role").notNull(),
  text: text("text").notNull(),
  audioRelativePath: text("audio_relative_path"),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at").notNull(),
});

/**
 * Initial-assessment segments. While `session_id` is NULL the row belongs to an in-progress draft (resumable across
 * page reloads). On finalize the four segments get their `session_id` set to the `practice_session.id` so we keep the
 * per-segment audio + transcripts for replay later (Phase F).
 */
export const baselineSegment = sqliteTable("baseline_segment", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userProfile.id),
  /** "passage" | "open_q1" | "open_q2" | "visual" */
  segmentKind: text("segment_kind").notNull(),
  audioRelativePath: text("audio_relative_path").notNull(),
  durationMs: integer("duration_ms"),
  transcript: text("transcript"),
  /** Word-level Whisper metadata (JSON) for fast finalize without re-transcribing concat audio. */
  transcriptMetaJson: text("transcript_meta_json"),
  /** NULL while draft; set to practice_session.id after finalize. */
  sessionId: text("session_id"),
  createdAt: integer("created_at").notNull(),
});

export const sessionTranscript = sqliteTable("session_transcript", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => practiceSession.id)
    .unique(),
  text: text("text").notNull(),
  adapter: text("adapter").notNull(),
  /** JSON: BaselineAnalysis + optional raw ASR hints */
  analysisJson: text("analysis_json"),
  createdAt: integer("created_at").notNull(),
});

export const sessionScores = sqliteTable("session_scores", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => practiceSession.id)
    .unique(),
  pronunciation: integer("pronunciation").notNull(),
  grammar: integer("grammar").notNull(),
  fluency: integer("fluency").notNull(),
  vocabulary: integer("vocabulary").notNull(),
  fillerWords: integer("filler_words").notNull(),
  pacing: integer("pacing").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const onboardingBaseline = sqliteTable("onboarding_baseline", {
  userId: text("user_id")
    .primaryKey()
    .references(() => userProfile.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => practiceSession.id),
  createdAt: integer("created_at").notNull(),
});

/**
 * Lightweight human QA annotation for observability: was the stored transcript/analysis close to what a reviewer
 * expected from the recording?
 */
export const recordingReview = sqliteTable("recording_review", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => practiceSession.id),
  reviewerUserId: text("reviewer_user_id")
    .notNull()
    .references(() => userProfile.id),
  /** "similar" | "partially_similar" | "not_similar" | "unknown" */
  expectedSimilarity: text("expected_similarity").notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Completed Quick Analysis assessments per user (for daily free-tier limits). */
export const quickAnalysisRun = sqliteTable("quick_analysis_run", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userProfile.id),
  dayKey: text("day_key").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Active Quick Analysis subscription entitlement (Razorpay). */
export const userSubscription = sqliteTable("user_subscription", {
  userId: text("user_id")
    .primaryKey()
    .references(() => userProfile.id),
  planId: text("plan_id").notNull(),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Contact + scores from the public Quick Analysis funnel (no auth). */
export const quickAnalysisLead = sqliteTable("quick_analysis_lead", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  /** Empty string when the visitor skips phone. */
  phone: text("phone").notNull(),
  pronunciation: integer("pronunciation").notNull(),
  grammar: integer("grammar").notNull(),
  fluency: integer("fluency").notNull(),
  vocabulary: integer("vocabulary").notNull(),
  fillerWords: integer("filler_words").notNull(),
  pacing: integer("pacing").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type UserProfileRow = typeof userProfile.$inferSelect;
export type SessionScoresRow = typeof sessionScores.$inferSelect;
export type QuickAnalysisLeadRow = typeof quickAnalysisLead.$inferSelect;
