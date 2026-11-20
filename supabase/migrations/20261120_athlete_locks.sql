-- Edit locks for athletes (2026-11-20).
--
-- While a coach edits an athlete (profile "Edit", an anamnesis in edit mode, a new anamnesis), the
-- athlete is locked for them: the other coaches who reach the athlete can still look at everything
-- and use the chat, but can't start editing — they see "… is editing". The app renews the lock
-- every ~10 s; a lock not renewed for 2 minutes is free (closed tab, lost connection). Only owners
-- take a lock over (from anyone); coaches wait.
--
-- Only through the functions below — nobody reads or writes the table directly from the app. Adds a
-- table and functions only; nothing existing changes. Safe to run more than once.

create table if not exists public.athlete_locks (
  coach_user_id uuid not null,            -- the account holding the athlete (the data owner)
  athlete_id    text not null,
  holder        uuid not null,            -- who is editing
  holder_name   text,
  heartbeat_at  timestamptz not null default now(),
  primary key (coach_user_id, athlete_id)
);
alter table public.athlete_locks enable row level security;
revoke all on public.athlete_locks from anon, authenticated;

-- Takes (or renews) the lock on an athlete. Returns whether the caller holds it now, who does, and
-- whether the caller could take it over (owners).
create or replace function public.lock_athlete(p_athlete text, p_take_over boolean default false)
returns table (acquired boolean, holder uuid, holder_name text, heartbeat_at timestamptz, can_take_over boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_owner uuid := public.my_data_owner();
  v_me    uuid := auth.uid();
  v_boss  boolean;
  v_ok    boolean;
  v_name  text;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  v_boss := v_owner = v_me or coalesce(public.my_org_role() = 'owner', false);
  if not exists (select 1 from athlete_records r
                  where r.coach_user_id = v_owner and r.id = p_athlete and r.deleted_at is null) then
    -- Not stored yet (a new athlete): nothing to lock
    return query select true, v_me, null::text, now(), v_boss;
    return;
  end if;
  -- Only someone who reaches the athlete can lock it
  if not (v_owner = v_me or p_athlete in (select public.my_athlete_ids())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_name := public.coach_display_name(v_me);

  insert into athlete_locks as l (coach_user_id, athlete_id, holder, holder_name, heartbeat_at)
  values (v_owner, p_athlete, v_me, v_name, now())
  on conflict (coach_user_id, athlete_id) do update
     set holder = excluded.holder, holder_name = excluded.holder_name, heartbeat_at = now()
   where l.holder = v_me or l.heartbeat_at <= now() - interval '2 minutes' or (p_take_over and v_boss)
  returning true into v_ok;

  if v_ok then
    return query select true, v_me, v_name, now(), v_boss;
  else
    return query select false, l.holder, l.holder_name, l.heartbeat_at, v_boss
      from athlete_locks l where l.coach_user_id = v_owner and l.athlete_id = p_athlete;
  end if;
end $$;

-- Gives the lock back (Save / Cancel)
create or replace function public.unlock_athlete(p_athlete text) returns void
language sql security definer set search_path = public as $$
  delete from athlete_locks
   where coach_user_id = public.my_data_owner() and athlete_id = p_athlete and holder = auth.uid()
$$;

-- Who is editing the athlete right now (empty: nobody) — only for those who reach the athlete
create or replace function public.athlete_lock_holder(p_athlete text)
returns table (holder uuid, holder_name text, heartbeat_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.holder, l.holder_name, l.heartbeat_at
    from athlete_locks l
   where l.coach_user_id = public.my_data_owner() and l.athlete_id = p_athlete
     and l.heartbeat_at > now() - interval '2 minutes'
     and (public.my_data_owner() = auth.uid() or p_athlete in (select public.my_athlete_ids()))
$$;

revoke execute on function public.lock_athlete(text, boolean), public.unlock_athlete(text),
  public.athlete_lock_holder(text) from public, anon;
grant execute on function public.lock_athlete(text, boolean), public.unlock_athlete(text),
  public.athlete_lock_holder(text) to authenticated;

-- Check: the three functions exist (expect 3)
select count(*) as athlete_lock_functions
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('lock_athlete', 'unlock_athlete', 'athlete_lock_holder');
