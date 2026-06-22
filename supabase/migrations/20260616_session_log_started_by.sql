-- Tracks which side (coach or athlete) started an in-progress session log,
-- so the other side can be blocked from starting/logging/editing the same
-- session while it's in progress (see CoachMobileSessionEditPage,
-- CoachMobileSessionLoggingPage, AthleteSessionPage).
ALTER TABLE athlete_session_logs ADD COLUMN IF NOT EXISTS started_by TEXT CHECK (started_by IN ('coach', 'athlete'));
