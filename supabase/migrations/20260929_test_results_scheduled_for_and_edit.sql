-- Test results: link a result to the scheduled test it answers, and allow editing a result.
--
-- scheduled_for: the day the test was planned. A result can be recorded with a different date
-- (done a day late, entered later) and still count for its scheduled test — the athlete app then
-- shows "Result ✓ / Edit" on that test instead of "Enter result". NULL for older results (they
-- count for the test on their recorded date, as before).

alter table public.athlete_test_results
  add column if not exists scheduled_for date;

-- The athlete may edit their own results
drop policy if exists "athlete_update_test_results" on public.athlete_test_results;
create policy "athlete_update_test_results" on public.athlete_test_results
  for update
  using (
    exists (
      select 1 from public.athlete_connections ac
      where ac.id = athlete_connection_id
        and ac.athlete_auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.athlete_connections ac
      where ac.id = athlete_connection_id
        and ac.athlete_auth_user_id = auth.uid()
    )
  );

-- The coach may edit results of their athletes
drop policy if exists "coach_update_test_results" on public.athlete_test_results;
create policy "coach_update_test_results" on public.athlete_test_results
  for update
  using (
    exists (
      select 1 from public.athlete_connections ac
      where ac.id = athlete_connection_id
        and ac.coach_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.athlete_connections ac
      where ac.id = athlete_connection_id
        and ac.coach_user_id = auth.uid()
    )
  );
