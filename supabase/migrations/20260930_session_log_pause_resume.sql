-- Pause / resume workouts (athlete app + coach mobile).
-- A started, unfinished session log keeps the workout's progress so it can be resumed later,
-- on any device. paused_at is set while the workout is paused (NULL while it's running).
-- The existing athlete/coach update policies on athlete_session_logs already cover these columns.

ALTER TABLE athlete_session_logs ADD COLUMN IF NOT EXISTS progress jsonb;
ALTER TABLE athlete_session_logs ADD COLUMN IF NOT EXISTS paused_at timestamptz;
