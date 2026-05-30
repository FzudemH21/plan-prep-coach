-- Add events column to athlete_schedule so tests and calendar events
-- assigned by the coach appear in the athlete app.
ALTER TABLE athlete_schedule
  ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '[]'::jsonb;
