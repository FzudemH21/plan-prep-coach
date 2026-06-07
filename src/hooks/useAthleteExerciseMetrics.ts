// Athlete-side hook — reads own session logs and the coach's exercise param tags
// (via Supabase RLS) to build exercise history and e1RM charts in the Progress tab.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { epley1RM, type ExerciseEntry, type ExerciseSession, type LoggedSet, type ParamTags } from './useExerciseMetrics';

// ── Raw DB shapes (same as coach hook — duplicated to avoid coupling) ─────────

interface RawSet {
  setNumber: number;
  values: Record<string, string>;
  completed: boolean;
}

interface RawLoggedExercise {
  exerciseName: string;
  plannedParams?: Record<string, string>;
  sets?: RawSet[];
  isCircuit?: boolean;
}

interface RawSessionLog {
  id: string;
  date: string;
  session_name: string | null;
  sets_logged: RawLoggedExercise[];
}

// ── Helper ────────────────────────────────────────────────────────────────────

function bestE1RMForSession(sets: LoggedSet[], tags: ParamTags): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!s.completed) continue;
    const w = parseFloat(s.values[tags.weightParam] ?? '');
    const r = parseFloat(s.values[tags.repsParam] ?? '');
    if (isNaN(w) || isNaN(r) || r <= 0) continue;
    const rir = tags.rirParam ? parseFloat(s.values[tags.rirParam] ?? '0') : 0;
    const est = epley1RM(w, r, isNaN(rir) ? 0 : rir);
    if (best === null || est > best) best = est;
  }
  return best;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAthleteExerciseMetrics(
  connectionId: string | null,
  coachUserId: string | null,
) {
  const [rawLogs, setRawLogs] = useState<RawSessionLog[]>([]);
  const [paramTags, setParamTags] = useState<Record<string, ParamTags>>({});
  const [logsLoading, setLogsLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);

  // ── Fetch completed session logs (athlete reads own rows via RLS) ──────────

  useEffect(() => {
    if (!connectionId) { setRawLogs([]); return; }
    let cancelled = false;
    setLogsLoading(true);
    supabase
      .from('athlete_session_logs')
      .select('id, date, session_name, sets_logged')
      .eq('athlete_connection_id', connectionId)
      .not('completed_at', 'is', null)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setRawLogs((data ?? []) as RawSessionLog[]);
          setLogsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [connectionId]);

  // ── Fetch coach's param tags (athlete RLS allows SELECT on coach's rows) ───

  useEffect(() => {
    if (!coachUserId) { setParamTags({}); return; }
    let cancelled = false;
    setTagsLoading(true);
    supabase
      .from('exercise_param_tags')
      .select('exercise_name, weight_param, reps_param, rir_param')
      .eq('coach_user_id', coachUserId)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, ParamTags> = {};
        for (const row of (data ?? [])) {
          map[row.exercise_name as string] = {
            weightParam: row.weight_param as string,
            repsParam: row.reps_param as string,
            rirParam: (row.rir_param as string | null) ?? undefined,
          };
        }
        setParamTags(map);
        setTagsLoading(false);
      });
    return () => { cancelled = true; };
  }, [coachUserId]);

  // ── Key helpers ────────────────────────────────────────────────────────────

  const baseKey = (k: string) => k.replace(/_set\d+/g, '').replace(/_unit$/, '');
  const isUnitKey = (k: string) => /_unit$/.test(k);
  const isMetaKey = (k: string) => k.endsWith('_unit') || /_set\d+/.test(k);

  // ── Derived — exercise list ────────────────────────────────────────────────

  const exercises = useMemo<ExerciseEntry[]>(() => {
    const map = new Map<string, { dates: string[]; paramNames: Set<string>; paramUnits: Record<string, string> }>();
    for (const log of rawLogs) {
      for (const ex of log.sets_logged ?? []) {
        if (ex.isCircuit || !ex.exerciseName) continue;
        if (!ex.sets?.length) continue;
        const entry = map.get(ex.exerciseName) ?? { dates: [], paramNames: new Set(), paramUnits: {} };
        entry.dates.push(log.date);
        for (const set of ex.sets) {
          for (const [k, v] of Object.entries(set.values ?? {})) {
            if (isUnitKey(k)) {
              const base = baseKey(k);
              if (base && v) entry.paramUnits[base] = v;
            } else if (!isMetaKey(k)) {
              entry.paramNames.add(k);
            }
          }
        }
        if (ex.plannedParams) {
          for (const [k, v] of Object.entries(ex.plannedParams)) {
            if (isUnitKey(k)) {
              const base = baseKey(k);
              if (base && v) entry.paramUnits[base] = v;
            } else {
              const base = baseKey(k);
              if (base) entry.paramNames.add(base);
            }
          }
        }
        map.set(ex.exerciseName, entry);
      }
    }
    return Array.from(map.entries())
      .map(([name, { dates, paramNames, paramUnits }]) => ({
        name,
        sessionCount: dates.length,
        lastDate: dates.sort().reverse()[0],
        allParamNames: Array.from(paramNames).sort(),
        allParamUnits: paramUnits,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawLogs]);

  // ── Derived — session history for one exercise ─────────────────────────────

  const getExerciseHistory = useCallback((exerciseName: string): ExerciseSession[] => {
    const tags = paramTags[exerciseName] ?? null;
    const sessions: ExerciseSession[] = [];
    const chronological = [...rawLogs].reverse();
    for (const log of chronological) {
      for (const ex of log.sets_logged ?? []) {
        if (ex.isCircuit || ex.exerciseName !== exerciseName) continue;
        if (!ex.sets?.length) continue;
        const sets: LoggedSet[] = ex.sets.map(s => ({
          setNumber: s.setNumber,
          values: s.values ?? {},
          completed: s.completed,
        }));
        sessions.push({
          logId: log.id,
          date: log.date,
          sessionName: log.session_name ?? 'Session',
          sets,
          plannedParams: ex.plannedParams,
          e1rm: tags ? bestE1RMForSession(sets, tags) : null,
        });
      }
    }
    return sessions;
  }, [rawLogs, paramTags]);

  return {
    exercises,
    loading: logsLoading || tagsLoading,
    paramTags,
    getExerciseHistory,
  };
}
