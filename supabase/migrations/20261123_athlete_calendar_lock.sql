-- Edit lock for an athlete's calendar (2026-11-23). Adds the item 'calendar' to the athlete edit
-- locks of 20261120_athlete_locks_per_item.sql (run that one first).
--
-- The calendar is locked while a coach is changing it (from the first change until 2 minutes
-- after the last one, or until they leave the calendar). Other coaches look through it meanwhile;
-- owners can take over. Same rules as the profile and the anamneses otherwise.
--
-- Only lock_athlete changes (it accepted 'profile' and 'anamnesis:<id>' only). No data is touched.
-- Safe to run more than once.

create or replace function public.lock_athlete(p_athlete text, p_item text, p_take_over boolean default false)
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
  if p_item is null or length(p_item) > 80
     or not (p_item = 'profile' or p_item = 'calendar' or p_item like 'anamnesis:%') then
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

revoke execute on function public.lock_athlete(text, text, boolean) from public, anon;
grant execute on function public.lock_athlete(text, text, boolean) to authenticated;

-- Check: expect calendar_allowed = true
select position('''calendar''' in pg_get_functiondef('public.lock_athlete(text, text, boolean)'::regprocedure)) > 0
  as calendar_allowed;
