-- Anamnesis form link: longer answers. The new question types (body map with notes, repeatable lists
-- such as injury history or upcoming events, weekly schedule grid) store their answer as JSON text —
-- 5000 characters per answer can cut a long list off. Same function as in 20261002, limit 20000.

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

  -- Answers only for the athlete's sections, as text, at most 20000 characters each
  select coalesce(jsonb_object_agg(e.key, to_jsonb(left(e.value #>> '{}', 20000))), '{}'::jsonb) into v_clean
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
