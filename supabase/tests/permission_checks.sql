-- Permission checks: who can read and change what. Run in the Supabase SQL Editor — before and after
-- every change to the permission rules (organization phases).
--
-- Changes NOTHING: every write test is undone right away (and the whole run is one transaction).
-- The database acts as four people in turn:
--   anon      — not logged in (only the public app key)
--   stranger  — logged in, but neither coach nor athlete (e.g. someone who created an account)
--   athlete   — one of your connected athletes
--   coach     — you
--   member    — a member of your organization who isn't an owner (e.g. a test intern), if there is one
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
  v_member  uuid;
  v_mlib    text;
  v_mr      jsonb;     -- the member's rights
  v_conns   uuid[];    -- app connections the member may reach (the data owner's and its own)
  -- Coaches reach only the athletes assigned to them (2026-11-16)
  v_asg     boolean := to_regprocedure('public.my_athlete_ids()') is not null;
  v_assigned text[] := '{}';  -- the data owner's athletes assigned to the member
  v_anams   uuid[] := '{}';   -- their anamneses
  -- Every coach builds own programs; the Programs right means "edit all" (2026-11-16)
  v_own_prog boolean := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'program_records' and column_name = 'created_by');
  v_shared  boolean := to_regprocedure('public.my_data_owner()') is not null;
  v_sh_ath  boolean := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'athlete_records' and policyname = 'org_read');
  v_sh_prog boolean := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'program_records' and policyname = 'org_read');
  v_target  bigint;
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
    -- A member who isn't an owner, and their library right
    execute 'select user_id from public.organization_members where org_id = $1 and role <> ''owner'' order by created_at limit 1'
      into v_member using v_org;
    if v_member is not null and to_regprocedure('public.org_member_rights(text, jsonb)') is not null then
      execute 'select public.org_member_rights(role, rights) from public.organization_members where user_id = $1'
        into v_mr using v_member;
      v_mlib := v_mr->>'libraries';
    end if;
  end if;
  if v_asg and v_member is not null then
    select coalesce(array_agg(id), '{}') into v_assigned from public.athlete_records
     where coach_user_id = v_coach and left(id, 1) <> '_'
       and coalesce(data->'athlete'->'coachIds', '[]'::jsonb) ? v_member::text;
    select coalesce(array_agg(id), '{}') into v_anams from public.athlete_anamneses
     where coach_user_id = v_coach and athlete_local_id = any(v_assigned);
    select coalesce(array_agg(id), '{}') into v_conns from public.athlete_connections
     where coach_user_id = v_coach and athlete_local_id = any(v_assigned) or coach_user_id = v_member;
  else
    select coalesce(array_agg(id), '{}') into v_conns from public.athlete_connections
     where coach_user_id = v_coach and v_sh_ath or coach_user_id = v_member;
  end if;
  select array_agg(format('%I.%I', schemaname, tablename) order by tablename) into tabs
    from pg_tables where schemaname = 'public' and tablename <> 'perm_results';
  tabs := tabs || 'storage.objects'::text;

  foreach who in array array['anon', 'stranger', 'athlete', 'coach', 'member'] loop
    uid := case who when 'stranger' then gen_random_uuid() when 'athlete' then v_athlete when 'coach' then v_coach when 'member' then v_member end;
    if who = 'member' and uid is null then continue; end if;  -- no member yet
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
          if t = 'storage.objects' then
            execute format('select count(*) from storage.objects o where not (
                              (o.bucket_id = ''athlete-uploads'' and (storage.foldername(o.name))[1] = %L)
                              or (o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''chat'' and (storage.foldername(o.name))[2] = %L))',
                           v_conn::text, v_conn::text) into n;
            if n > 0 then st := 'FAIL'; end if;
            acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'files outside its own folders visible', 'expected', '0', 'actual', n::text, 'status', st);
          elsif t in ('public.organizations', 'public.organization_members', 'public.organization_invites', 'public.activity_log') then
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
        elsif who = 'member' then
          -- A member of your organization: rows of the data owner (you) and its own — never another
          -- organization's or another coach's; health data only with the health right; areas not
          -- shared yet (see the org_read rules) not at all
          if t = 'public.organizations' then
            execute format('select count(*) from %s where id is distinct from %L', t, v_org) into n;
          elsif t in ('public.organization_members', 'public.organization_invites', 'public.activity_log') then
            execute format('select count(*) from %s where org_id is distinct from %L', t, v_org) into n;
          elsif v_asg and t = 'public.athlete_records' then
            -- Only the athletes assigned to it (and the shared groups row)
            execute format('select count(*) from %s where coach_user_id is distinct from %L
                            and not (coach_user_id = %L and (id = ''_shared'' or id = any(%L::text[])))', t, uid, v_coach, v_assigned) into n;
          elsif v_asg and t = 'public.athlete_anamneses' then
            execute format('select count(*) from %s where coach_user_id is distinct from %L
                            and not (coach_user_id = %L and athlete_local_id = any(%L::text[]))', t, uid, v_coach, v_assigned) into n;
          elsif v_asg and t = 'public.anamnesis_change_log' then
            execute format('select count(*) from %s where coach_user_id is distinct from %L
                            and not (anamnesis_id = any(%L::uuid[]))', t, uid, v_anams) into n;
          elsif t in ('public.athlete_daily_checkins', 'public.athlete_anamneses', 'public.anamnesis_change_log', 'public.anamnesis_templates')
                and not v_asg and not coalesce((v_mr->>'health')::boolean, false) then
            -- No health right: nothing of anyone else
            col := case when 'coach_user_id' = any(cols) then 'coach_user_id' else null end;
            if col is null then
              execute format('select count(*) from %s', t) into n;
            else
              execute format('select count(*) from %s where %I is distinct from %L', t, col, uid) into n;
            end if;
          elsif t = 'public.athlete_connections' then
            execute format('select count(*) from %s where not (id = any(%L::uuid[]))', t, v_conns) into n;
          elsif 'athlete_connection_id' = any(cols) or 'connection_id' = any(cols) then
            col := case when 'athlete_connection_id' = any(cols) then 'athlete_connection_id' else 'connection_id' end;
            execute format('select count(*) from %s where not (%I = any(%L::uuid[]))', t, col, v_conns) into n;
          elsif t in ('public.coach_settings', 'public.coach_profiles', 'public.coach_accounts', 'public.ai_usage',
                      'public.document_chunks', 'public.deletion_log') then
            -- Personal: only its own
            col := case when 'coach_user_id' = any(cols) then 'coach_user_id' when 'user_id' = any(cols) then 'user_id' else 'owner_user_id' end;
            execute format('select count(*) from %s where %I is distinct from %L', t, col, uid) into n;
          elsif t = 'storage.objects' and v_asg then
            execute format('select count(*) from storage.objects o where coalesce(o.owner_id, o.owner::text) is distinct from %L and not (
                              (o.bucket_id = ''athlete-uploads'' and (storage.foldername(o.name))[1] = any(%L::text[]))
                              or (o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''chat'' and (storage.foldername(o.name))[2] = any(%L::text[]))
                              or (o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''athlete-docs'' and (storage.foldername(o.name))[2] = any(%L::text[])
                                  and coalesce(o.owner_id, o.owner::text) in (select m.user_id::text from public.organization_members m where m.org_id = %L))
                              or (o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''anamnesis'' and (storage.foldername(o.name))[2] = %L
                                  and (storage.foldername(o.name))[3] = any(%L::text[]))
                              or (o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''anamnesis-form'' and (storage.foldername(o.name))[2] = any(%L::text[])))',
                           uid::text, v_conns::text[], v_conns::text[], v_assigned, v_org, v_coach::text, v_assigned, v_anams::text[]) into n;
          elsif t = 'storage.objects' then
            execute format('select count(*) from storage.objects o where coalesce(o.owner_id, o.owner::text) is distinct from %L and not (
                              (o.bucket_id = ''athlete-uploads'' and (storage.foldername(o.name))[1] = any(%L::text[]))
                              or (o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''chat'' and (storage.foldername(o.name))[2] = any(%L::text[]))
                              or (o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''athlete-docs''
                                  and coalesce(o.owner_id, o.owner::text) in (select m.user_id::text from public.organization_members m where m.org_id = %L))
                              or (%L::boolean and o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''anamnesis'' and (storage.foldername(o.name))[2] = %L)
                              or (%L::boolean and o.bucket_id = ''documents'' and (storage.foldername(o.name))[1] = ''anamnesis-form''))',
                           uid::text, v_conns::text[], v_conns::text[], v_org,
                           coalesce((v_mr->>'health')::boolean, false), v_coach::text, coalesce((v_mr->>'health')::boolean, false)) into n;
          elsif t = 'public.coach_records' and v_asg then
            execute format('select count(*) from %s where coach_user_id is distinct from %L and (coach_user_id is distinct from %L
                            or (store in (''calendar_events'', ''athlete_documents'') and not (substr(id, 3) = any(%L::text[]))))', t, uid, v_coach, v_assigned) into n;
          elsif t = 'public.coach_records' then
            execute format('select count(*) from %s where coach_user_id is distinct from %L and (coach_user_id is distinct from %L
                            or (store in (''calendar_events'', ''athlete_documents'') and not %L::boolean))', t, uid, v_coach, v_sh_ath) into n;
          elsif t in ('public.program_records', 'public.program_versions', 'public.plan_memory') and not v_sh_prog then
            col := case when 'coach_id' = any(cols) then 'coach_id' else 'coach_user_id' end;
            execute format('select count(*) from %s where %I::text is distinct from %L', t, col, uid) into n;
          elsif 'coach_user_id' = any(cols) or 'user_id' = any(cols) or 'coach_id' = any(cols) or 'owner_user_id' = any(cols) then
            col := case when 'coach_user_id' = any(cols) then 'coach_user_id' when 'user_id' = any(cols) then 'user_id'
                        when 'coach_id' = any(cols) then 'coach_id' else 'owner_user_id' end;
            if t = 'public.exercise_progressions' or v_sh_ath then
              execute format('select count(*) from %s where %I::text is distinct from %L and %I::text is distinct from %L', t, col, uid, col, v_coach) into n;
            else
              execute format('select count(*) from %s where %I::text is distinct from %L', t, col, uid) into n;
            end if;
          else
            execute format('select count(*) from %s', t) into n;
            if n > 0 then st := 'REVIEW'; end if;
          end if;
          if n > 0 and st = 'ok' then st := 'FAIL'; end if;
          acc := acc || jsonb_build_object('who', who, 'table_name', t, 'check_name', 'rows not shared with members visible', 'expected', '0', 'actual', n::text, 'status', st);
        else -- coach: no rows of other coaches
          if t = 'public.organizations' then
            execute format('select count(*) from %s where id is distinct from %L', t, v_org) into n;
            if n > 0 then st := 'FAIL'; end if;
          elsif t in ('public.organization_members', 'public.organization_invites', 'public.activity_log') then
            execute format('select count(*) from %s where org_id is distinct from %L', t, v_org) into n;
            if n > 0 then st := 'FAIL'; end if;
          elsif 'coach_user_id' = any(cols) and 'org_id' = any(cols) and v_org is not null then
            -- Rows of your organization's members may be visible (shared data) — other coaches' never
            execute format('select count(*) from %s where coach_user_id is distinct from %L and org_id is distinct from %L', t, uid, v_org) into n;
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

    -- The member sees what is shared
    if who = 'member' and v_shared then
      execute format('select count(*) from public.coach_records where coach_user_id = %L and store = ''exercises''', v_coach) into n;
      acc := acc || jsonb_build_object('who', who, 'table_name', 'public.coach_records', 'check_name', 'shared exercise library visible', 'expected', '> 0', 'actual', n::text, 'status', case when n > 0 then 'ok' else 'FAIL' end);
    end if;
    if who = 'member' and v_sh_ath then
      execute format('select count(*) from public.athlete_records where coach_user_id = %L', v_coach) into n;
      acc := acc || jsonb_build_object('who', who, 'table_name', 'public.athlete_records', 'check_name', 'shared athletes visible', 'expected', '> 0', 'actual', n::text, 'status', case when n > 0 then 'ok' else 'FAIL' end);
    end if;
    if who = 'member' and v_sh_prog then
      execute format('select count(*) from public.program_records where coach_user_id = %L', v_coach) into n;
      acc := acc || jsonb_build_object('who', who, 'table_name', 'public.program_records', 'check_name', 'shared programs visible', 'expected', '> 0', 'actual', n::text, 'status', case when n > 0 then 'ok' else 'FAIL' end);
    end if;

    -- ── Changing (every write is undone at once) ───────────────────────────────────────────────
    if who in ('anon', 'stranger', 'athlete') then
      for wt in
        select * from (values
          ('public.athlete_connections', 'change other athletes'' connections',
             format('update public.athlete_connections set athlete_name = athlete_name where id is distinct from %L and coach_user_id is distinct from auth.uid()', v_conn)),
          ('public.athlete_session_logs', 'delete other athletes'' logged sessions',
             format('delete from public.athlete_session_logs where athlete_connection_id is distinct from %L and athlete_connection_id not in (select id from public.athlete_connections where coach_user_id = auth.uid())', v_conn)),
          ('public.athlete_daily_checkins', 'delete other athletes'' check-ins',
             format('delete from public.athlete_daily_checkins where athlete_connection_id is distinct from %L and athlete_connection_id not in (select id from public.athlete_connections where coach_user_id = auth.uid())', v_conn)),
          -- (only rows of other accounts: a member may have rows of their own)
          ('public.athlete_records', 'change the coach''s athletes',
             'update public.athlete_records set updated_at = updated_at where coach_user_id is distinct from auth.uid()'),
          ('public.program_records', 'change the coach''s programs',
             'update public.program_records set updated_at = updated_at where coach_user_id is distinct from auth.uid()'),
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

    -- The member changes shared data exactly as its rights allow (edit: every target row; view:
    -- none), never data that isn't shared, and can't move rows into its own account
    if who = 'member' and v_shared then
      for wt in
        select * from (values
          ('public.coach_records', 'change the shared exercise library', coalesce(v_mr->>'libraries', 'view'),
             'updated_at', format('coach_records where coach_user_id = %L and store = ''exercises''', v_coach)),
          ('public.coach_records', 'change tests / events', case when v_asg then 'edit' when v_sh_ath then coalesce(v_mr->>'athletes', 'view') else 'never' end,
             'updated_at', format('coach_records where coach_user_id = %L and store = ''calendar_events''', v_coach)),
          ('public.coach_records', 'change athlete documents', case when v_asg then 'edit' when v_sh_ath then coalesce(v_mr->>'athletes', 'view') else 'never' end,
             'updated_at', format('coach_records where coach_user_id = %L and store = ''athlete_documents''', v_coach)),
          ('public.athlete_records', 'change athletes', case when v_asg then 'edit' when v_sh_ath then coalesce(v_mr->>'athletes', 'view') else 'never' end,
             'updated_at', format('athlete_records where coach_user_id = %L', v_coach)),
          ('public.athlete_session_logs', 'change logged sessions', case when v_asg then 'edit' when v_sh_ath then coalesce(v_mr->>'athletes', 'view') else 'never' end,
             'athlete_connection_id', format('athlete_session_logs where athlete_connection_id in (select id from public.athlete_connections where coach_user_id = %L)', v_coach)),
          ('public.athlete_anamneses', 'change anamneses (health data)',
             case when v_asg then (case when coalesce((v_mr->>'health')::boolean, false) then 'edit' else 'view' end)
                  when v_sh_ath and coalesce((v_mr->>'health')::boolean, false) then coalesce(v_mr->>'athletes', 'view') else 'never' end,
             'updated_at', format('athlete_anamneses where coach_user_id = %L', v_coach)),
          ('public.athlete_daily_checkins', 'change check-ins', 'never',
             'athlete_connection_id', format('athlete_daily_checkins where athlete_connection_id in (select id from public.athlete_connections where coach_user_id = %L)', v_coach)),
          ('public.program_records', 'change programs', case when v_own_prog then (case when v_mr->>'programs' = 'edit' then 'edit' else 'own' end)
                                                             when v_sh_prog then coalesce(v_mr->>'programs', 'view') else 'never' end,
             'updated_at', format('program_records where coach_user_id = %L', v_coach)),
          -- Athletes not assigned to it: out of reach
          ('public.athlete_records', 'change athletes not assigned to it', case when v_asg then 'never' when v_sh_ath then coalesce(v_mr->>'athletes', 'view') else 'never' end,
             'updated_at', format('athlete_records where coach_user_id = %L and left(id, 1) <> ''_'' and not (id = any(%L::text[]))', v_coach, v_assigned)),
          ('public.athlete_session_logs', 'change logged sessions of athletes not assigned to it', case when v_asg then 'never' when v_sh_ath then coalesce(v_mr->>'athletes', 'view') else 'never' end,
             'athlete_connection_id', format('athlete_session_logs where athlete_connection_id in (select id from public.athlete_connections where coach_user_id = %L) and not (athlete_connection_id = any(%L::uuid[]))', v_coach, v_conns))
        ) as w(tbl, label, allowed, setcol, target)
      loop
        n := 0;
        execute 'select count(*) from public.' || wt.target into v_target;  -- as the member: what it can see
        if wt.allowed = 'own' then  -- only the rows it created
          execute 'select count(*) from public.' || wt.target || ' and created_by = auth.uid()' into v_target;
        end if;
        begin
          execute 'update public.' || regexp_replace(wt.target, ' where ', format(' set %I = %I where ', wt.setcol, wt.setcol));  -- first only
          get diagnostics n = row_count;
          raise exception using errcode = 'P0001', message = 'perm_check_undo';
        exception
          when sqlstate 'P0001' or insufficient_privilege then
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label,
              'expected', case when wt.allowed = 'edit' then v_target::text || ' (right: edit)' when wt.allowed = 'own' then v_target::text || ' (its own)' when wt.allowed = 'view' then '0 (right: view)' else '0' end,
              'actual', n::text || ' rows (undone)',
              'status', case when wt.allowed in ('edit', 'own') then (case when n = v_target then 'ok' else 'FAIL' end)
                             else (case when n = 0 then 'ok' else 'FAIL' end) end);
          when others then
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '-', 'actual', sqlerrm, 'status', 'ERROR');
        end;
      end loop;

      for wt in
        select * from (values
          ('public.coach_records', 'move a shared library row into its own account',
             format('update public.coach_records set coach_user_id = auth.uid() where coach_user_id = %L and store = ''exercises''', v_coach)),
          ('public.athlete_records', 'move a shared athlete into its own account',
             format('update public.athlete_records set coach_user_id = auth.uid() where coach_user_id = %L', v_coach)),
          ('public.program_records', 'move a shared program into its own account',
             format('update public.program_records set coach_user_id = auth.uid() where coach_user_id = %L', v_coach)),
          ('public.athlete_connections', 'move an app connection into its own account',
             format('update public.athlete_connections set coach_user_id = auth.uid() where coach_user_id = %L', v_coach)),
          ('public.coach_privacy_notices', 'change the privacy notice (not owner)',
             format('update public.coach_privacy_notices set coach_user_id = coach_user_id where coach_user_id = %L', v_coach))
        ) as w(tbl, label, stmt)
      loop
        n := 0;
        begin
          execute wt.stmt;
          get diagnostics n = row_count;
          raise exception using errcode = 'P0001', message = 'perm_check_undo';
        exception
          when sqlstate 'P0001' or insufficient_privilege then
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '0 rows / blocked',
              'actual', n::text || ' rows (undone)', 'status', case when n = 0 then 'ok' else 'FAIL' end);
          when others then
            acc := acc || jsonb_build_object('who', who, 'table_name', wt.tbl, 'check_name', wt.label, 'expected', '-', 'actual', sqlerrm, 'status', 'ERROR');
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
        -- The activity log (phase 4) is written only by the database
        select tbl, label, stmt from (values
          ('public.activity_log', 'write the activity log',
             format('insert into public.activity_log (org_id, actor, table_name, record_id, kind) values (%L, coalesce(auth.uid(), gen_random_uuid()), %L, %L, %L)', v_org, 'program_records', 'perm-check', 'change')),
          ('public.activity_log', 'change the activity log',
             'update public.activity_log set label = label'),
          ('public.activity_log', 'erase the activity log',
             'delete from public.activity_log')
        ) as a(tbl, label, stmt)
        where to_regclass('public.activity_log') is not null
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
             format('select public.remove_org_member(%L)', v_coach)),
          ('public.organization_members', 'give itself rights (not owner)', 'others',
             'select public.set_org_member_rights(auth.uid(), ''{"ai": true, "health": true}'')'),
          ('public.organization_members', 'take rights from the owner', 'coach',
             format('select public.set_org_member_rights(%L, ''{"ai": false}'')', v_coach))
        ) as f(tbl, label, applies, stmt)
        where to_regprocedure('public.accept_org_invite(text)') is not null
          and (stmt not like '%set_org_member_rights%' or to_regprocedure('public.set_org_member_rights(uuid, jsonb)') is not null)
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

      -- A program's author can't be changed from the app (own programs, 2026-11-16)
      if who in ('coach', 'member') and v_own_prog then
        begin
          execute 'select count(*) from public.program_records where created_by = auth.uid()' into n0;
          execute format('update public.program_records set created_by = auth.uid() where coach_user_id = %L', v_coach);
          execute 'select count(*) from public.program_records where created_by = auth.uid()' into n;
          raise exception using errcode = 'P0001', message = 'perm_check_undo';
        exception
          when sqlstate 'P0001' then
            acc := acc || jsonb_build_object('who', who, 'table_name', 'public.program_records', 'check_name', 'take over other coaches'' programs',
              'expected', n0::text || ' own programs', 'actual', n::text || ' (undone)', 'status', case when n = n0 then 'ok' else 'FAIL' end);
          when insufficient_privilege then
            acc := acc || jsonb_build_object('who', who, 'table_name', 'public.program_records', 'check_name', 'take over other coaches'' programs', 'expected', 'unchanged', 'actual', 'blocked', 'status', 'ok');
          when others then
            acc := acc || jsonb_build_object('who', who, 'table_name', 'public.program_records', 'check_name', 'take over other coaches'' programs', 'expected', 'unchanged', 'actual', sqlerrm, 'status', 'ERROR');
        end;
      end if;

      -- A chat message can't carry a made-up sender name (phase 4)
      if who in ('coach', 'member') and v_conn is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chat_messages' and column_name = 'sender_name') then
        begin
          execute format('insert into public.chat_messages (connection_id, sender_role, sender_auth_user_id, content, sender_name)
                          values (%L, ''coach'', auth.uid(), ''perm-check'', ''Made Up'') returning sender_name', v_conn) into col;
          raise exception using errcode = 'P0001', message = 'perm_check_undo';
        exception
          when sqlstate 'P0001' then
            acc := acc || jsonb_build_object('who', who, 'table_name', 'public.chat_messages', 'check_name', 'write a message under a made-up name', 'expected', 'own name', 'actual', coalesce(col, '-') || ' (undone)', 'status', case when col is distinct from 'Made Up' then 'ok' else 'FAIL' end);
          when insufficient_privilege or check_violation or foreign_key_violation or not_null_violation then
            acc := acc || jsonb_build_object('who', who, 'table_name', 'public.chat_messages', 'check_name', 'write a message under a made-up name', 'expected', 'own name', 'actual', 'blocked', 'status', 'ok');
          when others then
            acc := acc || jsonb_build_object('who', who, 'table_name', 'public.chat_messages', 'check_name', 'write a message under a made-up name', 'expected', 'own name', 'actual', sqlerrm, 'status', 'ERROR');
        end;
      end if;

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
