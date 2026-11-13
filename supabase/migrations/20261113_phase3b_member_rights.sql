-- Phase 3, step 2a of the organization layer (2026-11-13): rights per member.
--
-- Every role has a template; the owner can change single rights per member (stored in
-- organization_members.rights as the differences only):
--   athletes  'view' | 'edit'   athletes, their calendar, logs, tests, check-ins, chat
--   programs  'view' | 'edit'   programs and program templates
--   libraries 'view' | 'edit'   exercises, methods, parameters, templates, sessions
--   health    true | false      anamnesis and pain entries (health data)
--   ai        true | false      AI assistant
-- The owner always has every right. The AI right takes effect now (it drives coach_accounts,
-- which the AI proxy checks); the others take effect with shared data (step 2b).
-- No data rule changes. Safe to run more than once.

create or replace function public.org_rights_template(p_role text) returns jsonb
language sql immutable as $$
  select case p_role
    when 'intern' then '{"athletes":"view","programs":"view","libraries":"view","health":false,"ai":false}'::jsonb
    else '{"athletes":"edit","programs":"edit","libraries":"edit","health":true,"ai":true}'::jsonb
  end
$$;

-- Effective rights of a member: the role's template with their own changes on top
create or replace function public.org_member_rights(p_role text, p_rights jsonb) returns jsonb
language sql immutable as $$
  select case when p_role = 'owner' then public.org_rights_template('owner')
              else public.org_rights_template(p_role) || coalesce(p_rights, '{}'::jsonb) end
$$;

-- The logged-in person's rights (null without an organization)
create or replace function public.my_org_rights() returns jsonb
language sql stable security definer set search_path = public as $$
  select public.org_member_rights(role, rights) from public.organization_members where user_id = auth.uid()
$$;

-- Members now come with their effective rights
drop function if exists public.get_org_members();
create function public.get_org_members()
returns table (user_id uuid, email text, name text, role text, joined_at timestamptz, rights jsonb, custom boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text,
         coalesce(nullif(trim(cp.name), ''), nullif(trim(u.raw_user_meta_data->>'full_name'), '')),
         m.role, m.created_at,
         public.org_member_rights(m.role, m.rights),
         m.role <> 'owner' and m.rights <> '{}'::jsonb
    from public.organization_members m
    left join auth.users u on u.id = m.user_id
    left join public.coach_profiles cp on cp.user_id = m.user_id
   where m.org_id = public.my_org_id()
   order by m.created_at
$$;

-- Owner sets a member's rights. Only known rights with valid values are kept, and only where they
-- differ from the role's template. Keeps the AI access in step.
create or replace function public.set_org_member_rights(p_user uuid, p_rights jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid := public.my_org_id();
  v_role text;
  v_tpl  jsonb;
  v_new  jsonb := '{}'::jsonb;
  k      text;
begin
  if public.my_org_role() is distinct from 'owner' then raise exception 'not_owner' using errcode = '42501'; end if;
  select role into v_role from organization_members where org_id = v_org and user_id = p_user;
  if v_role is null then raise exception 'not_member' using errcode = '22023'; end if;
  if v_role = 'owner' then raise exception 'owner_has_all_rights' using errcode = '22023'; end if;
  v_tpl := public.org_rights_template(v_role);
  foreach k in array array['athletes', 'programs', 'libraries'] loop
    if p_rights->>k in ('view', 'edit') and p_rights->>k <> v_tpl->>k then
      v_new := v_new || jsonb_build_object(k, p_rights->>k);
    end if;
  end loop;
  foreach k in array array['health', 'ai'] loop
    if jsonb_typeof(p_rights->k) = 'boolean' and p_rights->k <> v_tpl->k then
      v_new := v_new || jsonb_build_object(k, p_rights->k);
    end if;
  end loop;
  update organization_members set rights = v_new where org_id = v_org and user_id = p_user;
  update coach_accounts set ai_enabled = (public.org_member_rights(v_role, v_new)->>'ai')::boolean where user_id = p_user;
end $$;

-- A new role starts from its template (own changes are reset) — also for the AI access
create or replace function public.set_org_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org_id();
begin
  if public.my_org_role() is distinct from 'owner' then raise exception 'not_owner' using errcode = '42501'; end if;
  if p_role not in ('owner', 'coach', 'intern') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if p_role <> 'owner' and exists (select 1 from organization_members where org_id = v_org and user_id = p_user and role = 'owner')
     and (select count(*) from organization_members where org_id = v_org and role = 'owner') <= 1 then
    raise exception 'last_owner' using errcode = '23514';
  end if;
  update organization_members set role = p_role, rights = '{}'::jsonb where org_id = v_org and user_id = p_user and role <> p_role;
  if found then
    update coach_accounts set ai_enabled = (public.org_rights_template(p_role)->>'ai')::boolean where user_id = p_user;
  end if;
end $$;

revoke execute on function public.get_org_members() from public, anon;
revoke execute on function public.set_org_member_rights(uuid, jsonb) from public, anon;
revoke execute on function public.my_org_rights() from public, anon;
grant execute on function public.get_org_members(), public.set_org_member_rights(uuid, jsonb), public.my_org_rights() to authenticated;

-- Check: members with their rights
select u.email, m.role, public.org_member_rights(m.role, m.rights) as rights, c.ai_enabled
  from public.organization_members m
  left join auth.users u on u.id = m.user_id
  left join public.coach_accounts c on c.user_id = m.user_id
 order by m.org_id, m.created_at;
