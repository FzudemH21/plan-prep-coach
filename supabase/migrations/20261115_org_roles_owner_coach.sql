-- Organizations (2026-11-15): only two roles — Owner and Coach. Rights are set per member in the
-- rights grid (Organization tab). Interns become coaches with exactly the rights they have now
-- (stored as the differences from the Coach defaults); open intern invites become coach invites.
-- Changes no permission rule. Safe to run more than once.

update public.organization_members m
   set role = 'coach',
       rights = coalesce((
         select jsonb_object_agg(e.key, e.value)
           from jsonb_each(public.org_member_rights('intern', m.rights)) e
          where e.value is distinct from public.org_rights_template('coach') -> e.key
       ), '{}'::jsonb)
 where m.role = 'intern';

update public.organization_invites
   set role = 'coach'
 where role = 'intern' and accepted_at is null and revoked_at is null;

-- Check: every member with role and rights (AI as the AI proxy sees it)
select u.email, m.role, public.org_member_rights(m.role, m.rights) as rights, c.ai_enabled
  from public.organization_members m
  left join auth.users u on u.id = m.user_id
  left join public.coach_accounts c on c.user_id = m.user_id
 order by m.org_id, m.created_at;
