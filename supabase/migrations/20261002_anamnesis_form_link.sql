-- Anamnesis form link: the athlete fills in their part of an anamnesis online (no login).
--
-- The coach creates an anamnesis record with a random form_token and sends the link
-- /anamnesis/{token}. The athlete reads it and writes to it only through the three
-- SECURITY DEFINER functions below, keyed by the token: they expose just the sections marked
-- "Filled in by the athlete" (template_snapshot.sections[].athleteFills), the athlete's profile
-- details for pre-filling, and the coach's privacy notice — and accept answers only for those
-- sections, only while the link is open (sent, not expired, not yet submitted).
-- On submit, both consents (privacy notice read + explicit consent to health data processing)
-- are stored with the server time and the privacy notice version.

-- ── Record columns ───────────────────────────────────────────────────────────
alter table public.athlete_anamneses
  add column if not exists form_token text unique,
  add column if not exists form_status text check (form_status in ('sent', 'submitted')),
  add column if not exists form_expires_at timestamptz,
  add column if not exists form_submitted_at timestamptz,
  add column if not exists form_language text,
  add column if not exists consent jsonb,
  add column if not exists athlete_profile_answers jsonb,
  add column if not exists profile_applied_at timestamptz;

-- ── The coach's privacy notice shown in the form (versioned) ─────────────────
create table if not exists public.coach_privacy_notices (
  coach_user_id  uuid primary key references auth.users(id) on delete cascade,
  company_name   text not null default '',
  contact_email  text not null default '',
  notice_de      text not null default '',
  notice_en      text not null default '',
  version        integer not null default 1,
  updated_at     timestamptz not null default now()
);

alter table public.coach_privacy_notices enable row level security;

drop policy if exists "coach_owns_privacy_notice" on public.coach_privacy_notices;
create policy "coach_owns_privacy_notice" on public.coach_privacy_notices
  for all using (coach_user_id = auth.uid()) with check (coach_user_id = auth.uid());

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- Field ids of the sections the athlete fills in
create or replace function public.anamnesis_athlete_field_ids(p_snapshot jsonb)
returns setof text
language sql immutable
set search_path = public
as $$
  select f ->> 'id'
  from jsonb_array_elements(coalesce(p_snapshot -> 'sections', '[]'::jsonb)) s,
       jsonb_array_elements(coalesce(s -> 'fields', '[]'::jsonb)) f
  where coalesce((s ->> 'athleteFills')::boolean, false);
$$;

-- Only the known profile keys, with sane values and lengths
create or replace function public.anamnesis_clean_profile(p jsonb)
returns jsonb
language sql immutable
set search_path = public
as $$
  select case when p is null or jsonb_typeof(p) <> 'object' then null else jsonb_strip_nulls(jsonb_build_object(
    'firstName', left(p ->> 'firstName', 100),
    'lastName', left(p ->> 'lastName', 100),
    'birthday', case when p ->> 'birthday' ~ '^\d{4}-\d{2}-\d{2}$' then p ->> 'birthday' end,
    'sex', case when p ->> 'sex' in ('male', 'female', 'other') then p ->> 'sex' end,
    'sports', case when jsonb_typeof(p -> 'sports') = 'array' then (
      select coalesce(jsonb_agg(left(x, 100)), '[]'::jsonb)
      from (select x from jsonb_array_elements_text(p -> 'sports') as t(x) limit 10) s
    ) end,
    'occupation', left(p ->> 'occupation', 200),
    'dailyActivityLevel', case when p ->> 'dailyActivityLevel' in
      ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')
      then p ->> 'dailyActivityLevel' end
  )) end;
$$;

-- ── Read the form ────────────────────────────────────────────────────────────
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
  where coalesce((s ->> 'athleteFills')::boolean, false);

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_values
  from jsonb_each(coalesce(r.field_values, '{}'::jsonb)) e
  where e.key in (select public.anamnesis_athlete_field_ids(r.template_snapshot));

  select a.value into v_ath
  from public.athlete_database d,
       jsonb_array_elements(coalesce(d.data -> 'athletes', '[]'::jsonb)) a
  where d.user_id = r.coach_user_id and a.value ->> 'id' = r.athlete_local_id
  limit 1;

  select * into v_notice from public.coach_privacy_notices where coach_user_id = r.coach_user_id;

  return jsonb_build_object(
    'status', 'open',
    'expiresAt', r.form_expires_at,
    'templateName', r.template_snapshot ->> 'name',
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
      'dailyActivityLevel', v_ath ->> 'dailyActivityLevel'
    ))),
    'language', r.form_language,
    'companyName', coalesce(v_notice.company_name, ''),
    'contactEmail', coalesce(v_notice.contact_email, ''),
    'noticeDe', coalesce(v_notice.notice_de, ''),
    'noticeEn', coalesce(v_notice.notice_en, ''),
    'noticeVersion', v_notice.version
  );
end;
$$;

-- ── Save a draft ─────────────────────────────────────────────────────────────
create or replace function public.save_anamnesis_form(p_token text, p_values jsonb, p_profile jsonb, p_language text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r       public.athlete_anamneses;
  v_clean jsonb;
begin
  select * into r from public.athlete_anamneses where form_token = p_token for update;
  if not found or r.form_status is distinct from 'sent' or r.form_expires_at < now() then
    return false;
  end if;

  -- Answers only for the athlete's sections, as text, at most 5000 characters each
  select coalesce(jsonb_object_agg(e.key, to_jsonb(left(e.value #>> '{}', 5000))), '{}'::jsonb) into v_clean
  from jsonb_each(case when jsonb_typeof(p_values) = 'object' then p_values else '{}'::jsonb end) e
  where e.key in (select public.anamnesis_athlete_field_ids(r.template_snapshot));

  update public.athlete_anamneses set
    field_values = coalesce(field_values, '{}'::jsonb) || v_clean,
    athlete_profile_answers = coalesce(public.anamnesis_clean_profile(p_profile), athlete_profile_answers),
    form_language = case when p_language in ('de', 'en') then p_language else form_language end,
    updated_at = now()
  where id = r.id;
  return true;
end;
$$;

-- ── Submit (needs both consents) ─────────────────────────────────────────────
create or replace function public.submit_anamnesis_form(
  p_token text, p_values jsonb, p_profile jsonb, p_language text, p_consent jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r         public.athlete_anamneses;
  v_version integer;
begin
  if not coalesce((p_consent ->> 'privacyNoticeRead')::boolean, false)
     or not coalesce((p_consent ->> 'healthDataConsent')::boolean, false) then
    raise exception 'consent_required';
  end if;

  if not public.save_anamnesis_form(p_token, p_values, p_profile, p_language) then
    return false;
  end if;

  select * into r from public.athlete_anamneses where form_token = p_token for update;
  select version into v_version from public.coach_privacy_notices where coach_user_id = r.coach_user_id;

  update public.athlete_anamneses set
    form_status = 'submitted',
    form_submitted_at = now(),
    consent = jsonb_strip_nulls(jsonb_build_object(
      'privacyNoticeRead', true,
      'healthDataConsent', true,
      'guardianName', left(p_consent ->> 'guardianName', 200),
      'privacyText', left(p_consent ->> 'privacyText', 2000),
      'consentText', left(p_consent ->> 'consentText', 4000),
      'noticeVersion', v_version,
      'language', case when p_language in ('de', 'en') then p_language end,
      'consentedAt', now()
    )),
    updated_at = now()
  where id = r.id and form_status = 'sent';
  return true;
end;
$$;

revoke all on function public.get_anamnesis_form(text) from public;
revoke all on function public.save_anamnesis_form(text, jsonb, jsonb, text) from public;
revoke all on function public.submit_anamnesis_form(text, jsonb, jsonb, text, jsonb) from public;
grant execute on function public.get_anamnesis_form(text) to anon, authenticated;
grant execute on function public.save_anamnesis_form(text, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.submit_anamnesis_form(text, jsonb, jsonb, text, jsonb) to anon, authenticated;
