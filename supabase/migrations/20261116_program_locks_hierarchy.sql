-- Edit locks (phase 5): who may take over editing a program — with a hierarchy.
--
--   owners          take over from anyone
--   the author      (a coach) takes over from other coaches, but never from an owner
--   "edit all" coaches don't take over (they wait until the lock is free)
--
-- Only replaces the function lock_program (same inputs and answer, plus whether the holder is an
-- owner). Safe to run more than once.

drop function if exists public.lock_program(text, boolean);
create function public.lock_program(p_program text, p_take_over boolean default false)
returns table (acquired boolean, holder uuid, holder_name text, heartbeat_at timestamptz, holder_is_owner boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_owner        uuid := public.my_data_owner();
  v_me           uuid := auth.uid();
  v_author       uuid;
  v_holder       uuid;
  v_holder_owner boolean := false;
  v_take         boolean;
  v_ok           boolean;
  v_name         text;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select p.created_by into v_author from program_records p where p.coach_user_id = v_owner and p.id = p_program;
  if not found then
    -- Not stored yet (a new program): nothing to lock
    return query select true, v_me, null::text, now(), false;
    return;
  end if;
  -- Only someone who may change the program can lock it
  if not (v_author = v_me or v_owner = v_me or public.org_can('programs', 'edit')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- Is the current holder an owner (the data owner, or an owner of the organization)?
  select l.holder into v_holder from program_locks l where l.coach_user_id = v_owner and l.program_id = p_program;
  if v_holder is not null then
    v_holder_owner := v_holder = v_owner or exists (
      select 1 from organization_members m
       where m.user_id = v_holder and m.org_id = public.my_org_id() and m.role = 'owner');
  end if;
  v_take := p_take_over and (
    public.my_org_role() = 'owner' or v_owner = v_me
    or (v_author = v_me and not v_holder_owner));
  v_name := public.coach_display_name(v_me);

  insert into program_locks as l (coach_user_id, program_id, holder, holder_name, heartbeat_at)
  values (v_owner, p_program, v_me, v_name, now())
  on conflict (coach_user_id, program_id) do update
     set holder = excluded.holder, holder_name = excluded.holder_name, heartbeat_at = now()
   where l.holder = v_me or l.heartbeat_at <= now() - interval '2 minutes' or v_take
  returning true into v_ok;

  if v_ok then
    return query select true, v_me, v_name, now(), (public.my_org_role() = 'owner' or v_owner = v_me);
  else
    return query select false, l.holder, l.holder_name, l.heartbeat_at, v_holder_owner
      from program_locks l where l.coach_user_id = v_owner and l.program_id = p_program;
  end if;
end $$;

revoke execute on function public.lock_program(text, boolean) from public, anon;
grant execute on function public.lock_program(text, boolean) to authenticated;

-- Check: the function answers with the new column
select pg_get_function_result('public.lock_program(text, boolean)'::regprocedure) as answer;
