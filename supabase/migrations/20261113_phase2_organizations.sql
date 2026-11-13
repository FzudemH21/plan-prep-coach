-- Phase 2 of the organization layer (2026-11-13): organizations and their members, and an
-- organization link (org_id) on the coach's data. Every coach account gets its own organization with
-- the coach as owner, and all existing rows are linked to it.
--
-- Changes NO permission rule: who can read and change what stays exactly as before ("my data" by
-- coach_user_id). org_id is only filled in here; the Organization tab (phase 3) starts using it.
-- Only adds tables, columns, functions and triggers. Safe to run more than once.

-- ── 1. Organizations and members ────────────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- For now one organization per person (unique user_id), so "my organization" is always clear.
-- role: owner | coach | intern. rights: per-member rights, filled in by the Organization tab.
create table if not exists public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'coach' check (role in ('owner', 'coach', 'intern')),
  rights     jsonb not null default '{}',
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create unique index if not exists organization_members_one_org on public.organization_members (user_id);

-- The organization of the logged-in person (null for athletes and anyone without one)
create or replace function public.my_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.organization_members where user_id = auth.uid()
$$;

-- Members read their own organization and its member list. Nobody changes them from the app yet
-- (no insert / update / delete rules): that comes with the Organization tab.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
drop policy if exists "read_own_org" on public.organizations;
create policy "read_own_org" on public.organizations
  for select using (id = public.my_org_id());
drop policy if exists "read_own_org_members" on public.organization_members;
create policy "read_own_org_members" on public.organization_members
  for select using (org_id = public.my_org_id());

-- Creates an organization with this person as owner, unless they already belong to one.
-- Only callable from SQL and triggers, never from the app.
create or replace function public.create_own_org(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from organization_members where user_id = p_user;
  if v_org is not null then return v_org; end if;
  insert into organizations (name, created_by)
  select coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), 'My organization'), p_user
    from auth.users u where u.id = p_user
  returning id into v_org;
  if v_org is null then return null; end if;  -- no such user
  insert into organization_members (org_id, user_id, role, added_by) values (v_org, p_user, 'owner', p_user);
  return v_org;
end $$;
revoke execute on function public.create_own_org(uuid) from public, anon, authenticated;

-- A new coach account (added in SQL) gets its own organization right away
create or replace function public.coach_account_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.create_own_org(new.user_id);
  return new;
end $$;
drop trigger if exists coach_account_org_trg on public.coach_accounts;
create trigger coach_account_org_trg after insert on public.coach_accounts
  for each row execute function public.coach_account_org();

-- Every coach account that exists today
select public.create_own_org(user_id) from public.coach_accounts;

-- ── 2. org_id on the coach's data ───────────────────────────────────────────────────────────────
-- Filled automatically on every new row from its owner's organization — the app doesn't need to
-- know about it. From the app, org_id can't be chosen or changed (a row stays with the
-- organization it was created in, even if its coach leaves later); only SQL and server functions
-- can move rows.
create or replace function public.fill_org_id() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_app   boolean := coalesce(auth.role(), '') in ('authenticated', 'anon');
  v_owner text;
  v_org   uuid;
begin
  if tg_op = 'UPDATE' then
    if v_app then new.org_id := old.org_id; end if;
    return new;
  end if;
  if v_app or new.org_id is null then
    begin  -- a failing lookup must never block saving
      execute format('select ($1).%I::text', tg_argv[0]) into v_owner using new;
      select org_id into v_org from organization_members where user_id = v_owner::uuid;
    exception when others then
      v_org := null;
    end;
    new.org_id := v_org;
  end if;
  return new;
end $$;

-- Athletes, programs, libraries (exercises, methods, parameters, templates, sessions, tests /
-- events), anamnesis forms, privacy notice, documents index, AI memory and usage, deletion log.
-- Athlete data (logged sessions, tests, check-ins, chat…) is linked through its athlete's
-- connection and needs no column of its own. The old one-row tables are a frozen backup — not here.
-- Personal settings (coach_settings, coach_profiles) stay personal.
create temp table if not exists org_check (table_name text, total bigint, with_org bigint, coach_rows_without_org bigint);
truncate org_check;

do $$
declare
  t     text;
  own_col text;
  n     bigint;
begin
  for t, own_col in
    select * from (values
      ('athlete_connections', 'coach_user_id'), ('athlete_records', 'coach_user_id'),
      ('program_records', 'coach_user_id'), ('program_versions', 'coach_user_id'),
      ('coach_records', 'coach_user_id'), ('athlete_assignment_plans', 'coach_user_id'),
      ('anamnesis_templates', 'coach_user_id'), ('coach_privacy_notices', 'coach_user_id'),
      ('coach_session_remarks', 'coach_user_id'), ('exercise_progressions', 'coach_user_id'),
      ('exercise_param_tags', 'coach_user_id'), ('document_chunks', 'user_id'),
      ('plan_memory', 'coach_id'), ('ai_usage', 'user_id'), ('deletion_log', 'owner_user_id')
    ) as x(tbl, owner_column)
  loop
    -- Tables or owner columns missing in this project are skipped (and listed in the check)
    if not exists (
      select 1 from pg_attribute where attrelid = to_regclass('public.' || t) and attname = own_col and not attisdropped
    ) then
      insert into org_check values (t || ' (skipped: table or ' || own_col || ' missing)', null, null, null);
      continue;
    end if;

    execute format('alter table public.%I add column if not exists org_id uuid references public.organizations(id)', t);
    execute format('create index if not exists %I on public.%I (org_id)', t || '_org_id', t);
    execute format('drop trigger if exists fill_org_id_trg on public.%I', t);
    execute format('create trigger fill_org_id_trg before insert or update of org_id on public.%I
                    for each row execute function public.fill_org_id(%L)', t, own_col);

    -- Existing rows: their owner's organization (only rows without one; the owner column is compared
    -- as text so it works whatever its type)
    execute format('update public.%I d set org_id = m.org_id from public.organization_members m
                    where d.org_id is null and d.%I::text = m.user_id::text', t, own_col);

    execute format('insert into org_check select %L, count(*), count(org_id),
                      count(*) filter (where org_id is null and %I::text in (select user_id::text from public.coach_accounts))
                    from public.%I', t, own_col, t);
  end loop;
end $$;

-- ── Check ───────────────────────────────────────────────────────────────────────────────────────
-- First the organizations, then per table: rows, rows with an organization, and coach rows still
-- without one (should be 0 everywhere; rows of athletes or of deleted accounts may stay without).
select 'organization: ' || o.name as table_name, null::bigint as total, null::bigint as with_org,
       null::bigint as coach_rows_without_org, string_agg(u.email || ' (' || m.role || ')', ', ') as members
  from public.organizations o
  join public.organization_members m on m.org_id = o.id
  left join auth.users u on u.id = m.user_id
 group by o.id, o.name
union all
select table_name, total, with_org, coach_rows_without_org, null from org_check;
