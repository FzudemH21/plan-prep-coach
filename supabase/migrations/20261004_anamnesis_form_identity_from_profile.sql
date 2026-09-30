-- Anamnesis form link: company name and contact email come from the coach profile.
--
-- The form (and its consent text) now uses the business name from the coach profile's Report
-- Branding and the contact email from its Personal Information, so they're kept in one place.
-- The copies in coach_privacy_notices stay as a fallback. Replaces get_anamnesis_form.

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
  v_prof   public.coach_profiles;
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
    'companyName', coalesce(nullif(v_prof.data -> 'branding' ->> 'businessName', ''), nullif(v_notice.company_name, ''), ''),
    'contactEmail', coalesce(nullif(v_prof.data ->> 'contactEmail', ''), nullif(v_notice.contact_email, ''), ''),
    'noticeDe', coalesce(v_notice.notice_de, ''),
    'noticeEn', coalesce(v_notice.notice_en, ''),
    'noticeVersion', v_notice.version
  );
end;
$$;

revoke all on function public.get_anamnesis_form(text) from public;
grant execute on function public.get_anamnesis_form(text) to anon, authenticated;
