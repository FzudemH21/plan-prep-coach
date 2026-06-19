import { supabase } from '@/lib/supabase';

/** How long an unfinished session log keeps blocking the other party before
 *  it's treated as abandoned (e.g. the starter closed the app mid-workout). */
export const SESSION_LOCK_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface SessionLockInfo {
  lockedBy: 'coach' | 'athlete';
  startedAt: string;
}

/** Returns lock info if the OTHER role has an active (started, not completed,
 *  not stale) log for this exact session instance — null if free to start/edit. */
export async function checkSessionLock(
  connectionId: string,
  date: string,
  sessionId: string,
  myRole: 'coach' | 'athlete',
): Promise<SessionLockInfo | null> {
  const { data } = await supabase
    .from('athlete_session_logs')
    .select('started_at, started_by')
    .eq('athlete_connection_id', connectionId)
    .eq('date', date)
    .eq('session_id', sessionId)
    .is('completed_at', null)
    .not('started_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.started_at || !data.started_by || data.started_by === myRole) return null;
  const ageMs = Date.now() - new Date(data.started_at).getTime();
  if (ageMs >= SESSION_LOCK_TIMEOUT_MS) return null;
  return { lockedBy: data.started_by as 'coach' | 'athlete', startedAt: data.started_at };
}
