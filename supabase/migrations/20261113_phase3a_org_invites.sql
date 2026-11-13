-- Phase 3, step 1 of the organization layer (2026-11-13): the Organization tab — invite coaches and
-- interns by link, change roles, remove members, rename the organization.
--
-- Changes NO rule for athletes, programs, libraries or any other data: a member who joins sees only
-- their own data until the next step. Everything here goes through functions that check the caller
-- is the organization's owner; the app can't write the organization tables directly.
-- Only adds a table and functions. Safe to run more than once.

-- ── 1. Invitations ──────────────────────────────────────────────────────────────────────────────
-- One row per invite link. The code is the secret in the link; it works once, for that email,
-- for 14 days.
create table if not exists public.organization_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('coach', 'intern')),
  code        text not null unique,
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at  timestamptz
);
create index if not exists organization_invites_org on public.organization_invites (org_id, created_at desc);

-- The logged-in person's role in their organization (null without one)
create or replace function public.my_org_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.organization_members where user_id = auth.uid()
$$;

-- Only the owner sees the invites (to copy a link again or withdraw it)
alter table public.organization_invites enable row level security;
drop policy if exists "owner_reads_invites" on public.organization_invites;
create policy "owner_reads_invites" on public.organization_invites
  for select using (org_id = public.my_org_id() and public.my_org_role() = 'owner');

-- Errors carry a short key the app translates (e.g. 'not_owner', 'last_owner').

-- ── 2. Members (with email and name) ────────────────────────────────────────────────────────────
create or replace function public.get_org_members()
returns table (user_id uuid, email text, name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text,
         coalesce(nullif(trim(cp.name), ''), nullif(trim(u.raw_user_meta_data->>'full_name'), '')),
         m.role, m.created_at
    from public.organization_members m
    left join auth.users u on u.id = m.user_id
    left join public.coach_profiles cp on cp.user_id = m.user_id
   where m.org_id = public.my_org_id()
   order by m.created_at
$$;

-- ── 3. Owner actions ────────────────────────────────────────────────────────────────────────────
create or replace function public.rename_org(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_org_role() is distinct from 'owner' then raise exception 'not_owner' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 100 then raise exception 'invalid_name' using errcode = '22023'; end if;
  update organizations set name = trim(p_name) where id = public.my_org_id();
end $$;

create or replace function public.create_org_invite(p_email text, p_role text)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_org   uuid := public.my_org_id();
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_org is null or public.my_org_role() is distinct from 'owner' then raise exception 'not_owner' using errcode = '42501'; end if;
  if p_role not in ('coach', 'intern') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email' using errcode = '22023'; end if;
  if exists (select 1 from organization_members m join auth.users u on u.id = m.user_id
              where m.org_id = v_org and lower(u.email) = v_email) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  -- A new link for the same email replaces the open one
  update organization_invites set revoked_at = now()
   where org_id = v_org and lower(email) = v_email and accepted_at is null and revoked_at is null;
  return query
    insert into organization_invites (org_id, email, role, code, invited_by)
    values (v_org, v_email, p_role,
            replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
            auth.uid())
    returning organization_invites.id, organization_invites.code, organization_invites.expires_at;
end $$;

create or replace function public.revoke_org_invite(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_org_role() is distinct from 'owner' then raise exception 'not_owner' using errcode = '42501'; end if;
  update organization_invites set revoked_at = now()
   where id = p_id and org_id = public.my_org_id() and accepted_at is null and revoked_at is null;
end $$;

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
  update organization_members set role = p_role where org_id = v_org and user_id = p_user;
end $$;

-- Removing someone takes away their access to the organization and to the AI. Nothing they created
-- is deleted: it stays with the organization.
create or replace function public.remove_org_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org_id();
begin
  if public.my_org_role() is distinct from 'owner' then raise exception 'not_owner' using errcode = '42501'; end if;
  if exists (select 1 from organization_members where org_id = v_org and user_id = p_user and role = 'owner')
     and (select count(*) from organization_members where org_id = v_org and role = 'owner') <= 1 then
    raise exception 'last_owner' using errcode = '23514';
  end if;
  delete from organization_members where org_id = v_org and user_id = p_user;
  if found then delete from coach_accounts where user_id = p_user; end if;
end $$;

-- ── 4. Joining through the link ─────────────────────────────────────────────────────────────────
-- What the join page shows — works without being logged in, only with the code
create or replace function public.get_org_invite(p_code text)
returns table (org_name text, email text, role text, invited_by_name text, status text)
language sql stable security definer set search_path = public as $$
  select o.name, i.email, i.role,
         coalesce(nullif(trim(cp.name), ''), u.email::text),
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'used'
              when i.expires_at < now() then 'expired'
              else 'open' end
    from public.organization_invites i
    join public.organizations o on o.id = i.org_id
    left join auth.users u on u.id = i.invited_by
    left join public.coach_profiles cp on cp.user_id = i.invited_by
   where i.code = p_code and length(coalesce(p_code, '')) >= 32
$$;

-- The logged-in person joins: only with the invited email, not as a connected athlete, not while in
-- another organization. They become a coach account (AI on for coaches, off for interns).
create or replace function public.accept_org_invite(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv     organization_invites;
  v_cur   uuid;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into inv from organization_invites where code = p_code and length(coalesce(p_code, '')) >= 32;
  if not found or inv.revoked_at is not null then raise exception 'invite_invalid' using errcode = '22023'; end if;
  if inv.accepted_at is not null then
    if inv.accepted_by = v_uid then return inv.org_id; end if;
    raise exception 'invite_used' using errcode = '22023';
  end if;
  if inv.expires_at < now() then raise exception 'invite_expired' using errcode = '22023'; end if;
  if v_email <> lower(inv.email) then raise exception 'wrong_email' using errcode = '42501'; end if;
  if exists (select 1 from athlete_connections where athlete_auth_user_id = v_uid) then
    raise exception 'athlete_account' using errcode = '22023';
  end if;
  select org_id into v_cur from organization_members where user_id = v_uid;
  if v_cur is not null and v_cur <> inv.org_id then raise exception 'other_org' using errcode = '22023'; end if;

  if v_cur is null then
    insert into organization_members (org_id, user_id, role, added_by) values (inv.org_id, v_uid, inv.role, inv.invited_by);
  end if;
  -- After the membership, so no own organization is created for them
  insert into coach_accounts (user_id, ai_enabled) values (v_uid, inv.role <> 'intern') on conflict (user_id) do nothing;
  update organization_invites set accepted_at = now(), accepted_by = v_uid where id = inv.id;
  return inv.org_id;
end $$;

-- ── 5. Who may call what ────────────────────────────────────────────────────────────────────────
revoke execute on function public.get_org_members() from public, anon;
revoke execute on function public.rename_org(text) from public, anon;
revoke execute on function public.create_org_invite(text, text) from public, anon;
revoke execute on function public.revoke_org_invite(uuid) from public, anon;
revoke execute on function public.set_org_member_role(uuid, text) from public, anon;
revoke execute on function public.remove_org_member(uuid) from public, anon;
revoke execute on function public.accept_org_invite(text) from public, anon;
grant execute on function public.my_org_role() to anon, authenticated;
grant execute on function public.get_org_members(), public.rename_org(text),
  public.create_org_invite(text, text), public.revoke_org_invite(uuid), public.set_org_member_role(uuid, text),
  public.remove_org_member(uuid), public.accept_org_invite(text) to authenticated;
revoke execute on function public.get_org_invite(text) from public;
grant execute on function public.get_org_invite(text) to anon, authenticated;

-- Check: your organization and its members (should be you, owner)
select o.name as organization, m.role, u.email
  from public.organizations o join public.organization_members m on m.org_id = o.id
  left join auth.users u on u.id = m.user_id
 order by o.created_at, m.created_at;
