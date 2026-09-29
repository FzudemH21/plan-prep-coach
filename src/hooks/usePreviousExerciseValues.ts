/**
 * usePreviousExerciseValues — the values an athlete logged for each exercise the last time it was
 * done (most recent completed session log, not counting the session being logged now). Shown as a
 * hint in empty set fields while logging (athlete app + coach mobile), e.g. the weight used last
 * time when the intensity is prescribed via RiR.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PreviousExerciseValues {
  /** yyyy-MM-dd of the session the values come from */
  date: string;
  /** Logged values per set (index = set number - 1) */
  sets: Array<Record<string, string>>;
}

type LoggedExercise = {
  exerciseName?: string;
  sets?: Array<{ setNumber?: number; values?: Record<string, string> }>;
};

const HISTORY_LIMIT = 40;

export function usePreviousExerciseValues(
  connectionId: string | null | undefined,
  exerciseNames: string[],
  /** The session being logged — its own log is skipped */
  current: { date: string; sessionId: string } | null,
): Map<string, PreviousExerciseValues> {
  const [logs, setLogs] = useState<Array<{ date: string; session_id: string | null; sets_logged: LoggedExercise[] | null }>>([]);

  useEffect(() => {
    if (!connectionId) return;
    let cancelled = false;
    supabase
      .from('athlete_session_logs')
      .select('date, session_id, sets_logged')
      .eq('athlete_connection_id', connectionId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data }) => {
        if (!cancelled && data) setLogs(data as typeof logs);
      });
    return () => { cancelled = true; };
  }, [connectionId]);

  const namesKey = exerciseNames.join('\u0000');
  return useMemo(() => {
    const result = new Map<string, PreviousExerciseValues>();
    const wanted = new Set(namesKey.split('\u0000').filter(Boolean).map(n => n.toLowerCase()));
    for (const log of logs) {
      if (current && log.date === current.date && log.session_id === current.sessionId) continue;
      for (const ex of log.sets_logged ?? []) {
        const name = ex.exerciseName?.toLowerCase();
        if (!name || !wanted.has(name) || result.has(name)) continue;
        const sets = (ex.sets ?? []).map(s => {
          const values: Record<string, string> = {};
          for (const [k, v] of Object.entries(s.values ?? {})) {
            if (v !== undefined && v !== null && String(v).trim() !== '') values[k] = String(v);
          }
          return values;
        });
        if (sets.some(s => Object.keys(s).length > 0)) result.set(name, { date: log.date, sets });
      }
    }
    return result;
  }, [logs, namesKey, current?.date, current?.sessionId]);
}

/** The value logged last time for a set (falls back to the last logged set when there were fewer sets) */
export function previousValueFor(prev: PreviousExerciseValues | undefined, param: string, setIdx: number): string {
  if (!prev || prev.sets.length === 0) return '';
  const own = prev.sets[setIdx]?.[param];
  if (own) return own;
  for (let i = Math.min(setIdx, prev.sets.length - 1); i >= 0; i--) {
    const v = prev.sets[i]?.[param];
    if (v) return v;
  }
  return '';
}
