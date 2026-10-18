-- A coach can close an athlete's unfinished session (finish it with what was logged so far).
-- closed_by_coach_at marks such sessions, so the summary shows "Closed by coach" — the athlete
-- didn't rate it herself. The existing coach update policy on athlete_session_logs covers it.

ALTER TABLE athlete_session_logs ADD COLUMN IF NOT EXISTS closed_by_coach_at timestamptz;
