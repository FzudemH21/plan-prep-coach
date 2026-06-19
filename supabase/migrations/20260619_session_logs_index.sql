-- Speed up exercise history lookups.
-- Without this index every history query did a full table scan;
-- with it the planner uses an index-only scan ordered by date.
CREATE INDEX IF NOT EXISTS athlete_session_logs_connection_date_idx
  ON athlete_session_logs (athlete_connection_id, date DESC);
