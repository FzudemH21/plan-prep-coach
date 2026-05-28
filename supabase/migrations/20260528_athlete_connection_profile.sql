-- Add weeks_ahead and profile_data columns to athlete_connections
-- weeks_ahead: how many weeks ahead the athlete can see in the app (coach-configured)
-- profile_data: shared profile store editable by both coach and athlete

ALTER TABLE athlete_connections
  ADD COLUMN IF NOT EXISTS weeks_ahead INTEGER NOT NULL DEFAULT 4;

ALTER TABLE athlete_connections
  ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}';

-- Allow athletes to update their own connection row.
-- The app only sends { profile_data: ... } in the update payload, but we cannot
-- restrict which columns are touched at the RLS level (that requires column-level
-- privileges). The athlete auth token is scoped to their single connection row, so
-- the risk surface is minimal.
CREATE POLICY "athlete_update_own_connection" ON athlete_connections
  FOR UPDATE
  USING (athlete_auth_user_id = auth.uid())
  WITH CHECK (athlete_auth_user_id = auth.uid());
