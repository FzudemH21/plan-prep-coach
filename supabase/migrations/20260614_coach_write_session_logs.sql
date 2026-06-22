-- Allow coaches to INSERT, UPDATE and DELETE session logs for their athletes.
-- Coaches already have SELECT via "coach_read_athlete_logs".
-- This enables the coach mobile app to log sessions on behalf of athletes.

CREATE POLICY "coach_insert_athlete_logs" ON athlete_session_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM athlete_connections ac
      WHERE ac.id = athlete_session_logs.athlete_connection_id
        AND ac.coach_user_id = auth.uid()
    )
  );

CREATE POLICY "coach_update_athlete_logs" ON athlete_session_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM athlete_connections ac
      WHERE ac.id = athlete_session_logs.athlete_connection_id
        AND ac.coach_user_id = auth.uid()
    )
  );

CREATE POLICY "coach_delete_athlete_logs" ON athlete_session_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM athlete_connections ac
      WHERE ac.id = athlete_session_logs.athlete_connection_id
        AND ac.coach_user_id = auth.uid()
    )
  );
