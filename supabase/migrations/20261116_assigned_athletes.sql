-- Organizations (2026-11-16): coaches reach only the athletes assigned to them.
--
-- Replaces the "athletes" right of the rights grid:
--   owners  — every athlete of the organization (also those nobody is assigned to), full access
--   coaches — only the athletes assigned to them (athlete profile → Coaches), full access to their
--             data: profile, calendar, logged sessions, tests, chat, remarks, tests / events, files
--   health  — health data (anamneses with history, anamnesis files, daily check-ins) of an athlete
--             is visible to whoever reaches the athlete; changing it additionally needs the Health
--             tick. Anamnesis forms (the templates) are visible to every coach, changed with Health.
-- Organization-wide for every coach (no single athlete): assigned plans' details, e1RM tags, the
-- privacy notice (changed by owners).
--
-- Only the rules for members are replaced ("org_…" rules from 20261115_shared_athletes_programs);
-- the data owner's own rules stay — nobody's own data is touched, no row is changed. The "Recent
-- changes" list shows a coach only their athletes. Safe to run more than once.

-- ── Helpers ──────────────────────────────────────────────────────────────────────────────────────

-- The athletes (athlete_records.id) the logged-in person reaches: owners all of the organization's,
-- coaches the ones whose coach list (data → athlete → coachIds) holds them
create or replace function public.my_athlete_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select r.id from athlete_records r
   where r.coach_user_id = public.my_data_owner()
     and left(r.id, 1) <> '_'
     and (public.my_org_role() = 'owner'
          or coalesce(r.data->'athlete'->'coachIds', '[]'::jsonb) ? auth.uid()::text)
$$;

-- Their app connections
create or replace function public.my_connection_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from athlete_connections c
   where c.coach_user_id = public.my_data_owner()
     and c.athlete_local_id in (select public.my_athlete_ids())
$$;

-- Their anamneses
create or replace function public.my_anamnesis_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select a.id from athlete_anamneses a
   where a.coach_user_id = public.my_data_owner()
     and a.athlete_local_id in (select public.my_athlete_ids())
$$;

revoke execute on function public.my_athlete_ids(), public.my_connection_ids(), public.my_anamnesis_ids() from public, anon;
grant execute on function public.my_athlete_ids(), public.my_connection_ids(), public.my_anamnesis_ids() to authenticated;

-- ── Rules ────────────────────────────────────────────────────────────────────────────────────────
-- (table, read rule, write rule; null write rule = read only). OWN = row of the organization's data
-- owner; the athlete-, connection- and anamnesis-ids come from the helpers above.
do $$
declare
  r record;
  own text := '%s::text = (select public.my_data_owner())::text';
  health text := '(select public.org_can(''health''))';
  pr text;
  pw text;
begin
  for r in
    select * from (values
      -- (also checked on the row itself: a just-created athlete is reachable at once, and an athlete
      --  handed to another coach can still be saved in that same change)
      ('athlete_records',          'coach_user_id',
         'and (id = ''_shared'' or id in (select public.my_athlete_ids())
               or coalesce(data->''athlete''->''coachIds'', ''[]''::jsonb) ? (select auth.uid())::text
               or (select public.my_org_role()) = ''owner'')',
         -- a new athlete must list its coach (the app adds the creator); owners may add any
         'and (id = ''_shared'' or id in (select public.my_athlete_ids())
               or coalesce(data->''athlete''->''coachIds'', ''[]''::jsonb) ? (select auth.uid())::text
               or (select public.my_org_role()) = ''owner'')'),
      ('athlete_connections',      'coach_user_id',
         'and athlete_local_id in (select public.my_athlete_ids())', 'same'),
      ('coach_session_remarks',    'coach_user_id',
         'and athlete_connection_id in (select public.my_connection_ids())', 'same'),
      ('athlete_assignment_plans', 'coach_user_id', '', 'same'),
      ('exercise_param_tags',      'coach_user_id', '', 'same'),
      ('athlete_anamneses',        'coach_user_id',
         'and athlete_local_id in (select public.my_athlete_ids())', 'health'),
      ('anamnesis_change_log',     'coach_user_id',
         'and anamnesis_id in (select public.my_anamnesis_ids())', 'health'),
      ('anamnesis_templates',      'coach_user_id', '', 'health')
    ) as x(tbl, owner_col, cond, wcond)
  loop
    if not exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || r.tbl)
                   and attname = r.owner_col and not attisdropped) then
      raise notice 'skipped %: table or column % missing', r.tbl, r.owner_col;
      continue;
    end if;
    pr := format(own, quote_ident(r.owner_col)) || ' ' || r.cond;
    pw := case r.wcond when 'same' then pr
                       when 'health' then pr || ' and ' || health
                       else format(own, quote_ident(r.owner_col)) || ' ' || r.wcond end;

    execute format('drop policy if exists "org_read" on public.%I', r.tbl);
    execute format('create policy "org_read" on public.%I for select to authenticated using (%s)', r.tbl, pr);
    execute format('drop policy if exists "org_add" on public.%I', r.tbl);
    execute format('create policy "org_add" on public.%I for insert to authenticated with check (%s)', r.tbl, pw);
    execute format('drop policy if exists "org_change" on public.%I', r.tbl);
    -- Changing needs the row to be reachable before (read rule + write rights) and after
    execute format('create policy "org_change" on public.%I for update to authenticated using (%s) with check (%s)',
                   r.tbl, case when r.tbl = 'athlete_records' then pr else pw end, pw);
    execute format('drop policy if exists "org_delete" on public.%I', r.tbl);
    execute format('create policy "org_delete" on public.%I for delete to authenticated using (%s)',
                   r.tbl, case when r.tbl = 'athlete_records' then pr else pw end);

    execute format('drop trigger if exists keep_row_owner_trg on public.%I', r.tbl);
    execute format('create trigger keep_row_owner_trg before update of %I on public.%I
                    for each row execute function public.keep_row_owner(%L)', r.owner_col, r.tbl, r.owner_col);
  end loop;
end $$;

-- The privacy notice: every member reads it, only owners change it
drop policy if exists "org_read" on public.coach_privacy_notices;
create policy "org_read" on public.coach_privacy_notices for select to authenticated
  using (coach_user_id = (select public.my_data_owner()));

-- Tests / events (coach_records, store calendar_events, one row "a:<athlete>" per athlete)
drop policy if exists "org_read_calendar_events" on public.coach_records;
create policy "org_read_calendar_events" on public.coach_records for select to authenticated
  using (store = 'calendar_events' and coach_user_id = (select public.my_data_owner())
         and substr(id, 3) in (select public.my_athlete_ids()));
drop policy if exists "org_add_calendar_events" on public.coach_records;
create policy "org_add_calendar_events" on public.coach_records for insert to authenticated
  with check (store = 'calendar_events' and coach_user_id = (select public.my_data_owner())
              and substr(id, 3) in (select public.my_athlete_ids()));
drop policy if exists "org_change_calendar_events" on public.coach_records;
create policy "org_change_calendar_events" on public.coach_records for update to authenticated
  using (store = 'calendar_events' and coach_user_id = (select public.my_data_owner())
         and substr(id, 3) in (select public.my_athlete_ids()))
  with check (store = 'calendar_events' and coach_user_id = (select public.my_data_owner())
              and substr(id, 3) in (select public.my_athlete_ids()));

-- Athlete data reached through the athlete's app connection
do $$
declare
  r record;
  pr text;
begin
  for r in
    select * from (values
      -- table,                  connection column,       coaches may write
      ('athlete_session_logs',   'athlete_connection_id', true),
      ('athlete_schedule',       'athlete_connection_id', true),
      ('athlete_test_results',   'athlete_connection_id', true),
      ('chat_messages',          'connection_id',         true),
      ('athlete_daily_checkins', 'athlete_connection_id', false)   -- written by the athlete only
    ) as x(tbl, conn_col, writes)
  loop
    if not exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || r.tbl)
                   and attname = r.conn_col and not attisdropped) then
      raise notice 'skipped %: table or column % missing', r.tbl, r.conn_col;
      continue;
    end if;
    pr := format('%I in (select public.my_connection_ids())', r.conn_col);
    execute format('drop policy if exists "org_read" on public.%I', r.tbl);
    execute format('create policy "org_read" on public.%I for select to authenticated using (%s)', r.tbl, pr);
    execute format('drop policy if exists "org_add" on public.%I', r.tbl);
    execute format('drop policy if exists "org_change" on public.%I', r.tbl);
    execute format('drop policy if exists "org_delete" on public.%I', r.tbl);
    if r.writes then
      execute format('create policy "org_add" on public.%I for insert to authenticated with check (%s)', r.tbl, pr);
      execute format('create policy "org_change" on public.%I for update to authenticated using (%s) with check (%s)', r.tbl, pr, pr);
      execute format('create policy "org_delete" on public.%I for delete to authenticated using (%s)', r.tbl, pr);
    end if;
  end loop;
end $$;

-- ── Files ────────────────────────────────────────────────────────────────────────────────────────
-- Test attachments (athlete-uploads/<connection>/…)
drop policy if exists "org_athlete_uploads_read" on storage.objects;
create policy "org_athlete_uploads_read" on storage.objects for select to authenticated
  using (bucket_id = 'athlete-uploads'
         and (storage.foldername(name))[1] in (select c::text from public.my_connection_ids() c));
drop policy if exists "org_athlete_uploads_delete" on storage.objects;
create policy "org_athlete_uploads_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'athlete-uploads'
         and (storage.foldername(name))[1] in (select c::text from public.my_connection_ids() c));

-- Chat files (documents/chat/<connection>/…)
drop policy if exists "org_chat_files_read" on storage.objects;
create policy "org_chat_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'chat'
         and (storage.foldername(name))[2] in (select c::text from public.my_connection_ids() c));
drop policy if exists "org_chat_files_add" on storage.objects;
create policy "org_chat_files_add" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'chat'
              and (storage.foldername(name))[2] in (select c::text from public.my_connection_ids() c));
drop policy if exists "org_chat_files_delete" on storage.objects;
create policy "org_chat_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'chat'
         and (storage.foldername(name))[2] in (select c::text from public.my_connection_ids() c));

-- Anamnesis attachments (documents/anamnesis/<data owner>/<athlete>/…) — health data
drop policy if exists "org_anamnesis_files_read" on storage.objects;
create policy "org_anamnesis_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis'
         and (storage.foldername(name))[2] = (select public.my_data_owner())::text
         and (storage.foldername(name))[3] in (select public.my_athlete_ids()));
drop policy if exists "org_anamnesis_files_add" on storage.objects;
create policy "org_anamnesis_files_add" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis'
              and (storage.foldername(name))[2] = (select public.my_data_owner())::text
              and (storage.foldername(name))[3] in (select public.my_athlete_ids())
              and (select public.org_can('health')));
drop policy if exists "org_anamnesis_files_delete" on storage.objects;
create policy "org_anamnesis_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis'
         and (storage.foldername(name))[2] = (select public.my_data_owner())::text
         and (storage.foldername(name))[3] in (select public.my_athlete_ids())
         and (select public.org_can('health')));

-- Files athletes added in an anamnesis form (documents/anamnesis-form/<anamnesis>/…) — health data
drop policy if exists "org_anamnesis_form_files_read" on storage.objects;
create policy "org_anamnesis_form_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis-form'
         and (storage.foldername(name))[2] in (select a::text from public.my_anamnesis_ids() a));
drop policy if exists "org_anamnesis_form_files_delete" on storage.objects;
create policy "org_anamnesis_form_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis-form'
         and (storage.foldername(name))[2] in (select a::text from public.my_anamnesis_ids() a)
         and (select public.org_can('health')));

-- Athlete documents (documents/athlete-docs/<athlete>/…), uploaded by a coach of the organization
drop policy if exists "org_athlete_docs_read" on storage.objects;
create policy "org_athlete_docs_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'athlete-docs'
         and (storage.foldername(name))[2] in (select public.my_athlete_ids())
         and coalesce(owner_id, owner::text) in (select m.user_id::text from public.organization_members m where m.org_id = (select public.my_org_id())));
drop policy if exists "org_athlete_docs_delete" on storage.objects;
create policy "org_athlete_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'athlete-docs'
         and (storage.foldername(name))[2] in (select public.my_athlete_ids())
         and coalesce(owner_id, owner::text) in (select m.user_id::text from public.organization_members m where m.org_id = (select public.my_org_id())));

-- ── Recent changes: a coach sees changes to their athletes only (programs and libraries: all) ──
do $$
begin
  if to_regclass('public.activity_log') is not null then
    drop policy if exists "org_reads_activity" on public.activity_log;
    create policy "org_reads_activity" on public.activity_log for select to authenticated
      using (org_id = (select public.my_org_id())
             and (table_name <> 'athlete_records' or record_id in (select public.my_athlete_ids()))
             and (record_id not like 'calendar\_events/%' or substr(record_id, 19) in (select public.my_athlete_ids())));
  end if;
end $$;

-- Check: per member, how many athletes they reach (owners: all)
select u.email, m.role,
       (select count(*) from public.athlete_records r
         where r.coach_user_id = coalesce(o.data_owner, o.created_by) and left(r.id, 1) <> '_'
           and (m.role = 'owner' or coalesce(r.data->'athlete'->'coachIds', '[]'::jsonb) ? m.user_id::text)) as athletes_reached,
       public.org_member_rights(m.role, m.rights)->'health' as health_edit
  from public.organization_members m
  join public.organizations o on o.id = m.org_id
  left join auth.users u on u.id = m.user_id
 where (select count(*) from public.organization_members x where x.org_id = m.org_id) > 1
 order by o.created_at, m.created_at;
