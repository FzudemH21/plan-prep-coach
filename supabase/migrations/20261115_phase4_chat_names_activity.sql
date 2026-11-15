-- Organizations, phase 4: who wrote what in the athlete chat, and who changed what.
--
-- 1. Chat sender names. Several coaches of an organization write in the same athlete chat. Each
--    coach message gets the writer's name (coach profile name, else the account's full name, else
--    "Coach" — never the e-mail, the athlete sees it). Filled by the database on every new
--    message; the app can't choose or change it. Old coach messages get it once below.
--
-- 2. Activity log. Creating, changing and restoring programs, athletes and library items
--    (exercises, methods, parameters, templates, sessions, tests & events) is noted with who and
--    when — only in organizations with more than one coach, and only for changes made in the app.
--    Several changes of the same item by the same person within 30 minutes are one entry. Entries
--    older than 180 days are removed. Deletions stay in the deletion log as before. Members of the
--    organization read their organization's entries; nobody can write them from the app. A failing
--    entry never blocks the save itself.
--
-- Only adds a column, a table, rules and triggers — no existing row (except filling the new
-- sender name) or rule is changed. The app works before and after.

-- ── 1. Chat sender names ─────────────────────────────────────────────────────────────────────────

alter table public.chat_messages add column if not exists sender_name text;

create or replace function public.coach_display_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(cp.name), '') from coach_profiles cp where cp.user_id = p_user),
    (select nullif(trim(u.raw_user_meta_data->>'full_name'), '') from auth.users u where u.id = p_user),
    'Coach')
$$;
revoke execute on function public.coach_display_name(uuid) from public, anon, authenticated;

create or replace function public.fill_chat_sender_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    -- From the app the name stays as it was written
    if coalesce(auth.role(), '') in ('authenticated', 'anon') then new.sender_name := old.sender_name; end if;
    return new;
  end if;
  new.sender_name := case when new.sender_role = 'coach' then public.coach_display_name(new.sender_auth_user_id) end;
  return new;
end $$;

drop trigger if exists fill_chat_sender_name_trg on public.chat_messages;
create trigger fill_chat_sender_name_trg before insert or update of sender_name on public.chat_messages
  for each row execute function public.fill_chat_sender_name();

-- Existing coach messages (run from the SQL editor: the trigger lets this through)
update public.chat_messages
   set sender_name = public.coach_display_name(sender_auth_user_id)
 where sender_role = 'coach' and sender_name is null;

-- ── 2. Activity log ──────────────────────────────────────────────────────────────────────────────

create table if not exists public.activity_log (
  id         bigserial primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  actor      uuid not null,             -- who (auth user)
  table_name text not null,             -- program_records / athlete_records / coach_records
  record_id  text not null,             -- coach_records: "<store>/<id>"
  label      text,                      -- the item's name at the time
  kind       text not null check (kind in ('create', 'change', 'restore')),
  first_at   timestamptz not null default now(),
  at         timestamptz not null default now()
);
create index if not exists activity_log_org_at on public.activity_log (org_id, at desc);
create index if not exists activity_log_item on public.activity_log (table_name, record_id, actor, at desc);

alter table public.activity_log enable row level security;
revoke insert, update, delete, truncate on public.activity_log from anon, authenticated;
drop policy if exists "org_reads_activity" on public.activity_log;
create policy "org_reads_activity" on public.activity_log for select to authenticated
  using (org_id = (select public.my_org_id()));

create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r       jsonb;
  o       jsonb;
  v_actor uuid;
  v_org   uuid;
  v_rid   text;
  v_kind  text;
  v_label text;
  v_id    bigint;
begin
  begin  -- a failing entry must never block the save
    -- Only changes made in the app, by a signed-in person
    if coalesce(auth.role(), '') <> 'authenticated' then return null; end if;
    v_actor := auth.uid();
    if v_actor is null then return null; end if;
    r := to_jsonb(new);
    -- Bookkeeping rows (the athletes' groups, list order …) aren't items
    if left(r->>'id', 1) = '_' then return null; end if;
    if r->>'deleted_at' is not null then return null; end if;              -- deletions: deletion log
    if tg_op = 'UPDATE' then
      o := to_jsonb(old);
      if o->>'deleted_at' is null and r->'data' is not distinct from o->'data' then return null; end if;
      v_kind := case when o->>'deleted_at' is not null then 'restore' else 'change' end;
    else
      v_kind := 'create';
    end if;

    v_org := nullif(r->>'org_id', '')::uuid;
    if v_org is null or (select count(*) from organization_members m where m.org_id = v_org) < 2 then
      return null;
    end if;
    v_rid := case when r ? 'store' then (r->>'store') || '/' || (r->>'id') else r->>'id' end;
    v_label := left(coalesce(
      r->'data'->>'name', r->'data'->>'title', r->'data'->>'subCategory',
      r->'data'->'data'->>'name', r->'data'->'data'->>'exercise',
      nullif(trim(coalesce(r->'data'->'athlete'->>'firstName', '') || ' ' || coalesce(r->'data'->'athlete'->>'lastName', '')), ''),
      nullif(trim(coalesce(r->'data'->>'firstName', '') || ' ' || coalesce(r->'data'->>'lastName', '')), '')
    ), 200);

    select id into v_id from activity_log
     where table_name = tg_table_name and record_id = v_rid and actor = v_actor
       and at > now() - interval '30 minutes'
     order by at desc limit 1;
    if v_id is not null then
      update activity_log set at = now(), label = coalesce(v_label, label) where id = v_id;
    else
      insert into activity_log (org_id, actor, table_name, record_id, label, kind)
      values (v_org, v_actor, tg_table_name, v_rid, v_label, v_kind);
      delete from activity_log where org_id = v_org and at < now() - interval '180 days';
    end if;
  exception when others then
    raise warning 'activity_log: % on %', sqlerrm, tg_table_name;
  end;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['program_records', 'athlete_records', 'coach_records'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists log_activity_trg on public.%I', t);
      execute format('create trigger log_activity_trg after insert or update on public.%I
                      for each row execute function public.log_activity()', t);
    end if;
  end loop;
end $$;

-- Check: coach messages with a name, and the activity log (empty until someone changes something)
select (select count(*) from public.chat_messages where sender_role = 'coach') as coach_messages,
       (select count(*) from public.chat_messages where sender_role = 'coach' and sender_name is not null) as with_name,
       (select string_agg(distinct sender_name, ', ') from public.chat_messages where sender_role = 'coach') as names,
       (select count(*) from public.activity_log) as activity_entries;
