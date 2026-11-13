-- Phase 1 of the organization layer (2026-11-13): the coach's libraries one row per item.
--
-- Until now each library was ONE row per coach (custom_libraries, toolbox_data, parameters_database,
-- programming_templates, session_library, calendar_events): every save rewrote the whole library,
-- and one bad save could empty it. Now every item has its own row in coach_records:
--   store 'exercises'        one row per exercise library, exercise and circuit
--   store 'methods'          one row per training method (its parameters and description)
--   store 'parameters'       one row per parameter, interaction, method link and level set
--   store 'templates'        one row per programming template
--   store 'workouts'         one row per session of the session library
--   store 'calendar_events'  one row per athlete (their tests and events)
-- plus a row '_meta' per store (order of the items, settings). A save writes only the rows that
-- changed. Deleting keeps the row with deleted_at set.
--
-- The app copies everything over by itself on the next load; the old tables are left as they are
-- (a frozen backup). Only adds a table, rules and triggers — no existing row or rule is changed.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.coach_records (
  coach_user_id uuid not null references auth.users (id) on delete cascade,
  store text not null,
  id text not null,
  data jsonb not null,
  deleted_at timestamptz,                    -- set when deleted on purpose
  updated_at timestamptz not null default now(),
  primary key (coach_user_id, store, id)
);

alter table public.coach_records enable row level security;

drop policy if exists "Coach reads own records" on public.coach_records;
create policy "Coach reads own records" on public.coach_records
  for select using (auth.uid() = coach_user_id);

drop policy if exists "Coach inserts own records" on public.coach_records;
create policy "Coach inserts own records" on public.coach_records
  for insert with check (auth.uid() = coach_user_id);

drop policy if exists "Coach updates own records" on public.coach_records;
create policy "Coach updates own records" on public.coach_records
  for update using (auth.uid() = coach_user_id) with check (auth.uid() = coach_user_id);

-- Athletes read their coach's exercise library (names, videos, descriptions in the athlete app,
-- as they could from custom_libraries) — nothing else of coach_records
drop policy if exists "Athlete reads own coach's exercise library" on public.coach_records;
create policy "Athlete reads own coach's exercise library" on public.coach_records
  for select using (
    store = 'exercises'
    and deleted_at is null
    and exists (
      select 1 from public.athlete_connections ac
      where ac.athlete_auth_user_id = auth.uid()
        and ac.coach_user_id = coach_records.coach_user_id
    )
  );

-- Deletion log (phase 0): the store goes into the record id ("exercises/ex:…"), a few more names
-- into the label. Otherwise unchanged.
create or replace function public.log_deletion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r       jsonb;
  v_conn  uuid;
  v_owner uuid;
  v_kind  text := 'delete';
begin
  if tg_op = 'UPDATE' then
    -- Only the moment a record gets its deletion mark
    if old.deleted_at is not null or new.deleted_at is null then return new; end if;
    r := to_jsonb(new);
    v_kind := 'soft-delete';
  else
    r := to_jsonb(old);
  end if;

  begin  -- a failing log entry must never block the deletion itself
  v_conn := case when tg_table_name = 'athlete_connections' then (r->>'id')::uuid
                 else nullif(r->>'athlete_connection_id', '')::uuid end;
  v_owner := coalesce(nullif(r->>'coach_user_id', '')::uuid, nullif(r->>'user_id', '')::uuid);
  if v_owner is null and v_conn is not null then
    select coach_user_id into v_owner from athlete_connections where id = v_conn;
  end if;
  -- Removed together with its athlete's connection: the connection is already gone — the coach
  -- who deleted it owns the data
  v_owner := coalesce(v_owner, auth.uid());

  insert into deletion_log (table_name, record_id, label, owner_user_id, athlete_connection_id, deleted_by, kind, data)
  values (
    tg_table_name,
    case when r ? 'store' then (r->>'store') || '/' || (r->>'id') else r->>'id' end,
    left(coalesce(
      r->>'session_name', r->>'athlete_name', r->>'name', r->>'title', r->'data'->>'name',
      r->'data'->>'title', r->'data'->>'subCategory',
      r->'data'->'data'->>'name', r->'data'->'data'->>'exercise',
      nullif(trim(coalesce(r->'data'->>'firstName', '') || ' ' || coalesce(r->'data'->>'lastName', '')), ''),
      r->>'date'
    ), 200),
    v_owner, v_conn, auth.uid(), v_kind,
    case when v_kind = 'delete' then r else null end
  );
  exception when others then
    raise warning 'deletion_log: % on %', sqlerrm, tg_table_name;
  end;
  return case when tg_op = 'UPDATE' then new else old end;
end $$;

drop trigger if exists log_deletion_trg on public.coach_records;
create trigger log_deletion_trg after delete on public.coach_records
  for each row execute function public.log_deletion();
drop trigger if exists log_soft_deletion_trg on public.coach_records;
create trigger log_soft_deletion_trg after update of deleted_at on public.coach_records
  for each row execute function public.log_deletion();

-- Check: the table exists (empty until the app copies the libraries on the next load)
select count(*) as rows_in_coach_records from public.coach_records;
