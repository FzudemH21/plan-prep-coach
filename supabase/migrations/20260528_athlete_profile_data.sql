-- Add profile_data JSONB to athlete_connections.
-- Stores bidirectionally-synced athlete profile fields (name, birthday, sex,
-- sports, team, etc.) so the athlete app can read and update them without
-- needing access to the coach's athlete_database blob.
ALTER TABLE athlete_connections
  ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}';
