-- anamnesis_templates: coach-defined reusable intake templates
CREATE TABLE IF NOT EXISTS public.anamnesis_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- sections: [{id, title, fields: [{id, label, fieldType, options?, placeholder?}]}]
  sections        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.anamnesis_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_owns_anamnesis_templates"
  ON public.anamnesis_templates
  FOR ALL
  USING (coach_user_id = auth.uid())
  WITH CHECK (coach_user_id = auth.uid());

-- athlete_anamneses: per-athlete timestamped intake records (history log)
CREATE TABLE IF NOT EXISTS public.athlete_anamneses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_local_id      TEXT NOT NULL,
  -- Which template was used (nullable if template was later deleted)
  template_id           UUID REFERENCES public.anamnesis_templates(id) ON DELETE SET NULL,
  -- Immutable snapshot of the template at time of creation
  -- Prevents future template edits from corrupting historical records
  template_snapshot     JSONB NOT NULL DEFAULT '{"name":"","sections":[]}',
  -- Date the anamnesis session was conducted (coach-set, defaults to today)
  conducted_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Extra structured questions added for this specific record only (do not affect template)
  custom_questions      JSONB NOT NULL DEFAULT '[]',
  -- Answers to template fields: { fieldId: stringValue }
  field_values          JSONB NOT NULL DEFAULT '{}',
  -- Answers to custom questions: { fieldId: stringValue }
  custom_field_values   JSONB NOT NULL DEFAULT '{}',
  notes                 TEXT NOT NULL DEFAULT '',
  ai_summary            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_anamneses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_owns_athlete_anamneses"
  ON public.athlete_anamneses
  FOR ALL
  USING (coach_user_id = auth.uid())
  WITH CHECK (coach_user_id = auth.uid());

-- Index for fast per-athlete queries
CREATE INDEX IF NOT EXISTS idx_athlete_anamneses_athlete
  ON public.athlete_anamneses (coach_user_id, athlete_local_id, conducted_at DESC);
