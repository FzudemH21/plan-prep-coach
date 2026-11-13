-- Permission checks: who can read and change what. Run in the Supabase SQL Editor — before and after
-- every change to the permission rules (organization phases).
--
-- Changes NOTHING: every write test is undone right away (and the whole run is one transaction).
-- The database acts as four people in turn:
--   anon      — not logged in (only the public app key)
--   stranger  — logged in, but neither coach nor athlete (e.g. someone who created an account)
--   athlete   — one of your connected athletes
--   coach     — you
-- Every table of the database is checked (new tables are included automatically).
--
-- Result: only the checks that need attention, plus a summary line.
--   FAIL   — someone can see or change data that isn't theirs
--   REVIEW — an athlete can read a table that has neither an athlete nor an owner column — look at it once
--   ERROR  — the check itself failed (see "actual")

drop table if exists perm_results;
create temp table perm_results (who text, table_name text, check_name text, expected text, actual text, status text);

do $$
declare
  v_coach   uuid;
  v_athlete uuid;
  v_conn    uuid;
  v_org     uuid;
  n0        bigint;
  tabs      text[];
  t         text;
  cols      text[];
  col       text;
  who       text;
  uid       uuid;
  db_role   text;
  n         bigint;
  st        text;
  acc       jsonb := '[]';
  wt        record;
begin
  -- The coach with the most athletes (you) and one of their connected athletes
  select coach_user_id into v_coach from public.athlete_records group by coach_user_id order by count(*) desc limit 1;
  select athlete_auth_user_id, id into v_athlete, v_conn from public.athlete_connections
   where coach_user_id = v_coach and athlete_auth_user_id is not null
   order by connected_at desc nulls last limit 1;
  -- Your organization (phase 2 on)
  if to_regclass('public.organization_members') is not null then
    execute 'select org_id from public.organization_members where user_id = $1' into v_org using v_coach;
  end if;
  select array_agg(format('%I.%I', schemaname, tablename) order by tablename) into tabs
    from pg_tables where schemaname = 'public' and tablename <> 'perm_results';
  tabs := tabs || 'storage.objects'::text;

  foreach who in array array['anon', 'stranger', 'athlete', 'coach'] loop
    uid := case who when 'stranger' then gen_random_uuid() when 'athlete' then v_athlete when 'coach' then v_coach end;
    db_role := case when who = 'anon' then 'anon' else 'authenticated' end;
    if who in ('athlete', 'coach') and uid is null then
      acc := acc || jsonb_build_object('who', who, 'table_name', '-', 'check_name', 'person found', 'expected', 'yes', 'actual', 'no', 'status', 'ERROR');
      continue;
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', db_role)::text, true);
    execute format('set local role %I', db_role);

    -- ── Reading ──────────────────────────────────────────────────────────────────────────────
    foreach t in array tabs loop
      select coalesce(array_agg(attname::text), '{}') into cols
        from pg_attribute where attrelid = t::regclass and attnum > 0 and not attisdropped;
      n := null; st := 'ok';
      begin
        if who in ('anon', 'stranger') then
          execute format('select count(*) from %s', t) into n;
          if n > 0 then st := 'FAIL'; end if;
          acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'rows visible', 'expected', '0', 'actual', n::text, 'status', st);
        elsif who = 'athlete' then
          if t in ('public.organizations', 'public.organization_members', 'public.organization_invites') then
            execute format('select count(*) from %s', t) into n;
            if n > 0 then st := 'FAIL'; end if;
            acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'organizations visible', 'expected', '0', 'actual', n::text, 'status', st);
          elsif t = 'public.athlete_connections' then
            execute format('select count(*) from %s where id is distinct from %L', t, v_conn) into n;
            if n > 0 then st := 'FAIL'; end if;
            acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'other athletes'' rows visible', 'expected', '0', 'actual', n::text, 'status', st);
          elsif 'athlete_connection_id' = any(cols) or 'connection_id' = any(cols) then
            col := case when 'athlete_connection_id' = any(cols) then 'athlete_connection_id' else 'connection_id' end;
            execute format('select count(*) from %s where %I is distinct from %L', t, col, v_conn) into n;
            if n > 0 then st := 'FAIL'; end if;
            acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'other athletes'' rows visible', 'expected', '0', 'actual', n::text, 'status', st);
          elsif 'coach_user_id' = any(cols) or 'user_id' = any(cols) then
            -- Coach-owned tables (exercise library, progressions, e1RM tags): the athlete may read
            -- their own coach's rows (videos, exercise swaps, charts), nobody else's
            col := case when 'coach_user_id' = any(cols) then 'coach_user_id' else 'user_id' end;
            execute format('select count(*) from %s where %I is distinct from %L and %I is distinct from %L', t, col, v_coach, col, uid) into n;
            if n > 0 then st := 'FAIL'; end if;
            acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'other coaches'' rows visible', 'expected', '0', 'actual', n::text, 'status', st);
          else
            execute format('select count(*) from %s', t) into n;
            if n > 0 then st := 'REVIEW'; end if;
            acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'rows visible (no per-athlete column)', 'expected', '0', 'actual', n::text, 'status', st);
          end if;
        else -- coach: no rows of other coaches
          if t = 'public.organizations' then
            execute format('select count(*) from %s where id is distinct from %L', t, v_org) into n;
            if n > 0 then st := 'FAIL'; end if;
          elsif t in ('public.organization_members', 'public.organization_invites') then
            execute format('select count(*) from %s where org_id is distinct from %L', t, v_org) into n;
            if n > 0 then st := 'FAIL'; end if;
          elsif 'coach_user_id' = any(cols) then
            execute format('select count(*) from %s where coach_user_id is distinct from %L', t, uid) into n;
            if n > 0 then st := 'FAIL'; end if;
          elsif 'user_id' = any(cols) then
            -- user_id can also mean the athlete (e.g. their own entries) — a look, not a failure
            execute format('select count(*) from %s where user_id is distinct from %L', t, uid) into n;
            if n > 0 then st := 'REVIEW'; end if;
          end if;
          if n is not null then
            acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'other coaches'' rows visible', 'expected', '0', 'actual', n::text, 'status', st);
          end if;
        end if;
      exception
        when insufficient_privilege then
          acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'rows visible', 'expected', '0', 'actual', 'no access', 'status', 'ok');
        when others then
          acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'rows visible', 'expected', '0', 'actual', sqlerrm, 'status', 'ERROR');
      end;
    end loop;

    -- The coach still sees their own data (the rules don't lock you out)
    if who = 'coach' then
      execute 'select count(*) from public.athlete_records' into n;
      acc := acc || jsonb_build_object('who', who, 'table_name', 'public.athlete_records', 'check_name', 'own athletes visible', 'expected', '> 0', 'actual', n::text, 'status', case when n > 0 then 'ok' else 'FAIL' end);
      execute 'select count(*) from public.program_records' into n;
      acc := acc || jsonb_build_object('who', who, 'table_name', 'public.program_records', 'check_name', 'own programs visible', 'expected', '> 0', 'actual', n::text, 'status', case when n > 0 then 'ok' else 'FAIL' end);
    end if;

    -- ── Changing (every write is undone at once) ───────────────────────────────────────────────
    if who in ('anon', 'stranger', 'athlete') then
      for wt in
        select * from (values
          ('public.athlete_connections', 'change other athletes'' connections',
             format('update public.athlete_connections set athlete_name = athlete_name where id is distinct from %L', v_conn)),
          ('public.athlete_session_logs', 'delete other athletes'' logged sessions',
             format('delete from public.athlete_session_logs where athlete_connection_id is distinct from %L', v_conn)),
          ('public.athlete_daily_checkins', 'delete other athletes'' check-ins',
             format('delete from public.athlete_daily_checkins where athlete_connection_id is distinct from %L', v_conn)),
          ('public.athlete_records', 'change the coach''s athletes',
             'update public.athlete_records set updated_at = updated_at'),
          ('public.program_records', 'change the coach''s programs',
             'update public.program_records set updated_at = updated_at'),
          ('public.athlete_records', 'add an athlete to the coach',
             format('insert into public.athlete_records (coach_user_id, id, data) values (%L, %L, %L)', v_coach, 'perm-check', '{}')),
          ('public.coach_accounts', 'make itself a coach (AI access)',
             'insert into public.coach_accounts (user_id) values (auth.uid())'),
          ('public.coach_accounts', 'turn AI on for coach accounts',
             'update public.coach_accounts set ai_enabled = ai_enabled'),
          ('public.ai_usage', 'write the AI usage log',
             'insert into public.ai_usage (user_id, target) values (auth.uid(), ''perm-check'')'),
          ('public.deletion_log', 'erase the deletion log',
             'delete from public.deletion_log')
        ) as w(tbl, label, stmt)
      loop
        n := 0; st := 'ok';
        begin
          execute wt.stmt;
          get diagnostics n = row_count;
          raise exception using errcode = 'P0001', message = 'perm_check_undo';
        exception
          when sqlstate 'P0001' then
            if n > 0 then st := 'FAIL'; end if;
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '0 rows / blocked', 'actual', n::text || ' rows (undone)', 'status', st);
          when insufficient_privilege or check_violation or foreign_key_violation or not_null_violation then
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '0 rows / blocked', 'actual', 'blocked', 'status', 'ok');
          when others then
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '0 rows / blocked', 'actual', sqlerrm, 'status', 'ERROR');
        end;
      end loop;
    end if;

    -- Organizations (phase 2 on): nobody — the coach included — can add members, change roles or
    -- rights, create organizations, or move data to another organization from the app. The owner
    -- functions (phase 3) refuse everyone but the owner.
    if v_org is not null then
      for wt in
        select tbl, label, stmt from (values
          ('public.organization_members', 'join the organization as owner',
             format('insert into public.organization_members (org_id, user_id, role) values (%L, coalesce(auth.uid(), gen_random_uuid()), %L)', v_org, 'owner')),
          ('public.organization_members', 'change roles or rights',
             'update public.organization_members set role = role, rights = rights'),
          ('public.organization_members', 'remove members',
             'delete from public.organization_members'),
          ('public.organizations', 'create an organization',
             'insert into public.organizations (name) values (''perm-check'')'),
          ('public.organizations', 'rename or delete organizations',
             'update public.organizations set name = name')
        ) as w(tbl, label, stmt)
        union all
        select tbl, label, stmt from (values
          ('public.organization_invites', 'create an invite directly', 'all',
             format('insert into public.organization_invites (org_id, email, role, code) values (%L, %L, %L, repeat(%L, 40))', v_org, 'perm@example.com', 'coach', 'x')),
          ('public.organization_invites', 'change invites', 'all',
             'update public.organization_invites set expires_at = expires_at'),
          ('public.organization_invites', 'join with a made-up invite code', 'all',
             'select public.accept_org_invite(repeat(''a'', 64))'),
          ('public.organization_invites', 'create an invite link (not owner)', 'others',
             'select public.create_org_invite(''perm@example.com'', ''coach'')'),
          ('public.organizations', 'rename the organization (not owner)', 'others',
             'select public.rename_org(''perm-check'')'),
          ('public.organization_members', 'make itself owner (not owner)', 'others',
             'select public.set_org_member_role(auth.uid(), ''owner'')'),
          ('public.organization_members', 'remove the owner (not owner)', 'others',
             format('select public.remove_org_member(%L)', v_coach)),
          ('public.organization_members', 'remove the last owner', 'coach',
             format('select public.remove_org_member(%L)', v_coach))
        ) as f(tbl, label, applies, stmt)
        where to_regprocedure('public.accept_org_invite(text)') is not null
          and (applies = 'all' or (applies = 'coach') = (who = 'coach'))
      loop
        n := 0; st := 'ok';
        begin
          execute wt.stmt;
          get diagnostics n = row_count;
          raise exception using errcode = 'P0001', message = 'perm_check_undo';
        exception
          when sqlstate 'P0001' then
            if n > 0 then st := 'FAIL'; end if;
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '0 rows / blocked', 'actual', n::text || ' rows (undone)', 'status', st);
          when insufficient_privilege or check_violation or foreign_key_violation or not_null_violation
               or unique_violation or invalid_parameter_value then
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '0 rows / blocked', 'actual', 'blocked', 'status', 'ok');
          when others then
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '0 rows / blocked', 'actual', sqlerrm, 'status', 'ERROR');
        end;
      end loop;

      -- The coach's own programs keep their organization even if the app tries to change it
      if who = 'coach' then
        begin
          execute 'select count(*) from public.program_records where org_id is not null' into n0;
          execute 'update public.program_records set org_id = null where org_id is not null';
          execute 'select count(*) from public.program_records where org_id is not null' into n;
          raise exception using errcode = 'P0001', message = 'perm_check_undo';
        exception
          when sqlstate 'P0001' then
            acc := acc || jsonb_build_object('who', who, 'table_name', 'public.program_records', 'check_name', 'move programs out of the organization', 'expected', n0::text || ' keep it', 'actual', n::text || ' (undone)', 'status', case when n = n0 and n0 > 0 then 'ok' else 'FAIL' end);
          when others then
            acc := acc || jsonb_build_object('who', who, 'table_name', 'public.program_records', 'check_name', 'move programs out of the organization', 'expected', 'kept', 'actual', sqlerrm, 'status', 'ERROR');
        end;
      end if;
    end if;

    reset role;
  end loop;

  insert into perm_results
  select * from jsonb_to_recordset(acc) as x(who text, table_name text, check_name text, expected text, actual text, status text);
end $$;

select status, who, table_name, check_name, expected, actual
  from perm_results where status <> 'ok'
union all
select 'SUMMARY', '', '', count(*)::text || ' checks', count(*) filter (where status = 'ok')::text || ' ok', ''
  from perm_results
order by 1, 2, 3;
