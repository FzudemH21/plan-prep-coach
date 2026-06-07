-- Allow athletes to update/insert their own schedule rows when rearranging workouts.
-- The allow_rearrange_workouts flag is enforced at the application level (UI only
-- shows the grip handle when the flag is true). This policy simply grants the
-- necessary DB access so the Supabase client call doesn't silently no-op.

CREATE POLICY "athlete_update_own_schedule" ON public.athlete_schedule
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = athlete_schedule.athlete_connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );

CREATE POLICY "athlete_insert_own_schedule" ON public.athlete_schedule
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = athlete_connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );
