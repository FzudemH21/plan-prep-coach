-- athlete_connections: links a Supabase auth user (athlete) to a coach's athlete record
CREATE TABLE IF NOT EXISTS athlete_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id UUID REFERENCES auth.users(id) NOT NULL,
  athlete_local_id TEXT NOT NULL,          -- athlete.id inside coach's JSONB blob
  athlete_name TEXT NOT NULL,
  athlete_email TEXT,
  athlete_auth_user_id UUID REFERENCES auth.users(id),
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE athlete_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_manage_connections" ON athlete_connections
  FOR ALL USING (coach_user_id = auth.uid());
CREATE POLICY "athlete_read_own_connection" ON athlete_connections
  FOR SELECT USING (athlete_auth_user_id = auth.uid());

-- athlete_schedule: pre-computed daily sessions (populated on plan assignment)
CREATE TABLE IF NOT EXISTS athlete_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_connection_id UUID REFERENCES athlete_connections(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,                       -- yyyy-MM-dd
  intensity TEXT,
  sessions JSONB NOT NULL DEFAULT '[]',
  program_name TEXT,
  mesocycle_name TEXT,
  microcycle_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(athlete_connection_id, date)
);
ALTER TABLE athlete_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete_read_own_schedule" ON athlete_schedule
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM athlete_connections ac
      WHERE ac.id = athlete_schedule.athlete_connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );
CREATE POLICY "coach_manage_schedule" ON athlete_schedule
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM athlete_connections ac
      WHERE ac.id = athlete_schedule.athlete_connection_id
        AND ac.coach_user_id = auth.uid()
    )
  );
