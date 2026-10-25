-- SECURITY: the "documents" bucket was open to everyone.
--   • "Allow all operations flreew_0–3" (role anon): anyone WITHOUT a login could read, upload,
--     change and delete every file (only the public anon key needed)
--   • "Authenticated users can read / upload / delete documents": every logged-in user — also any
--     athlete with an app account — could read and delete all files of the bucket
-- Neither came from a migration (set up in the dashboard early on).
--
-- Replaced by rules per folder:
--   <file>                              coach documents          → the coach who uploaded them
--   athlete-docs/<athlete>/…            documents per athlete    → the coach who uploaded them
--   anamnesis/<coach id>/…              anamnesis attachments    → that coach (existing rules + own)
--   chat/<connection id>/…              chat files               → coach AND athlete of the connection
--   anamnesis-form/<anamnesis id>/…     uploads in the form link → rules of 20261025_anamnesis_form_files
--
-- Run once in the Supabase SQL editor. Safe to run again. The last statement shows the result.

-- ── 0. Files without an owner (uploaded through the open rule, before logins existed) ──
-- Coach documents and per-athlete documents without an owner are given to the coach — only when
-- there is exactly ONE coach profile (otherwise nothing is changed and the count at the end shows
-- how many are left; then tell Claude).
do $$
declare
  v_coach uuid;
  v_count integer;
begin
  select count(*) into v_count from public.coach_profiles;
  if v_count = 1 then
    select user_id into v_coach from public.coach_profiles limit 1;
    update storage.objects
    set owner = v_coach, owner_id = v_coach::text
    where bucket_id = 'documents'
      and owner is null and owner_id is null
      and (array_length(storage.foldername(name), 1) is null
           or (storage.foldername(name))[1] = 'athlete-docs');
  else
    raise notice 'Not exactly one coach profile (%): files without an owner left as they are', v_count;
  end if;
end $$;

-- ── 1. Remove the open rules ──
drop policy if exists "Allow all operations flreew_0" on storage.objects;
drop policy if exists "Allow all operations flreew_1" on storage.objects;
drop policy if exists "Allow all operations flreew_2" on storage.objects;
drop policy if exists "Allow all operations flreew_3" on storage.objects;
drop policy if exists "Authenticated users can read documents" on storage.objects;
drop policy if exists "Authenticated users can upload documents" on storage.objects;
drop policy if exists "Authenticated users can delete documents" on storage.objects;

-- ── 2. The coach: own files (read / change / delete) ──
drop policy if exists "documents_own_select" on storage.objects;
create policy "documents_own_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (owner = auth.uid() or owner_id = auth.uid()::text));

drop policy if exists "documents_own_update" on storage.objects;
create policy "documents_own_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (owner = auth.uid() or owner_id = auth.uid()::text));

drop policy if exists "documents_own_delete" on storage.objects;
create policy "documents_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (owner = auth.uid() or owner_id = auth.uid()::text));

-- Uploads by a coach (not an athlete account): coach documents, per-athlete documents, own
-- anamnesis folder
drop policy if exists "documents_coach_insert" on storage.objects;
create policy "documents_coach_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'athlete'
    and (
      array_length(storage.foldername(name), 1) is null
      or (storage.foldername(name))[1] = 'athlete-docs'
      or ((storage.foldername(name))[1] = 'anamnesis' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

-- ── 3. Chat files: coach and athlete of the connection ──
drop policy if exists "chat_files_insert" on storage.objects;
create policy "chat_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'chat'
    and exists (
      select 1 from public.athlete_connections c
      where c.id::text = (storage.foldername(name))[2]
        and (c.coach_user_id = auth.uid() or c.athlete_auth_user_id = auth.uid())
    )
  );

drop policy if exists "chat_files_select" on storage.objects;
create policy "chat_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'chat'
    and exists (
      select 1 from public.athlete_connections c
      where c.id::text = (storage.foldername(name))[2]
        and (c.coach_user_id = auth.uid() or c.athlete_auth_user_id = auth.uid())
    )
  );
-- (chat_files_delete_coach, anamnesis_files_delete_coach, athlete_files_list_coach and the
--  anamnesis-form rules stay as they are)

-- ── 4. Result: what is left without an owner, and the rules on the bucket now ──
select
  (select count(*) from storage.objects where bucket_id = 'documents' and owner is null and owner_id is null
     and (array_length(storage.foldername(name), 1) is null or (storage.foldername(name))[1] = 'athlete-docs'))
    as coach_files_without_owner,
  (select string_agg(policyname || ' (' || cmd || ', ' || array_to_string(roles, ',') || ')', E'\n' order by policyname)
     from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (qual like '%documents%' or with_check like '%documents%'))
    as documents_rules;
