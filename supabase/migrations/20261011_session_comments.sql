-- Session comments (athlete app + coach mobile)
--
-- 1. Athletes' comments on single exercises stay with the session (no longer chat messages):
--    athlete_session_logs.exercise_comments = [{ id, exerciseName, sectionName?, text, createdAt }]
--    The existing athlete/coach policies on athlete_session_logs cover the new column.
-- 2. The coach's private remarks on a session. Athletes can read every column of their own
--    session logs, so the remarks live in their own table that only the coach can read.

ALTER TABLE athlete_session_logs ADD COLUMN IF NOT EXISTS exercise_comments jsonb NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS public.coach_session_remarks (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_log_id        uuid        NOT NULL REFERENCES athlete_session_logs(id) ON DELETE CASCADE,
  athlete_connection_id uuid        NOT NULL REFERENCES athlete_connections(id) ON DELETE CASCADE,
  remark                text        NOT NULL DEFAULT '',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_log_id)
);

CREATE INDEX IF NOT EXISTS coach_session_remarks_connection_idx
  ON public.coach_session_remarks (athlete_connection_id);

ALTER TABLE public.coach_session_remarks ENABLE ROW LEVEL SECURITY;

-- Only the coach who wrote them — athletes have no access at all
CREATE POLICY "coach_manage_session_remarks"
  ON public.coach_session_remarks
  FOR ALL
  USING  (coach_user_id = auth.uid())
  WITH CHECK (coach_user_id = auth.uid());
