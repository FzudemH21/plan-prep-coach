-- Allow coaches to insert test results on behalf of their athletes.
-- Previously only athletes could insert (athlete_auth_user_id = auth.uid()).
CREATE POLICY "coach_insert_test_results" ON public.athlete_test_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = athlete_connection_id
        AND ac.coach_user_id = auth.uid()
    )
  );
