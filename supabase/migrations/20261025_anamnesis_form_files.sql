-- File uploads in the anamnesis form link (e.g. an MRI report under "What came out of it?").
-- A question with "allowFiles" gets an upload below its answer. The files go to the documents
-- bucket under  anamnesis-form/<anamnesis id>/<form token>/<file>  and their list is stored as an
-- answer of its own: "<question id>__files" (JSON: path, name, size, mimeType).
--
-- 1. the form may save the "__files" answers (only for questions with allowFiles)
-- 2. the form gets the anamnesis id (folder name)
-- 3. storage: whoever holds a valid, still open form link may upload / remove files in that
--    anamnesis' folder (nothing else); the coach of the anamnesis may read and delete them
--
-- Run once in the Supabase SQL editor. Safe to run again. Replaces get_anamnesis_form (last version:
-- 20261019_anamnesis_template_languages) — unchanged apart from recordId.

-- ── 1. Answers the athlete may save: their questions + the file lists of questions with uploads ──
create or replace function public.anamnesis_athlete_field_ids(p_snapshot jsonb)
returns setof text
language sql immutable
set search_path = public
as $$
  select f ->> 'id'
  from jsonb_array_elements(coalesce(p_snapshot -> 'sections', '[]'::jsonb)) s,
       jsonb_array_elements(coalesce(s -> 'fields', '[]'::jsonb)) f
  where coalesce((s ->> 'athleteFills')::boolean, false)
  union all
  select (f ->> 'id') || '__files'
  from jsonb_array_elements(coalesce(p_snapshot -> 'sections', '[]'::jsonb)) s,
       jsonb_array_elements(coalesce(s -> 'fields', '[]'::jsonb)) f
  where coalesce((s ->> 'athleteFills')::boolean, false)
    and coalesce((f ->> 'allowFiles')::boolean, false);
$$;

-- ── 2. The form link gets the anamnesis id ──
create or replace function public.get_anamnesis_form(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  r        public.athlete_anamneses;
  v_secs   jsonb;
  v_values jsonb;
  v_ath    jsonb;
  v_notice public.coach_privacy_notices;
  v_prof   public.coach_profiles;
  v_intro  text;
  v_lang   text;
  v_tr     jsonb;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;
  select * into r from public.athlete_anamneses where form_token = p_token;
  if not found then
    return null;
  end if;
  if r.form_status = 'submitted' then
    return jsonb_build_object('status', 'submitted');
  end if;
  if r.form_status is distinct from 'sent' or r.form_expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select coalesce(jsonb_agg(s), '[]'::jsonb) into v_secs
  from jsonb_array_elements(coalesce(r.template_snapshot -> 'sections', '[]'::jsonb)) s
  where coalesce((s ->> 'athleteFills')::boolean, true);

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_values
  from jsonb_each(coalesce(r.field_values, '{}'::jsonb)) e
  where e.key in (select public.anamnesis_athlete_field_ids(r.template_snapshot));

  select a.value into v_ath
  from public.athlete_database d,
       jsonb_array_elements(coalesce(d.data -> 'athletes', '[]'::jsonb)) a
  where d.user_id = r.coach_user_id and a.value ->> 'id' = r.athlete_local_id
  limit 1;

  select * into v_notice from public.coach_privacy_notices where coach_user_id = r.coach_user_id;
  select * into v_prof from public.coach_profiles where user_id = r.coach_user_id;

  select nullif(trim(t.intro_text), '') into v_intro
  from public.anamnesis_templates t
  where t.id::text = r.template_id::text and t.coach_user_id = r.coach_user_id;
  v_intro := coalesce(v_intro, nullif(trim(r.template_snapshot ->> 'introText'), ''));

  select t.language, t.translations into v_lang, v_tr
  from public.anamnesis_templates t
  where t.id::text = r.template_id::text and t.coach_user_id = r.coach_user_id;
  v_lang := coalesce(v_lang, r.template_snapshot ->> 'language');
  v_tr := coalesce(v_tr, r.template_snapshot -> 'translations');

  return jsonb_build_object(
    'status', 'open',
    'recordId', r.id,
    'expiresAt', r.form_expires_at,
    'templateName', r.template_snapshot ->> 'name',
    'introText', v_intro,
    'templateLanguage', v_lang,
    'translations', v_tr,
    'sections', v_secs,
    'values', v_values,
    'profile', coalesce(r.athlete_profile_answers, public.anamnesis_clean_profile(jsonb_build_object(
      'firstName', v_ath ->> 'firstName',
      'lastName', v_ath ->> 'lastName',
      'birthday', v_ath ->> 'birthday',
      'sex', v_ath ->> 'sex',
      'sports', coalesce(v_ath -> 'sports',
        case when v_ath ->> 'sport' is not null then jsonb_build_array(v_ath ->> 'sport') else '[]'::jsonb end),
      'occupation', v_ath ->> 'occupation',
      'dailyActivityLevel', v_ath ->> 'dailyActivityLevel',
      'billingAddress', v_ath -> 'billingAddress'
    ))),
    'language', r.form_language,
    'companyName', coalesce(nullif(v_prof.data -> 'branding' ->> 'businessName', ''), nullif(v_notice.company_name, ''), ''),
    'contactEmail', coalesce(nullif(v_notice.contact_email, ''), nullif(v_prof.data ->> 'contactEmail', ''), ''),
    'logo', nullif(v_prof.data -> 'branding' ->> 'logoBase64', ''),
    'brandColor', nullif(v_prof.data -> 'branding' ->> 'primaryColor', ''),
    'noticeDe', coalesce(v_notice.notice_de, ''),
    'noticeEn', coalesce(v_notice.notice_en, ''),
    'noticeVersion', v_notice.version
  );
end;
$$;

revoke all on function public.get_anamnesis_form(text) from public;
grant execute on function public.get_anamnesis_form(text) to anon, authenticated;

-- ── 3. Storage ──
-- Valid upload folder: the anamnesis exists, the token is its current form token and the form is
-- still open (not submitted, not expired). Security definer: the form link has no table access.
create or replace function public.anamnesis_form_upload_ok(p_record text, p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.athlete_anamneses a
    where a.id::text = p_record
      and p_token is not null and length(p_token) >= 20
      and a.form_token = p_token
      and a.form_status = 'sent'
      and (a.form_expires_at is null or a.form_expires_at > now())
  );
$$;

revoke all on function public.anamnesis_form_upload_ok(text, text) from public;
grant execute on function public.anamnesis_form_upload_ok(text, text) to anon, authenticated;

-- The form link: upload, see and remove its own files (path: anamnesis-form/<id>/<token>/<file>)
drop policy if exists "anamnesis_form_files_insert" on storage.objects;
create policy "anamnesis_form_files_insert" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'anamnesis-form'
    and public.anamnesis_form_upload_ok((storage.foldername(name))[2], (storage.foldername(name))[3])
  );

drop policy if exists "anamnesis_form_files_select_form" on storage.objects;
create policy "anamnesis_form_files_select_form" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'anamnesis-form'
    and public.anamnesis_form_upload_ok((storage.foldername(name))[2], (storage.foldername(name))[3])
  );

drop policy if exists "anamnesis_form_files_delete_form" on storage.objects;
create policy "anamnesis_form_files_delete_form" on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'anamnesis-form'
    and public.anamnesis_form_upload_ok((storage.foldername(name))[2], (storage.foldername(name))[3])
  );

-- The coach of the anamnesis: read (preview / download) and delete
drop policy if exists "anamnesis_form_files_select_coach" on storage.objects;
create policy "anamnesis_form_files_select_coach" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'anamnesis-form'
    and exists (
      select 1 from public.athlete_anamneses a
      where a.id::text = (storage.foldername(name))[2] and a.coach_user_id = auth.uid()
    )
  );

drop policy if exists "anamnesis_form_files_delete_coach" on storage.objects;
create policy "anamnesis_form_files_delete_coach" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'anamnesis-form'
    and exists (
      select 1 from public.athlete_anamneses a
      where a.id::text = (storage.foldername(name))[2] and a.coach_user_id = auth.uid()
    )
  );
