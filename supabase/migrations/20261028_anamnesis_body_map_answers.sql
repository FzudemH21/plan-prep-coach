-- Body map with questions per spot (2026-10-28): every marked spot keeps its own answers inside the
-- body map's answer, so that one answer can get much longer than before. The form link stored at
-- most 5000 characters per answer and cut off the rest — for the body map's JSON that would make the
-- whole answer unreadable. Now: up to 30000 characters per answer.
--
-- Run once in the Supabase SQL editor. Safe to run again. Replaces save_anamnesis_form (last
-- version: 20261002_anamnesis_form_link) — unchanged apart from the limit. submit_anamnesis_form
-- saves through it, so it needs no change.

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

  -- Answers only for the athlete's sections, as text, at most 30000 characters each
  select coalesce(jsonb_object_agg(e.key, to_jsonb(left(e.value #>> '{}', 30000))), '{}'::jsonb) into v_clean
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

revoke all on function public.save_anamnesis_form(text, jsonb, jsonb, text) from public;
grant execute on function public.save_anamnesis_form(text, jsonb, jsonb, text) to anon, authenticated;
