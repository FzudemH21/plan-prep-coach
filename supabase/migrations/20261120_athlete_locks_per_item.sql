-- Edit locks for athletes, per item (2026-11-20, replaces the one-lock-per-athlete version of
-- 20261120_athlete_locks.sql).
--
-- Only what is being edited is locked: the athlete's profile form ('profile') or one anamnesis
-- ('anamnesis:<id>'). Everything else of the athlete stays editable for the other coaches; creating
-- a new anamnesis never locks anything. Renewed by the app every ~10 s; a lock not renewed for
-- 2 minutes is free (and the app gives it back when the tab is closed). Only owners take a lock over.
--
-- The lock table only holds short-lived locks, so it is simply re-created (any open lock is gone —
-- whoever is editing just gets it again with the next renewal). Only through the functions below.
-- Safe to run more than once.

drop function if exists public.lock_athlete(text, boolean);
drop function if exists public.unlock_athlete(text);
drop function if exists public.athlete_lock_holder(text);
drop table if exists public.athlete_locks;

create table public.athlete_locks (
  coach_user_id uuid not null,            -- the account holding the athlete (the data owner)
  athlete_id    text not null,
  item          text not null,            -- 'profile' or 'anamnesis:<id>'
  holder        uuid not null,            -- who is editing
  holder_name   text,
  heartbeat_at  timestamptz not null default now(),
  primary key (coach_user_id, athlete_id, item)
);
alter table public.athlete_locks enable row level security;
revoke all on public.athlete_locks from anon, authenticated;

-- Takes (or renews) the lock on one item of an athlete. Returns whether the caller holds it now, who
-- does, and whether the caller could take it over (owners).
drop function if exists public.lock_athlete(text, text, boolean);
create function public.lock_athlete(p_athlete text, p_item text, p_take_over boolean default false)
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
  if p_item is null or length(p_item) > 80 or not (p_item = 'profile' or p_item like 'anamnesis:%') then
    raise exception 'bad_item' using errcode = '22023';
  end if;
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

  insert into athlete_locks as l (coach_user_id, athlete_id, item, holder, holder_name, heartbeat_at)
  values (v_owner, p_athlete, p_item, v_me, v_name, now())
  on conflict (coach_user_id, athlete_id, item) do update
     set holder = excluded.holder, holder_name = excluded.holder_name, heartbeat_at = now()
   where l.holder = v_me or l.heartbeat_at <= now() - interval '2 minutes' or (p_take_over and v_boss)
  returning true into v_ok;

  if v_ok then
    return query select true, v_me, v_name, now(), v_boss;
  else
    return query select false, l.holder, l.holder_name, l.heartbeat_at, v_boss
      from athlete_locks l where l.coach_user_id = v_owner and l.athlete_id = p_athlete and l.item = p_item;
  end if;
end $$;

-- Gives a lock back (Save / Cancel / leaving / closing the tab)
drop function if exists public.unlock_athlete(text, text);
create function public.unlock_athlete(p_athlete text, p_item text) returns void
language sql security definer set search_path = public as $$
  delete from athlete_locks
   where coach_user_id = public.my_data_owner() and athlete_id = p_athlete and item = p_item
     and holder = auth.uid()
$$;

-- Who is editing what of the athlete right now — only for those who reach the athlete
drop function if exists public.athlete_lock_holders(text);
create function public.athlete_lock_holders(p_athlete text)
returns table (item text, holder uuid, holder_name text, heartbeat_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.item, l.holder, l.holder_name, l.heartbeat_at
    from athlete_locks l
   where l.coach_user_id = public.my_data_owner() and l.athlete_id = p_athlete
     and l.heartbeat_at > now() - interval '2 minutes'
     and (public.my_data_owner() = auth.uid() or p_athlete in (select public.my_athlete_ids()))
$$;

revoke execute on function public.lock_athlete(text, text, boolean), public.unlock_athlete(text, text),
  public.athlete_lock_holders(text) from public, anon;
grant execute on function public.lock_athlete(text, text, boolean), public.unlock_athlete(text, text),
  public.athlete_lock_holders(text) to authenticated;

-- Check: the three functions exist (expect 3) and no old one is left (expect 0)
select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('lock_athlete', 'unlock_athlete', 'athlete_lock_holders')) as athlete_lock_functions,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'athlete_lock_holder') as old_functions_left;
