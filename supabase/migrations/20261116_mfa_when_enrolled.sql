-- Two-step login (optional for coaches): an account that has set it up reaches its data only after
-- entering the code — enforced by the database, not just the app.
--
-- A RESTRICTIVE rule on every table with row-level security and on the files: for logged-in people
-- it adds "the session went through the second step (aal2), or this account has no second step set
-- up". Accounts without two-step login (athletes, coaches who don't switch it on) are unaffected;
-- not-logged-in access (anamnesis form link, invite page) and the server (service role) neither.
-- It only ever narrows access, never widens it. Safe to run more than once; run it again after new
-- tables have been added (it covers every table that has row-level security at that moment).

create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
revoke execute on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

do $$
declare t record;
begin
  for t in
    select n.nspname as schema_name, c.relname as table_name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'r' and c.relrowsecurity
       and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
  loop
    execute format('drop policy if exists "mfa_when_enrolled" on %I.%I', t.schema_name, t.table_name);
    execute format('create policy "mfa_when_enrolled" on %I.%I as restrictive for all to authenticated
                    using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t.schema_name, t.table_name);
  end loop;
end $$;

-- Check: how many tables carry the rule, and how many accounts have two-step login set up
select (select count(*) from pg_policies where policyname = 'mfa_when_enrolled') as tables_covered,
       (select count(distinct user_id) from auth.mfa_factors where status = 'verified') as accounts_with_two_step_login;
