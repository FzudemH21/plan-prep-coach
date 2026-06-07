-- exercise_param_tags: per-coach parameter role tags for e1RM estimation.
-- The coach tags which column is weight, reps, and RIR per exercise.
-- Athletes can read their coach's tags via RLS to compute and display e1RM
-- charts in their own Progress tab.

CREATE TABLE IF NOT EXISTS public.exercise_param_tags (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name text        NOT NULL,
  weight_param  text        NOT NULL,
  reps_param    text        NOT NULL,
  rir_param     text,                   -- optional
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_user_id, exercise_name)
);

ALTER TABLE public.exercise_param_tags ENABLE ROW LEVEL SECURITY;

-- Coach can fully manage their own tags
CREATE POLICY "coach_manage_exercise_param_tags"
  ON public.exercise_param_tags
  FOR ALL
  USING  (coach_user_id = auth.uid())
  WITH CHECK (coach_user_id = auth.uid());

-- Athletes can read tags belonging to their coach
-- (used to render e1RM charts in the athlete Progress tab)
CREATE POLICY "athlete_read_exercise_param_tags"
  ON public.exercise_param_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.athlete_auth_user_id = auth.uid()
        AND ac.coach_user_id = exercise_param_tags.coach_user_id
    )
  );
