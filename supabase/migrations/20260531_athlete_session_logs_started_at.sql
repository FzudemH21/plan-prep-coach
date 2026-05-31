-- Add started_at column to athlete_session_logs so the coach app can show
-- "in progress" sessions (started but not yet completed by the athlete).
ALTER TABLE athlete_session_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
