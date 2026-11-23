-- Monitoring templates shared (2026-11-23): saved check-in setups ("Save as Template" in an
-- athlete's monitoring setup) are stored in coach_records, store 'monitoring_templates', one row per
-- template — before, they were only in the browser that saved them. They are a library like
-- exercises or methods: every member of the organization sees them, editing needs the libraries
-- right. These are the existing library rules with 'monitoring_templates' added to the list.
-- Nothing is changed in existing rows. Safe to run more than once.

drop policy if exists "org_read_libraries" on public.coach_records;
create policy "org_read_libraries" on public.coach_records for select to authenticated
  using (org_id = (select public.my_org_id())
         and store in ('exercises', 'methods', 'parameters', 'templates', 'workouts', 'monitoring_templates'));

drop policy if exists "org_add_to_libraries" on public.coach_records;
create policy "org_add_to_libraries" on public.coach_records for insert to authenticated
  with check (coach_user_id = (select public.my_data_owner())
              and org_id = (select public.my_org_id())
              and store in ('exercises', 'methods', 'parameters', 'templates', 'workouts', 'monitoring_templates')
              and (select public.org_can('libraries', 'edit')));

drop policy if exists "org_change_libraries" on public.coach_records;
create policy "org_change_libraries" on public.coach_records for update to authenticated
  using (org_id = (select public.my_org_id())
         and store in ('exercises', 'methods', 'parameters', 'templates', 'workouts', 'monitoring_templates')
         and (select public.org_can('libraries', 'edit')))
  with check (coach_user_id = (select public.my_data_owner())
              and org_id = (select public.my_org_id())
              and store in ('exercises', 'methods', 'parameters', 'templates', 'workouts', 'monitoring_templates')
              and (select public.org_can('libraries', 'edit')));

-- Check: the three library rules include monitoring templates (expect 3)
select count(*) as library_rules_with_monitoring_templates
  from pg_policies
 where schemaname = 'public' and tablename = 'coach_records'
   and policyname in ('org_read_libraries', 'org_add_to_libraries', 'org_change_libraries')
   and coalesce(qual, '') || coalesce(with_check, '') like '%monitoring_templates%';
