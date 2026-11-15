-- Organizations (2026-11-16): every coach builds their own programs.
--
--   * Every coach of the organization creates programs (no right needed) and sees all of them.
--   * A program remembers who created it (program_records.created_by — set by the database, the
--     app can't choose or change it). Existing programs: the account holding them (the data owner).
--   * A coach changes and deletes only their own programs. The Programs tick of the rights grid
--     now means "edit all programs" (e.g. a head coach); owners always edit all. New coaches start
--     without it (the coach template's programs right becomes 'view').
--   * Version history: read by everyone, written for the programs one may change. The AI's plan
--     memory: read and written by every coach (summaries the AI uses).
--
-- Only the members' rules are replaced; the data owner's own rules stay. Safe to run more than once.

-- ── Author ───────────────────────────────────────────────────────────────────────────────────────
alter table public.program_records add column if not exists created_by uuid;
update public.program_records set created_by = coach_user_id where created_by is null;
create index if not exists program_records_created_by on public.program_records (created_by);

create or replace function public.fill_program_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    -- From the app: the author is whoever creates the program, and stays
    if tg_op = 'INSERT' then new.created_by := auth.uid();
    else new.created_by := old.created_by; end if;
  elsif tg_op = 'INSERT' and new.created_by is null then
    new.created_by := new.coach_user_id;
  end if;
  return new;
end $$;

drop trigger if exists fill_program_author_trg on public.program_records;
create trigger fill_program_author_trg before insert or update of created_by on public.program_records
  for each row execute function public.fill_program_author();

-- The programs the logged-in person may change: their own, or all with "edit all" / as owner
create or replace function public.my_editable_program_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select p.id from program_records p
   where p.coach_user_id = public.my_data_owner()
     and (p.created_by = auth.uid() or public.org_can('programs', 'edit') or p.coach_user_id = auth.uid())
$$;
revoke execute on function public.my_editable_program_ids() from public, anon;
grant execute on function public.my_editable_program_ids() to authenticated;

-- ── Rights: new coaches start with "own programs" ────────────────────────────────────────────────
create or replace function public.org_rights_template(p_role text) returns jsonb
language sql immutable as $$
  select case p_role
    when 'intern' then '{"athletes":"view","programs":"view","libraries":"view","health":false,"ai":false}'::jsonb
    when 'owner'  then '{"athletes":"edit","programs":"edit","libraries":"edit","health":true,"ai":true}'::jsonb
    else '{"athletes":"edit","programs":"view","libraries":"edit","health":true,"ai":true}'::jsonb
  end
$$;
-- Members stored with "programs":"view" as a change: now the default, the change isn't needed
update public.organization_members
   set rights = rights - 'programs'
 where role = 'coach' and rights->>'programs' = 'view';

-- ── Rules ────────────────────────────────────────────────────────────────────────────────────────
-- Programs: everyone reads and creates; changing and deleting needs the program to be one's own
-- (or "edit all")
drop policy if exists "org_read" on public.program_records;
create policy "org_read" on public.program_records for select to authenticated
  using (coach_user_id = (select public.my_data_owner()));
drop policy if exists "org_add" on public.program_records;
create policy "org_add" on public.program_records for insert to authenticated
  with check (coach_user_id = (select public.my_data_owner()));
drop policy if exists "org_change" on public.program_records;
create policy "org_change" on public.program_records for update to authenticated
  using (coach_user_id = (select public.my_data_owner())
         and (created_by = (select auth.uid()) or (select public.org_can('programs', 'edit'))))
  with check (coach_user_id = (select public.my_data_owner())
              and (created_by = (select auth.uid()) or (select public.org_can('programs', 'edit'))));
drop policy if exists "org_delete" on public.program_records;
create policy "org_delete" on public.program_records for delete to authenticated
  using (coach_user_id = (select public.my_data_owner())
         and (created_by = (select auth.uid()) or (select public.org_can('programs', 'edit'))));

-- Version history: everyone reads; versions are written for the programs one may change
drop policy if exists "org_read" on public.program_versions;
create policy "org_read" on public.program_versions for select to authenticated
  using (coach_user_id = (select public.my_data_owner()));
drop policy if exists "org_add" on public.program_versions;
create policy "org_add" on public.program_versions for insert to authenticated
  with check (coach_user_id = (select public.my_data_owner()) and program_id in (select public.my_editable_program_ids()));
drop policy if exists "org_change" on public.program_versions;
create policy "org_change" on public.program_versions for update to authenticated
  using (coach_user_id = (select public.my_data_owner()) and program_id in (select public.my_editable_program_ids()))
  with check (coach_user_id = (select public.my_data_owner()) and program_id in (select public.my_editable_program_ids()));
drop policy if exists "org_delete" on public.program_versions;
create policy "org_delete" on public.program_versions for delete to authenticated
  using (coach_user_id = (select public.my_data_owner()) and program_id in (select public.my_editable_program_ids()));

-- The AI's plan memory (summaries of the programs): every coach reads and writes
do $$
begin
  if to_regclass('public.plan_memory') is not null then
    drop policy if exists "org_read" on public.plan_memory;
    create policy "org_read" on public.plan_memory for select to authenticated
      using (coach_id::text = (select public.my_data_owner())::text);
    drop policy if exists "org_add" on public.plan_memory;
    create policy "org_add" on public.plan_memory for insert to authenticated
      with check (coach_id::text = (select public.my_data_owner())::text);
    drop policy if exists "org_change" on public.plan_memory;
    create policy "org_change" on public.plan_memory for update to authenticated
      using (coach_id::text = (select public.my_data_owner())::text)
      with check (coach_id::text = (select public.my_data_owner())::text);
    drop policy if exists "org_delete" on public.plan_memory;
    create policy "org_delete" on public.plan_memory for delete to authenticated
      using (coach_id::text = (select public.my_data_owner())::text);
  end if;
end $$;

-- Check: programs per author, and each member's programs right ('edit' = edit all)
select coalesce(u.email, p.created_by::text) as author, count(*) as programs
  from public.program_records p
  left join auth.users u on u.id = p.created_by
 where p.deleted_at is null
 group by 1
 order by 2 desc;
