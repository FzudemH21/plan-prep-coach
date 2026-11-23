-- Athlete overview shared (2026-11-23): the charts pinned to an athlete's overview (Analysis tab,
-- "Stimulus & Performance") are stored in coach_records, store 'athlete_views', one row
-- "_a:<athlete>" per athlete — before, only in the browser that pinned them, so every coach saw a
-- different overview. (The "_" keeps these rows out of "Recent changes": a view setting, no item.)
--
-- The data owner reads and writes the rows with the existing "own records" rules. These rules add
-- the organization's members — exactly like athlete documents: owners every athlete, coaches the
-- athletes assigned to them (my_athlete_ids). Deleting is a deletion mark (an update), so there is
-- no delete rule. Nothing is changed in existing rows. Safe to run more than once.

drop policy if exists "org_read_athlete_views" on public.coach_records;
create policy "org_read_athlete_views" on public.coach_records for select to authenticated
  using (store = 'athlete_views' and coach_user_id = (select public.my_data_owner())
         and substr(id, 4) in (select public.my_athlete_ids()));

drop policy if exists "org_add_athlete_views" on public.coach_records;
create policy "org_add_athlete_views" on public.coach_records for insert to authenticated
  with check (store = 'athlete_views' and coach_user_id = (select public.my_data_owner())
              and substr(id, 4) in (select public.my_athlete_ids()));

drop policy if exists "org_change_athlete_views" on public.coach_records;
create policy "org_change_athlete_views" on public.coach_records for update to authenticated
  using (store = 'athlete_views' and coach_user_id = (select public.my_data_owner())
         and substr(id, 4) in (select public.my_athlete_ids()))
  with check (store = 'athlete_views' and coach_user_id = (select public.my_data_owner())
              and substr(id, 4) in (select public.my_athlete_ids()));

-- Check: the new rules exist (expect 3)
select count(*) as athlete_view_rules
  from pg_policies
 where schemaname = 'public' and tablename = 'coach_records' and policyname like 'org\_%athlete\_views';
