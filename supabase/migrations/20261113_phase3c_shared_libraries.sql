-- Phase 3, step 2b-1 of the organization layer (2026-11-13): members share the organization's
-- libraries — exercises, training methods, parameters, programming templates, session library,
-- exercise progressions.
--
-- The organization's data lives in the account of its data owner (the owner who created it).
-- Members read it; members with the "libraries: edit" right change it. Only ADDS rules (for
-- logged-in members of the organization) — every existing rule stays, so nobody loses access.
-- Tests / events (also in coach_records) are athlete data and follow with the athletes.
-- Safe to run more than once.

-- ── 1. Whose account holds the organization's data ──────────────────────────────────────────────
alter table public.organizations add column if not exists data_owner uuid references auth.users(id) on delete set null;
update public.organizations set data_owner = created_by where data_owner is null;

-- The account whose data the logged-in person works in: the data owner of their organization,
-- else their own
create or replace function public.my_data_owner() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(o.data_owner, o.created_by)
       from public.organization_members m join public.organizations o on o.id = m.org_id
      where m.user_id = auth.uid()),
    auth.uid())
$$;

-- Does the logged-in person have this right? (area: athletes | programs | libraries → 'view' /
-- 'edit'; health | ai → on). False without an organization.
create or replace function public.org_can(p_area text, p_level text default 'view') returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    case when jsonb_typeof(r->p_area) = 'boolean' then (r->>p_area)::boolean
         when p_level = 'edit' then r->>p_area = 'edit'
         else r->>p_area in ('view', 'edit') end,
    false)
  from (select public.my_org_rights() as r) x
$$;

revoke execute on function public.my_data_owner() from public, anon;
revoke execute on function public.org_can(text, text) from public, anon;
grant execute on function public.my_data_owner(), public.org_can(text, text) to authenticated;

-- The data owner stays an owner and stays in the organization (their account holds its data)
create or replace function public.set_org_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org_id();
begin
  if public.my_org_role() is distinct from 'owner' then raise exception 'not_owner' using errcode = '42501'; end if;
  if p_role not in ('owner', 'coach', 'intern') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if p_role <> 'owner' and exists (select 1 from organizations where id = v_org and coalesce(data_owner, created_by) = p_user) then
    raise exception 'data_owner' using errcode = '23514';
  end if;
  if p_role <> 'owner' and exists (select 1 from organization_members where org_id = v_org and user_id = p_user and role = 'owner')
     and (select count(*) from organization_members where org_id = v_org and role = 'owner') <= 1 then
    raise exception 'last_owner' using errcode = '23514';
  end if;
  update organization_members set role = p_role, rights = '{}'::jsonb where org_id = v_org and user_id = p_user and role <> p_role;
  if found then
    update coach_accounts set ai_enabled = (public.org_rights_template(p_role)->>'ai')::boolean where user_id = p_user;
  end if;
end $$;

create or replace function public.remove_org_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org_id();
begin
  if public.my_org_role() is distinct from 'owner' then raise exception 'not_owner' using errcode = '42501'; end if;
  if exists (select 1 from organizations where id = v_org and coalesce(data_owner, created_by) = p_user) then
    raise exception 'data_owner' using errcode = '23514';
  end if;
  if exists (select 1 from organization_members where org_id = v_org and user_id = p_user and role = 'owner')
     and (select count(*) from organization_members where org_id = v_org and role = 'owner') <= 1 then
    raise exception 'last_owner' using errcode = '23514';
  end if;
  delete from organization_members where org_id = v_org and user_id = p_user;
  if found then delete from coach_accounts where user_id = p_user; end if;
end $$;

-- From the app, a row can't change its owner account (otherwise a member could move a shared row
-- out of the organization's account into their own). Only SQL and server functions can.
create or replace function public.keep_row_owner() returns trigger
language plpgsql set search_path = public as $$
declare v_old text; v_new text;
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    execute format('select ($1).%I::text, ($2).%I::text', tg_argv[0], tg_argv[0]) into v_old, v_new using old, new;
    if v_new is distinct from v_old then raise exception 'row_owner_fixed' using errcode = '42501'; end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['coach_records', 'exercise_progressions'] loop
    execute format('drop trigger if exists keep_row_owner_trg on public.%I', t);
    execute format('create trigger keep_row_owner_trg before update of coach_user_id on public.%I
                    for each row execute function public.keep_row_owner(%L)', t, 'coach_user_id');
  end loop;
end $$;

-- ── 2. Libraries in coach_records ───────────────────────────────────────────────────────────────
-- (deleting is a deletion mark = an update; there is no delete rule)
drop policy if exists "org_read_libraries" on public.coach_records;
create policy "org_read_libraries" on public.coach_records for select to authenticated
  using (org_id = (select public.my_org_id())
         and store in ('exercises', 'methods', 'parameters', 'templates', 'workouts'));

drop policy if exists "org_add_to_libraries" on public.coach_records;
create policy "org_add_to_libraries" on public.coach_records for insert to authenticated
  with check (coach_user_id = (select public.my_data_owner())
              and org_id = (select public.my_org_id())
              and store in ('exercises', 'methods', 'parameters', 'templates', 'workouts')
              and (select public.org_can('libraries', 'edit')));

drop policy if exists "org_change_libraries" on public.coach_records;
create policy "org_change_libraries" on public.coach_records for update to authenticated
  using (org_id = (select public.my_org_id())
         and store in ('exercises', 'methods', 'parameters', 'templates', 'workouts')
         and (select public.org_can('libraries', 'edit')))
  with check (coach_user_id = (select public.my_data_owner())
              and org_id = (select public.my_org_id())
              and store in ('exercises', 'methods', 'parameters', 'templates', 'workouts')
              and (select public.org_can('libraries', 'edit')));

-- ── 3. Exercise progressions ────────────────────────────────────────────────────────────────────
drop policy if exists "org_read_progressions" on public.exercise_progressions;
create policy "org_read_progressions" on public.exercise_progressions for select to authenticated
  using (org_id = (select public.my_org_id()));

drop policy if exists "org_add_progressions" on public.exercise_progressions;
create policy "org_add_progressions" on public.exercise_progressions for insert to authenticated
  with check (coach_user_id = (select public.my_data_owner())
              and org_id = (select public.my_org_id())
              and (select public.org_can('libraries', 'edit')));

drop policy if exists "org_change_progressions" on public.exercise_progressions;
create policy "org_change_progressions" on public.exercise_progressions for update to authenticated
  using (org_id = (select public.my_org_id()) and (select public.org_can('libraries', 'edit')))
  with check (coach_user_id = (select public.my_data_owner())
              and org_id = (select public.my_org_id())
              and (select public.org_can('libraries', 'edit')));

drop policy if exists "org_delete_progressions" on public.exercise_progressions;
create policy "org_delete_progressions" on public.exercise_progressions for delete to authenticated
  using (org_id = (select public.my_org_id()) and (select public.org_can('libraries', 'edit')));

-- Check: the organization, its data owner, and how many library rows its members now share
select o.name as organization, u.email as data_owner,
       (select count(*) from public.coach_records c
         where c.org_id = o.id and c.deleted_at is null
           and c.store in ('exercises', 'methods', 'parameters', 'templates', 'workouts')) as shared_library_rows,
       (select count(*) from public.exercise_progressions p where p.org_id = o.id) as shared_progressions
  from public.organizations o
  left join auth.users u on u.id = coalesce(o.data_owner, o.created_by)
 order by o.created_at;
