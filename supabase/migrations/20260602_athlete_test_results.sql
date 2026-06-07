-- athlete_test_results: stores test result values entered by the athlete in the athlete app.
-- The coach sees these inline in the performance tab with a "Self-reported" badge.

CREATE TABLE IF NOT EXISTS public.athlete_test_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_connection_id uuid NOT NULL REFERENCES public.athlete_connections(id) ON DELETE CASCADE,
  parameter_id     text NOT NULL,   -- matches ParameterV2 id (athleticismParameterId)
  value            text NOT NULL,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;

-- Athlete can insert and read their own results
CREATE POLICY "athlete_insert_test_results" ON public.athlete_test_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = athlete_connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );

CREATE POLICY "athlete_read_test_results" ON public.athlete_test_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = athlete_connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );

-- Coach can read all results for their athletes
CREATE POLICY "coach_read_test_results" ON public.athlete_test_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = athlete_connection_id
        AND ac.coach_user_id = auth.uid()
    )
  );
