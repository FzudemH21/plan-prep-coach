CREATE TABLE IF NOT EXISTS athlete_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_connection_id UUID REFERENCES athlete_connections(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,               -- yyyy-MM-dd
  session_id TEXT NOT NULL,         -- matches session.id in athlete_schedule sessions JSONB
  session_name TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  borg_rating INTEGER,              -- 0-10 Borg CR10
  comment TEXT,
  sets_logged JSONB NOT NULL DEFAULT '[]',  -- array of { exerciseId, setIndex, reps, weight, notes }
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE athlete_session_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete_manage_own_logs" ON athlete_session_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM athlete_connections ac
      WHERE ac.id = athlete_session_logs.athlete_connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );
CREATE POLICY "coach_read_athlete_logs" ON athlete_session_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM athlete_connections ac
      WHERE ac.id = athlete_session_logs.athlete_connection_id
        AND ac.coach_user_id = auth.uid()
    )
  );
