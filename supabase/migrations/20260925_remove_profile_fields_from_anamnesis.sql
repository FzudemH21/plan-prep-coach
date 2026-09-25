-- Remove profile fields from anamneses
--
-- Name, date of birth, sex, profession and previous activity level now live on the
-- athlete profile (entered once in the Add Athlete dialog). This strips those five
-- fields from:
--   1. every coach's saved anamnesis templates (anamnesis_templates.sections)
--   2. every existing anamnesis record (template_snapshot.sections + field_values)
-- and renames the default "Basic Information" section to "Current Status & History"
-- (only where the coach hasn't renamed it already).
--
-- Only fields with these ids are touched (the ones seeded from the default template):
--   f-name, f-dob, f-sex, f-profession, f-activity
-- Fields a coach created themselves are never removed, even if they ask the same thing.
--
-- Safety: full copies of both tables are written to *_backup_20260925 first.
-- RLS is enabled on the backups with no policies, so they're unreachable through the
-- API (they contain health data) — only visible in the Supabase dashboard.

BEGIN;

-- ── 1. Backups ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anamnesis_templates_backup_20260925 AS
  SELECT * FROM public.anamnesis_templates;
ALTER TABLE public.anamnesis_templates_backup_20260925 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.athlete_anamneses_backup_20260925 AS
  SELECT * FROM public.athlete_anamneses;
ALTER TABLE public.athlete_anamneses_backup_20260925 ENABLE ROW LEVEL SECURITY;

-- ── 2. Helper: strip the fields from a sections array (session-only function) ──
CREATE FUNCTION pg_temp.strip_profile_fields(sections jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_set(
      CASE
        WHEN s->>'id' = 'sec-basic' AND s->>'title' = 'Basic Information'
          THEN jsonb_set(s, '{title}', '"Current Status & History"')
        ELSE s
      END,
      '{fields}',
      COALESCE((
        SELECT jsonb_agg(f ORDER BY f_ord)
        FROM jsonb_array_elements(COALESCE(s->'fields', '[]'::jsonb)) WITH ORDINALITY AS fe(f, f_ord)
        WHERE f->>'id' NOT IN ('f-name', 'f-dob', 'f-sex', 'f-profession', 'f-activity')
      ), '[]'::jsonb)
    ) ORDER BY s_ord
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(sections, '[]'::jsonb)) WITH ORDINALITY AS se(s, s_ord);
$$;

-- ── 3. Templates ────────────────────────────────────────────────────────────
UPDATE public.anamnesis_templates
SET sections   = pg_temp.strip_profile_fields(sections),
    updated_at = now()
WHERE sections::text ~ '"id": ?"f-(name|dob|sex|profession|activity)"'
   OR sections::text LIKE '%"title": "Basic Information"%';

-- ── 4. Existing anamnesis records ───────────────────────────────────────────
UPDATE public.athlete_anamneses
SET template_snapshot = jsonb_set(
      template_snapshot,
      '{sections}',
      pg_temp.strip_profile_fields(template_snapshot->'sections')
    ),
    field_values = field_values - ARRAY['f-name', 'f-dob', 'f-sex', 'f-profession', 'f-activity']
WHERE template_snapshot::text ~ '"id": ?"f-(name|dob|sex|profession|activity)"'
   OR field_values ?| ARRAY['f-name', 'f-dob', 'f-sex', 'f-profession', 'f-activity']
   OR template_snapshot::text LIKE '%"title": "Basic Information"%';

COMMIT;

-- ── 5. Verification — both counts should be 0 ──────────────────────────────
SELECT
  (SELECT count(*) FROM public.anamnesis_templates
     WHERE sections::text ~ '"id": ?"f-(name|dob|sex|profession|activity)"') AS templates_still_containing_fields,
  (SELECT count(*) FROM public.athlete_anamneses
     WHERE template_snapshot::text ~ '"id": ?"f-(name|dob|sex|profession|activity)"'
        OR field_values ?| ARRAY['f-name', 'f-dob', 'f-sex', 'f-profession', 'f-activity']) AS anamneses_still_containing_fields;
