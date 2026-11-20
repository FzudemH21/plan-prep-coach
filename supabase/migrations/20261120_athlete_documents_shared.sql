-- Athlete documents (2026-11-20): the list of an athlete's documents and folders is stored in
-- Supabase — coach_records, store 'athlete_documents', one row "a:<athlete>" per athlete — instead
-- of only in the browser that uploaded them. The files themselves were already in storage
-- (documents/athlete-docs/<athlete>/…) with rules for the organization.
--
-- The data owner reads and writes the rows with the existing "own records" rules. These rules add
-- the organization's members — exactly like tests and events: owners every athlete, coaches the
-- athletes assigned to them (my_athlete_ids). Deleting is a deletion mark (an update), so there is
-- no delete rule. Nothing is changed in existing rows. Safe to run more than once.

drop policy if exists "org_read_athlete_documents" on public.coach_records;
create policy "org_read_athlete_documents" on public.coach_records for select to authenticated
  using (store = 'athlete_documents' and coach_user_id = (select public.my_data_owner())
         and substr(id, 3) in (select public.my_athlete_ids()));

drop policy if exists "org_add_athlete_documents" on public.coach_records;
create policy "org_add_athlete_documents" on public.coach_records for insert to authenticated
  with check (store = 'athlete_documents' and coach_user_id = (select public.my_data_owner())
              and substr(id, 3) in (select public.my_athlete_ids()));

drop policy if exists "org_change_athlete_documents" on public.coach_records;
create policy "org_change_athlete_documents" on public.coach_records for update to authenticated
  using (store = 'athlete_documents' and coach_user_id = (select public.my_data_owner())
         and substr(id, 3) in (select public.my_athlete_ids()))
  with check (store = 'athlete_documents' and coach_user_id = (select public.my_data_owner())
              and substr(id, 3) in (select public.my_athlete_ids()));

-- "Recent changes": a coach sees document changes only for their own athletes (like tests / events;
-- "athlete_documents/a:" is 20 characters, the athlete id starts at 21)
do $$
begin
  if to_regclass('public.activity_log') is not null then
    drop policy if exists "org_reads_activity" on public.activity_log;
    create policy "org_reads_activity" on public.activity_log for select to authenticated
      using (org_id = (select public.my_org_id())
             and (table_name <> 'athlete_records' or record_id in (select public.my_athlete_ids()))
             and (record_id not like 'calendar\_events/%' or substr(record_id, 19) in (select public.my_athlete_ids()))
             and (record_id not like 'athlete\_documents/%' or substr(record_id, 21) in (select public.my_athlete_ids())));
  end if;
end $$;

-- Check: the new rules exist (expect 3)
select count(*) as athlete_document_rules
  from pg_policies
 where schemaname = 'public' and tablename = 'coach_records' and policyname like 'org\_%athlete\_documents';
