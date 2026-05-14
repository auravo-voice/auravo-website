/** Matches `src/db/schema.ts` — executed once per process on first DB open. */
export const INIT_SQL = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  onboarding_goal_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS practice_session (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user_profile(id),
  kind TEXT NOT NULL,
  title TEXT,
  audio_relative_path TEXT NOT NULL,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL,
  segments_json TEXT
);
CREATE TABLE IF NOT EXISTS baseline_segment (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user_profile(id),
  segment_kind TEXT NOT NULL,
  audio_relative_path TEXT NOT NULL,
  duration_ms INTEGER,
  transcript TEXT,
  session_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_baseline_segment_user_draft
  ON baseline_segment(user_id, segment_kind)
  WHERE session_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_baseline_segment_session ON baseline_segment(session_id);
CREATE TABLE IF NOT EXISTS simulation_turn (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES practice_session(id),
  turn_index INTEGER NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  audio_relative_path TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_simulation_turn_session ON simulation_turn(session_id, turn_index);
CREATE TABLE IF NOT EXISTS session_transcript (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL UNIQUE REFERENCES practice_session(id),
  text TEXT NOT NULL,
  adapter TEXT NOT NULL,
  analysis_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS session_scores (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL UNIQUE REFERENCES practice_session(id),
  pronunciation INTEGER NOT NULL,
  grammar INTEGER NOT NULL,
  fluency INTEGER NOT NULL,
  vocabulary INTEGER NOT NULL,
  filler_words INTEGER NOT NULL,
  pacing INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS onboarding_baseline (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user_profile(id),
  session_id TEXT NOT NULL REFERENCES practice_session(id),
  created_at INTEGER NOT NULL
);
`;
