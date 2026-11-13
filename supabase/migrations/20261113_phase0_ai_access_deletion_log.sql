-- Phase 0 of the organization layer (2026-11-13): AI only for coaches, an AI usage log, and a
-- deletion log. Only adds tables, functions and triggers — no existing row or rule is changed.

-- ── 1. Coach accounts: who may use the AI ───────────────────────────────────────────────────────
-- Written only here in SQL (no insert/update rule for app users), so nobody can make themselves a
-- coach. Replaced by organization membership + rights in a later phase.
create table if not exists public.coach_accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  ai_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.coach_accounts enable row level security;
drop policy if exists "read_own_coach_account" on public.coach_accounts;
create policy "read_own_coach_account" on public.coach_accounts
  for select using (user_id = auth.uid());

-- Everyone who already has coach data today (athletes never own these rows)
insert into public.coach_accounts (user_id)
select coach_user_id from public.athlete_connections where coach_user_id is not null
union select coach_user_id from public.program_records where coach_user_id is not null
union select coach_user_id from public.athlete_records where coach_user_id is not null
union select coach_user_id from public.coach_settings where coach_user_id is not null
on conflict (user_id) do nothing;

-- ── 2. AI usage log ─────────────────────────────────────────────────────────────────────────────
-- One row per AI call, written by the ai-proxy function. Coaches can read their own.
create table if not exists public.ai_usage (
  id                 bigserial primary key,
  user_id            uuid not null,
  created_at         timestamptz not null default now(),
  target             text not null,          -- anthropic | mistral-embed | mistral-transcribe
  model              text,
  status             int,
  input_tokens       int,
  output_tokens      int,
  cache_read_tokens  int,
  cache_write_tokens int,
  usage              jsonb
);
create index if not exists ai_usage_user_time on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
drop policy if exists "read_own_ai_usage" on public.ai_usage;
create policy "read_own_ai_usage" on public.ai_usage
  for select using (user_id = auth.uid());

-- ── 3. Deletion log ─────────────────────────────────────────────────────────────────────────────
-- Every deletion of athlete data, programs, athletes, anamneses, chat messages… : what, when, by
-- whom, and a copy of the deleted row (kept 30 days, so it can be brought back). Written only by
-- the trigger below; the coach who owns the data can read it.
create table if not exists public.deletion_log (
  id                    bigserial primary key,
  table_name            text not null,
  record_id             text,
  label                 text,
  owner_user_id         uuid,
  athlete_connection_id uuid,
  deleted_by            uuid,
  deleted_at            timestamptz not null default now(),
  kind                  text not null default 'delete',  -- delete | soft-delete (deletion mark)
  data                  jsonb
);
create index if not exists deletion_log_owner_time on public.deletion_log (owner_user_id, deleted_at desc);
alter table public.deletion_log enable row level security;
drop policy if exists "read_own_deletions" on public.deletion_log;
create policy "read_own_deletions" on public.deletion_log
  for select using (owner_user_id = auth.uid());

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
    r->>'id',
    left(coalesce(
      r->>'session_name', r->>'athlete_name', r->>'name', r->>'title', r->'data'->>'name',
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

-- Attach to the tables that hold real data (tables missing in this project are skipped). Not to
-- athlete_schedule, document_chunks, plan_memory, exercise_param_tags: those are rebuilt
-- automatically all the time and would only fill the log.
do $$
declare t text;
begin
  foreach t in array array[
    'athlete_session_logs', 'athlete_test_results', 'athlete_daily_checkins', 'athlete_anamneses',
    'anamnesis_templates', 'athlete_connections', 'chat_messages', 'documents',
    'coach_session_remarks', 'athlete_assignment_plans', 'program_versions',
    'program_records', 'athlete_records'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists log_deletion_trg on public.%I', t);
      execute format('create trigger log_deletion_trg after delete on public.%I for each row execute function public.log_deletion()', t);
    end if;
  end loop;
  -- Programs and athletes are deleted with a deletion mark (the row stays)
  foreach t in array array['program_records', 'athlete_records'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists log_soft_deletion_trg on public.%I', t);
      execute format('create trigger log_soft_deletion_trg after update of deleted_at on public.%I for each row execute function public.log_deletion()', t);
    end if;
  end loop;
end $$;

-- Copies of deleted rows are kept 30 days, the entries themselves one year
create extension if not exists pg_cron with schema extensions;
select cron.unschedule('deletion_log_cleanup') where exists (select 1 from cron.job where jobname = 'deletion_log_cleanup');
select cron.schedule('deletion_log_cleanup', '17 3 * * *', $$
  update public.deletion_log set data = null where data is not null and deleted_at < now() - interval '30 days';
  delete from public.deletion_log where deleted_at < now() - interval '365 days';
$$);

-- Check: who may use the AI now (should be you — and any other coach account you use)
select c.user_id, u.email, c.ai_enabled from public.coach_accounts c join auth.users u on u.id = c.user_id;
