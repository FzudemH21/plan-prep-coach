-- Deleting an athlete removes their files too (GDPR: erasure of all data attached to them).
--
-- The app deletes an athlete's files from storage before it deletes the athlete-app connection.
-- These policies let the coach of a connection delete the files that belong to it:
--   • athlete-uploads/{connection id}/…   photos / videos the athlete attached to test results
--   • documents/chat/{connection id}/…    chat attachments, also those the athlete uploaded
-- Anamnesis attachments (documents/anamnesis/{coach id}/{athlete id}/…) are the coach's own
-- uploads and covered by the coach's existing access to the documents bucket; the third policy
-- makes that explicit.

drop policy if exists "athlete_uploads_delete_coach" on storage.objects;
create policy "athlete_uploads_delete_coach" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'athlete-uploads'
    and exists (
      select 1 from public.athlete_connections c
      where c.id::text = (storage.foldername(name))[1]
        and c.coach_user_id = auth.uid()
    )
  );

drop policy if exists "chat_files_delete_coach" on storage.objects;
create policy "chat_files_delete_coach" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'chat'
    and exists (
      select 1 from public.athlete_connections c
      where c.id::text = (storage.foldername(name))[2]
        and c.coach_user_id = auth.uid()
    )
  );

drop policy if exists "anamnesis_files_delete_coach" on storage.objects;
create policy "anamnesis_files_delete_coach" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'anamnesis'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Listing the folders (needed to find the files to delete) — the coach may list the same paths
drop policy if exists "athlete_files_list_coach" on storage.objects;
create policy "athlete_files_list_coach" on storage.objects
  for select to authenticated
  using (
    (bucket_id = 'documents' and (storage.foldername(name))[1] = 'chat' and exists (
      select 1 from public.athlete_connections c
      where c.id::text = (storage.foldername(name))[2] and c.coach_user_id = auth.uid()
    ))
    or (bucket_id = 'documents' and (storage.foldername(name))[1] = 'anamnesis'
        and (storage.foldername(name))[2] = auth.uid()::text)
  );

-- Optional, once you're sure the 25 Sept anamnesis cleanup worked: these backups still hold copies
-- of every anamnesis from before that date, including athletes deleted since. Uncomment to drop them.
-- drop table if exists public.athlete_anamneses_backup_20260925;
-- drop table if exists public.anamnesis_templates_backup_20260925;
