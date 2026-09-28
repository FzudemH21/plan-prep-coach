-- Athletes can attach photos / videos to a test result in the athlete app.
--
-- Files go to the private storage bucket "athlete-uploads" under "{athlete_connection_id}/…".
-- The athlete may upload / read / delete only in their own connection's folder; the coach of that
-- connection may read (to view the attachments in the athlete's Performance tab).
-- The storage paths are listed on the result row (athlete_test_results.attachments).

alter table public.athlete_test_results
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('athlete-uploads', 'athlete-uploads', false, 52428800)  -- 50 MB per file
on conflict (id) do nothing;

drop policy if exists "athlete_uploads_insert_own" on storage.objects;
create policy "athlete_uploads_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'athlete-uploads'
    and exists (
      select 1 from public.athlete_connections c
      where c.id::text = (storage.foldername(name))[1]
        and c.athlete_auth_user_id = auth.uid()
    )
  );

drop policy if exists "athlete_uploads_select_athlete_or_coach" on storage.objects;
create policy "athlete_uploads_select_athlete_or_coach" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'athlete-uploads'
    and exists (
      select 1 from public.athlete_connections c
      where c.id::text = (storage.foldername(name))[1]
        and (c.athlete_auth_user_id = auth.uid() or c.coach_user_id = auth.uid())
    )
  );

drop policy if exists "athlete_uploads_delete_own" on storage.objects;
create policy "athlete_uploads_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'athlete-uploads'
    and exists (
      select 1 from public.athlete_connections c
      where c.id::text = (storage.foldername(name))[1]
        and c.athlete_auth_user_id = auth.uid()
    )
  );
