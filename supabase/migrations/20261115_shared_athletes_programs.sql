-- Organizations (2026-11-15): members share the organization's athletes and programs.
--
-- The organization's data lives in the account of its data owner. Members reach it within their
-- rights (Organization tab grid):
--   athletes   view / edit — athletes, app connections, calendar, logged sessions, tests, chat,
--                            session remarks, tests / events, e1RM tags, assigned plans, files
--   health     on / off    — additionally needed for anamneses (+ history, forms, files) and
--                            daily check-ins (wellness / pain)
--   programs   view / edit — programs, their versions, the AI's plan memory
-- Only ADDS rules (for logged-in members): every existing rule stays, nobody loses access. From
-- the app a row can't change its owner account. Safe to run more than once.

-- ── 1. Rows owned by the data owner ─────────────────────────────────────────────────────────────
do $$
declare
  r record;
  pred_view text;
  pred_edit text;
begin
  for r in
    select * from (values
      -- table,                     owner column,    area,       needs health
      ('athlete_connections',       'coach_user_id', 'athletes', false),
      ('athlete_records',           'coach_user_id', 'athletes', false),
      ('athlete_assignment_plans',  'coach_user_id', 'athletes', false),
      ('coach_session_remarks',     'coach_user_id', 'athletes', false),
      ('exercise_param_tags',       'coach_user_id', 'athletes', false),
      ('athlete_anamneses',         'coach_user_id', 'athletes', true),
      ('anamnesis_change_log',      'coach_user_id', 'athletes', true),
      ('anamnesis_templates',       'coach_user_id', 'athletes', true),
      ('program_records',           'coach_user_id', 'programs', false),
      ('program_versions',          'coach_user_id', 'programs', false),
      ('plan_memory',               'coach_id',      'programs', false)
    ) as x(tbl, owner_col, area, health)
  loop
    if not exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || r.tbl)
                   and attname = r.owner_col and not attisdropped) then
      raise notice 'skipped %: table or column % missing', r.tbl, r.owner_col;
      continue;
    end if;
    pred_view := format('%I::text = (select public.my_data_owner())::text and (select public.org_can(%L, ''view''))%s',
                        r.owner_col, r.area, case when r.health then ' and (select public.org_can(''health''))' else '' end);
    pred_edit := format('%I::text = (select public.my_data_owner())::text and (select public.org_can(%L, ''edit''))%s',
                        r.owner_col, r.area, case when r.health then ' and (select public.org_can(''health''))' else '' end);

    execute format('drop policy if exists "org_read" on public.%I', r.tbl);
    execute format('create policy "org_read" on public.%I for select to authenticated using (%s)', r.tbl, pred_view);
    execute format('drop policy if exists "org_add" on public.%I', r.tbl);
    execute format('create policy "org_add" on public.%I for insert to authenticated with check (%s)', r.tbl, pred_edit);
    execute format('drop policy if exists "org_change" on public.%I', r.tbl);
    execute format('create policy "org_change" on public.%I for update to authenticated using (%s) with check (%s)', r.tbl, pred_edit, pred_edit);
    execute format('drop policy if exists "org_delete" on public.%I', r.tbl);
    execute format('create policy "org_delete" on public.%I for delete to authenticated using (%s)', r.tbl, pred_edit);

    execute format('drop trigger if exists keep_row_owner_trg on public.%I', r.tbl);
    execute format('create trigger keep_row_owner_trg before update of %I on public.%I
                    for each row execute function public.keep_row_owner(%L)', r.owner_col, r.tbl, r.owner_col);
  end loop;
end $$;

-- The privacy notice (shown in anamnesis forms) is the organization's: every member reads it,
-- only owners change it
drop policy if exists "org_read" on public.coach_privacy_notices;
create policy "org_read" on public.coach_privacy_notices for select to authenticated
  using (coach_user_id = (select public.my_data_owner()) and (select public.org_can('athletes', 'view')));
drop policy if exists "org_owner_writes" on public.coach_privacy_notices;
create policy "org_owner_writes" on public.coach_privacy_notices for all to authenticated
  using (coach_user_id = (select public.my_data_owner()) and (select public.my_org_role()) = 'owner')
  with check (coach_user_id = (select public.my_data_owner()) and (select public.my_org_role()) = 'owner');
drop trigger if exists keep_row_owner_trg on public.coach_privacy_notices;
create trigger keep_row_owner_trg before update of coach_user_id on public.coach_privacy_notices
  for each row execute function public.keep_row_owner('coach_user_id');

-- Tests / events (coach_records, store calendar_events) are athlete data
drop policy if exists "org_read_calendar_events" on public.coach_records;
create policy "org_read_calendar_events" on public.coach_records for select to authenticated
  using (store = 'calendar_events' and coach_user_id = (select public.my_data_owner())
         and (select public.org_can('athletes', 'view')));
drop policy if exists "org_add_calendar_events" on public.coach_records;
create policy "org_add_calendar_events" on public.coach_records for insert to authenticated
  with check (store = 'calendar_events' and coach_user_id = (select public.my_data_owner())
              and (select public.org_can('athletes', 'edit')));
drop policy if exists "org_change_calendar_events" on public.coach_records;
create policy "org_change_calendar_events" on public.coach_records for update to authenticated
  using (store = 'calendar_events' and coach_user_id = (select public.my_data_owner())
         and (select public.org_can('athletes', 'edit')))
  with check (store = 'calendar_events' and coach_user_id = (select public.my_data_owner())
              and (select public.org_can('athletes', 'edit')));

-- ── 2. Athlete data reached through the athlete's app connection ────────────────────────────────
do $$
declare
  r record;
  pred_view text;
  pred_edit text;
begin
  for r in
    select * from (values
      -- table,                    connection column,       needs health, coaches may write
      ('athlete_session_logs',     'athlete_connection_id', false, true),
      ('athlete_schedule',         'athlete_connection_id', false, true),
      ('athlete_test_results',     'athlete_connection_id', false, true),
      ('chat_messages',            'connection_id',         false, true),
      ('athlete_daily_checkins',   'athlete_connection_id', true,  false)
    ) as x(tbl, conn_col, health, writes)
  loop
    if not exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || r.tbl)
                   and attname = r.conn_col and not attisdropped) then
      raise notice 'skipped %: table or column % missing', r.tbl, r.conn_col;
      continue;
    end if;
    pred_view := format('%I in (select c.id from public.athlete_connections c where c.coach_user_id = (select public.my_data_owner()))
                         and (select public.org_can(''athletes'', ''view''))%s',
                        r.conn_col, case when r.health then ' and (select public.org_can(''health''))' else '' end);
    pred_edit := replace(pred_view, '''view''', '''edit''');

    execute format('drop policy if exists "org_read" on public.%I', r.tbl);
    execute format('create policy "org_read" on public.%I for select to authenticated using (%s)', r.tbl, pred_view);
    execute format('drop policy if exists "org_add" on public.%I', r.tbl);
    execute format('drop policy if exists "org_change" on public.%I', r.tbl);
    execute format('drop policy if exists "org_delete" on public.%I', r.tbl);
    if r.writes then
      execute format('create policy "org_add" on public.%I for insert to authenticated with check (%s)', r.tbl, pred_edit);
      execute format('create policy "org_change" on public.%I for update to authenticated using (%s) with check (%s)', r.tbl, pred_edit, pred_edit);
      execute format('create policy "org_delete" on public.%I for delete to authenticated using (%s)', r.tbl, pred_edit);
    end if;
  end loop;
end $$;

-- ── 3. Files ────────────────────────────────────────────────────────────────────────────────────
-- Test attachments (athlete-uploads/<connection>/…)
drop policy if exists "org_athlete_uploads_read" on storage.objects;
create policy "org_athlete_uploads_read" on storage.objects for select to authenticated
  using (bucket_id = 'athlete-uploads'
         and (storage.foldername(name))[1] in (select c.id::text from public.athlete_connections c
                                               where c.coach_user_id = (select public.my_data_owner()))
         and (select public.org_can('athletes', 'view')));
drop policy if exists "org_athlete_uploads_delete" on storage.objects;
create policy "org_athlete_uploads_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'athlete-uploads'
         and (storage.foldername(name))[1] in (select c.id::text from public.athlete_connections c
                                               where c.coach_user_id = (select public.my_data_owner()))
         and (select public.org_can('athletes', 'edit')));

-- Chat files (documents/chat/<connection>/…)
drop policy if exists "org_chat_files_read" on storage.objects;
create policy "org_chat_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'chat'
         and (storage.foldername(name))[2] in (select c.id::text from public.athlete_connections c
                                               where c.coach_user_id = (select public.my_data_owner()))
         and (select public.org_can('athletes', 'view')));
drop policy if exists "org_chat_files_add" on storage.objects;
create policy "org_chat_files_add" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'chat'
              and (storage.foldername(name))[2] in (select c.id::text from public.athlete_connections c
                                                    where c.coach_user_id = (select public.my_data_owner()))
              and (select public.org_can('athletes', 'edit')));
drop policy if exists "org_chat_files_delete" on storage.objects;
create policy "org_chat_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'chat'
         and (storage.foldername(name))[2] in (select c.id::text from public.athlete_connections c
                                               where c.coach_user_id = (select public.my_data_owner()))
         and (select public.org_can('athletes', 'edit')));

-- Anamnesis attachments and dictations (documents/anamnesis/<data owner>/…) — health data
drop policy if exists "org_anamnesis_files_read" on storage.objects;
create policy "org_anamnesis_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis'
         and (storage.foldername(name))[2] = (select public.my_data_owner())::text
         and (select public.org_can('athletes', 'view')) and (select public.org_can('health')));
drop policy if exists "org_anamnesis_files_add" on storage.objects;
create policy "org_anamnesis_files_add" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis'
              and (storage.foldername(name))[2] = (select public.my_data_owner())::text
              and (select public.org_can('athletes', 'edit')) and (select public.org_can('health')));
drop policy if exists "org_anamnesis_files_delete" on storage.objects;
create policy "org_anamnesis_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis'
         and (storage.foldername(name))[2] = (select public.my_data_owner())::text
         and (select public.org_can('athletes', 'edit')) and (select public.org_can('health')));

-- Files athletes added in an anamnesis form (documents/anamnesis-form/<anamnesis>/…) — health data
drop policy if exists "org_anamnesis_form_files_read" on storage.objects;
create policy "org_anamnesis_form_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis-form'
         and (storage.foldername(name))[2] in (select a.id::text from public.athlete_anamneses a
                                               where a.coach_user_id = (select public.my_data_owner()))
         and (select public.org_can('athletes', 'view')) and (select public.org_can('health')));
drop policy if exists "org_anamnesis_form_files_delete" on storage.objects;
create policy "org_anamnesis_form_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis-form'
         and (storage.foldername(name))[2] in (select a.id::text from public.athlete_anamneses a
                                               where a.coach_user_id = (select public.my_data_owner()))
         and (select public.org_can('athletes', 'edit')) and (select public.org_can('health')));

-- Athlete documents (documents/athlete-docs/<athlete>/…), uploaded by any coach of the organization
drop policy if exists "org_athlete_docs_read" on storage.objects;
create policy "org_athlete_docs_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'athlete-docs'
         and coalesce(owner_id, owner::text) in (select m.user_id::text from public.organization_members m where m.org_id = (select public.my_org_id()))
         and (select public.org_can('athletes', 'view')));
drop policy if exists "org_athlete_docs_delete" on storage.objects;
create policy "org_athlete_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'athlete-docs'
         and coalesce(owner_id, owner::text) in (select m.user_id::text from public.organization_members m where m.org_id = (select public.my_org_id()))
         and (select public.org_can('athletes', 'edit')));

-- Check: the organization's data members now share
select o.name as organization,
       (select count(*) from public.athlete_records a where a.coach_user_id = coalesce(o.data_owner, o.created_by) and a.deleted_at is null) as athletes,
       (select count(*) from public.athlete_connections c where c.coach_user_id = coalesce(o.data_owner, o.created_by)) as app_connections,
       (select count(*) from public.program_records p where p.coach_user_id = coalesce(o.data_owner, o.created_by) and p.deleted_at is null) as programs,
       (select count(*) from public.athlete_anamneses a where a.coach_user_id = coalesce(o.data_owner, o.created_by)) as anamneses
  from public.organizations o
 order by o.created_at;
