-- Organizations, phase 5: edit locks for programs.
--
-- While a coach has a program open in the planner (and may change it), it is locked for them: the
-- other coaches who could change it (the author, "edit all" coaches, owners) see it read-only with
-- "… is editing". The app renews the lock every ~45 s; a lock not renewed for 2 minutes is free
-- (closed tab, lost connection). Owners and the program's author can take a lock over.
--
-- Only through the functions below — nobody reads or writes the table directly from the app. Adds a
-- table and functions only; nothing existing changes. Safe to run more than once.

create table if not exists public.program_locks (
  coach_user_id uuid not null,            -- the account holding the program (the data owner)
  program_id    text not null,
  holder        uuid not null,            -- who is editing
  holder_name   text,
  heartbeat_at  timestamptz not null default now(),
  primary key (coach_user_id, program_id)
);
alter table public.program_locks enable row level security;
revoke all on public.program_locks from anon, authenticated;

-- Takes (or renews) the lock on a program. Returns whether the caller holds it now, and who does.
-- p_take_over: owners and the program's author take it from whoever holds it.
create or replace function public.lock_program(p_program text, p_take_over boolean default false)
returns table (acquired boolean, holder uuid, holder_name text, heartbeat_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_owner  uuid := public.my_data_owner();
  v_me     uuid := auth.uid();
  v_author uuid;
  v_take   boolean;
  v_ok     boolean;
  v_name   text;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select p.created_by into v_author from program_records p where p.coach_user_id = v_owner and p.id = p_program;
  if not found then
    -- Not stored yet (a new program): nothing to lock
    return query select true, v_me, null::text, now();
    return;
  end if;
  -- Only someone who may change the program can lock it
  if not (v_author = v_me or v_owner = v_me or public.org_can('programs', 'edit')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_take := p_take_over and (public.my_org_role() = 'owner' or v_owner = v_me or v_author = v_me);
  v_name := public.coach_display_name(v_me);

  insert into program_locks as l (coach_user_id, program_id, holder, holder_name, heartbeat_at)
  values (v_owner, p_program, v_me, v_name, now())
  on conflict (coach_user_id, program_id) do update
     set holder = excluded.holder, holder_name = excluded.holder_name, heartbeat_at = now()
   where l.holder = v_me or l.heartbeat_at <= now() - interval '2 minutes' or v_take
  returning true into v_ok;

  if v_ok then
    return query select true, v_me, v_name, now();
  else
    return query select false, l.holder, l.holder_name, l.heartbeat_at
      from program_locks l where l.coach_user_id = v_owner and l.program_id = p_program;
  end if;
end $$;

-- Gives the lock back (leaving the planner)
create or replace function public.unlock_program(p_program text) returns void
language sql security definer set search_path = public as $$
  delete from program_locks
   where coach_user_id = public.my_data_owner() and program_id = p_program and holder = auth.uid()
$$;

revoke execute on function public.lock_program(text, boolean), public.unlock_program(text) from public, anon;
grant execute on function public.lock_program(text, boolean), public.unlock_program(text) to authenticated;

-- Check: open locks (empty right after running)
select l.program_id, l.holder_name, l.heartbeat_at from public.program_locks l order by l.heartbeat_at desc;
