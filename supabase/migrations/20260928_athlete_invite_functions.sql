-- Athlete invite links: look up and claim through SECURITY DEFINER functions.
--
-- Problem: AthleteConnectPage read the connection row by invite code with the visitor's own
-- permissions. Row-level security only allows the owning coach or the already-linked athlete to
-- read a row, so a new athlete who isn't signed in (e.g. on their phone) could never see the
-- invite → "Invalid or expired invite link", even for a freshly generated link. It only worked
-- when the link was opened in the coach's own logged-in browser.
--
-- The functions expose exactly what the connect page needs, keyed by the invite code, and the
-- claim checks the code server-side. The old open claim policy (any signed-in user could claim
-- ANY unclaimed connection row by id) is dropped.

create or replace function public.get_athlete_invite(p_code text)
returns table (id uuid, athlete_name text, athlete_email text, claimed boolean)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.athlete_name, c.athlete_email, (c.athlete_auth_user_id is not null) as claimed
  from athlete_connections c
  where c.invite_code = p_code
  limit 1;
$$;

revoke all on function public.get_athlete_invite(text) from public;
grant execute on function public.get_athlete_invite(text) to anon, authenticated;

create or replace function public.claim_athlete_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  update athlete_connections
     set athlete_auth_user_id = v_uid,
         athlete_email        = coalesce(v_email, athlete_email),
         connected_at         = now()
   where invite_code = p_code
     and (athlete_auth_user_id is null or athlete_auth_user_id = v_uid)
  returning id into v_id;

  if v_id is null then
    raise exception 'This invite link is invalid or has already been used';
  end if;
  return v_id;
end;
$$;

revoke all on function public.claim_athlete_invite(text) from public;
grant execute on function public.claim_athlete_invite(text) to authenticated;

drop policy if exists "athlete_claim_connection" on athlete_connections;
