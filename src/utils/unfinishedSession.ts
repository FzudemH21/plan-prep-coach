/**
 * unfinishedSession — a workout started in the athlete app (or coach mobile) that was never
 * finished stays "In progress" in the coach's calendar. After SESSION_LOCK_TIMEOUT_MS without being
 * paused it counts as unfinished (stale), and the coach can close it for the athlete:
 *   • finish it with what was logged so far (optionally counting the unticked sets as done), or
 *   • reset it (the log is deleted, the session is planned again).
 */
import { supabase } from '@/lib/supabase';
import { SESSION_LOCK_TIMEOUT_MS } from '@/utils/sessionLock';
import type { WorkoutProgress } from '@/utils/workoutProgress';
import type { SessionSummary } from '@/hooks/useAthleteApp';

/** Started more than 4 h ago and not paused — nobody is training it any more */
export function isStaleUnfinished(startedAt: string | null | undefined, pausedAt: string | null | undefined): boolean {
  if (!startedAt || pausedAt) return false;
  return Date.now() - new Date(startedAt).getTime() >= SESSION_LOCK_TIMEOUT_MS;
}

export interface UnfinishedLogDetails {
  id: string;
  date: string;
  sessionId: string;
  sessionName: string | null;
  startedAt: string;
  startedBy: string | null;
  pausedAt: string | null;
  progress: WorkoutProgress | null;
  /** The session as planned (athlete_schedule) — null when it's no longer on the schedule */
  session: SessionSummary | null;
}

const isMissingColumn = (message: string | undefined, column: string) =>
  !!message && message.includes(column);

/** The unfinished log with its saved progress and the planned session it belongs to */
export async function fetchUnfinishedLogDetails(logId: string, connectionId: string): Promise<UnfinishedLogDetails | null> {
  type Row = {
    id: string; date: string; session_id: string; session_name: string | null; started_at: string | null;
    started_by?: string | null; paused_at?: string | null; progress?: WorkoutProgress | null; completed_at: string | null;
  };
  const query = (columns: string) => supabase.from('athlete_session_logs').select(columns).eq('id', logId).maybeSingle();
  let res = await query('id, date, session_id, session_name, started_at, completed_at, started_by, paused_at, progress');
  // pause / resume or started_by migration not run — load without those columns
  if (res.error) res = await query('id, date, session_id, session_name, started_at, completed_at');
  const row = res.data as unknown as Row | null;
  if (!row?.started_at || row.completed_at) return null;

  const { data: scheduleRow } = await supabase
    .from('athlete_schedule')
    .select('sessions')
    .eq('athlete_connection_id', connectionId)
    .eq('date', row.date)
    .maybeSingle();
  const sessions = ((scheduleRow as { sessions?: SessionSummary[] } | null)?.sessions) ?? [];

  return {
    id: row.id,
    date: row.date,
    sessionId: row.session_id,
    sessionName: row.session_name,
    startedAt: row.started_at,
    startedBy: row.started_by ?? null,
    pausedAt: row.paused_at ?? null,
    progress: row.progress?.v === 1 ? row.progress : null,
    session: sessions.find(s => s.id === row.session_id) ?? null,
  };
}

/** The newest unfinished log of a session instance (any role) — its id, or null */
export async function findUnfinishedLogId(connectionId: string, date: string, sessionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('athlete_session_logs')
    .select('id')
    .eq('athlete_connection_id', connectionId)
    .eq('date', date)
    .eq('session_id', sessionId)
    .is('completed_at', null)
    .not('started_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * The coach finishes an unfinished session for the athlete. Marked "closed by coach"
 * (closed_by_coach_at — left out when that migration hasn't been run). Only an unfinished log is
 * changed: if the athlete finished it in the meantime, nothing is overwritten.
 * Returns an error message, or null.
 */
export async function closeUnfinishedSession(logId: string, values: {
  setsLogged: unknown[];
  borgRating: number | null;
  durationSeconds: number | null;
}): Promise<string | null> {
  const payload: Record<string, unknown> = {
    completed_at: new Date().toISOString(),
    borg_rating: values.borgRating,
    duration_seconds: values.durationSeconds,
    sets_logged: values.setsLogged,
    progress: null,
    paused_at: null,
    closed_by_coach_at: new Date().toISOString(),
  };
  const run = (p: Record<string, unknown>) => supabase
    .from('athlete_session_logs').update(p).eq('id', logId).is('completed_at', null).select('id');
  let res = await run(payload);
  for (const column of ['closed_by_coach_at', 'progress', 'paused_at']) {
    if (!res.error || !isMissingColumn(res.error.message, column)) continue;
    delete payload[column];
    res = await run(payload);
  }
  if (res.error) return res.error.message;
  if (!res.data || res.data.length === 0) return 'The session was already finished in the meantime.';
  return null;
}

/** The coach resets an unfinished session: the log is deleted, the session is planned again */
export async function resetUnfinishedSession(logId: string): Promise<string | null> {
  const { error } = await supabase.from('athlete_session_logs').delete().eq('id', logId).is('completed_at', null);
  return error ? error.message : null;
}

/**
 * The athlete app finishing a started workout: only while the log is still unfinished.
 * 'closedByCoach' — the coach closed it in the meantime (nothing overwritten);
 * 'missing' — the coach reset it (the caller saves the workout as a new log).
 */
export async function completeStartedLog(logId: string, payload: Record<string, unknown>): Promise<
  { status: 'saved' | 'closedByCoach' | 'missing'; error?: undefined } | { status: 'error'; error: string }
> {
  const { data, error } = await supabase
    .from('athlete_session_logs').update(payload).eq('id', logId).is('completed_at', null).select('id');
  if (error) return { status: 'error', error: error.message };
  if (data && data.length > 0) return { status: 'saved' };
  const { data: existing } = await supabase.from('athlete_session_logs').select('id').eq('id', logId).maybeSingle();
  return { status: existing ? 'closedByCoach' : 'missing' };
}
