-- Add is_suspended flag to athlete_connections.
-- When a coach archives an athlete the flag is set true → athlete app shows
-- a soft-block screen. When the coach un-archives it is set back to false.
-- When a coach permanently deletes an athlete the entire connection row is
-- deleted (which cascades to all child tables via FK constraints).

ALTER TABLE athlete_connections
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
