-- Add weeks_ahead to athlete_connections so the coach can control
-- how many weeks into the future the athlete can see in the app.
ALTER TABLE athlete_connections
  ADD COLUMN IF NOT EXISTS weeks_ahead INTEGER NOT NULL DEFAULT 4;
