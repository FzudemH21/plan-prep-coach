// Coach-side hook — parses athlete_session_logs into per-exercise history
// and manages 1RM param tags in Supabase (with one-time localStorage migration).

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// ── Raw shape of sets_logged rows ─────────────────────────────────────────────

interface RawSet {
  setNumber: number;
  values: Record<string, string>;
  completed: boolean;
}

interface RawLoggedExercise {
  exerciseName: string;
  methodId?: string;
  plannedSets?: number;
  plannedParams?: Record<string, string>;
  sectionName?: string;
  sets?: RawSet[];
  isCircuit?: boolean;
}

interface RawSessionLog {
  id: string;
  date: string;
  session_name: string | null;
  sets_logged: RawLoggedExercise[];
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface LoggedSet {
  setNumber: number;
  values: Record<string, string>;
  completed: boolean;
}

export interface ExerciseSession {
  logId: string;
  date: string;           // yyyy-MM-dd
  sessionName: string;
  sets: LoggedSet[];
  plannedParams?: Record<string, string>;
  e1rm: number | null;    // best Epley estimate for this session (null if not tagged)
}

export interface ExerciseEntry {
  name: string;
  sessionCount: number;
  lastDate: string;        // yyyy-MM-dd
  allParamNames: string[]; // union of all base param names seen across all sets
  allParamUnits: Record<string, string>; // base param name → unit string (if any)
}

// Param role tags — stored per exercise in Supabase
export interface ParamTags {
  weightParam: string;
  repsParam: string;
  rirParam?: string;      // optional
}

// ── Epley helper ──────────────────────────────────────────────────────────────

export function epley1RM(weight: number, reps: number, rir = 0): number {
  return weight * (1 + (reps + rir) / 30);
}

function bestE1RMForSession(sets: LoggedSet[], tags: ParamTags): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!s.completed) continue;
    const w = parseFloat(s.values[tags.weightParam] ?? '');
    const r = parseFloat(s.values[tags.repsParam] ?? '');
    if (isNaN(w) || isNaN(r) || r <= 0) continue;
    const rir = tags.rirParam ? parseFloat(s.values[tags.rirParam] ?? '0') : 0;
    const safeRir = isNaN(rir) ? 0 : rir;
    const est = epley1RM(w, r, safeRir);
    if (best === null || est > best) best = est;
  }
  return best;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// Legacy key prefix — used only for one-time migration
const LEGACY_LS_PREFIX = 'exercise_param_tags_';

export function useExerciseMetrics(connectionId: string | null) {
  const { user } = useAuth();
  const [rawLogs, setRawLogs] = useState<RawSessionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [paramTags, setParamTagsState] = useState<Record<string, ParamTags>>({});

  // ── Load param tags from Supabase (with localStorage migration) ────────────

  useEffect(() => {
    if (!user) return;
    supabase
      .from('exercise_param_tags')
      .select('exercise_name, weight_param, reps_param, rir_param')
      .eq('coach_user_id', user.id)
      .then(({ data }) => {
        const dbMap: Record<string, ParamTags> = {};
        for (const row of (data ?? [])) {
          dbMap[row.exercise_name as string] = {
            weightParam: row.weight_param as string,
            repsParam: row.reps_param as string,
            rirParam: (row.rir_param as string | null) ?? undefined,
          };
        }

        // One-time migration: if Supabase is empty but localStorage has tags, migrate them
        const lsKey = `${LEGACY_LS_PREFIX}${user.id}`;
        const lsRaw = localStorage.getItem(lsKey);
        if (lsRaw) {
          try {
            const lsTags = JSON.parse(lsRaw) as Record<string, ParamTags>;
            if (Object.keys(lsTags).length > 0 && Object.keys(dbMap).length === 0) {
              const rows = Object.entries(lsTags).map(([name, tags]) => ({
                coach_user_id: user.id,
                exercise_name: name,
                weight_param: tags.weightParam,
                reps_param: tags.repsParam,
                rir_param: tags.rirParam ?? null,
              }));
              supabase
                .from('exercise_param_tags')
                .upsert(rows, { onConflict: 'coach_user_id,exercise_name' })
                .then(() => { localStorage.removeItem(lsKey); });
              Object.assign(dbMap, lsTags);
            }
          } catch { /* ignore malformed data */ }
          // Clear LS in all cases — Supabase is now the source of truth
          localStorage.removeItem(lsKey);
        }

        setParamTagsState(dbMap);
      });
  }, [user]);

  // ── Save / delete param tags ───────────────────────────────────────────────

  const setParamTags = useCallback((exerciseName: string, tags: ParamTags | null) => {
    if (!user) return;
    // Optimistic state update
    setParamTagsState(prev => {
      const next = { ...prev };
      if (tags === null) { delete next[exerciseName]; }
      else { next[exerciseName] = tags; }
      return next;
    });
    // Persist to Supabase
    if (tags === null) {
      supabase
        .from('exercise_param_tags')
        .delete()
        .eq('coach_user_id', user.id)
        .eq('exercise_name', exerciseName)
        .then(() => {});
    } else {
      supabase
        .from('exercise_param_tags')
        .upsert({
          coach_user_id: user.id,
          exercise_name: exerciseName,
          weight_param: tags.weightParam,
          reps_param: tags.repsParam,
          rir_param: tags.rirParam ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'coach_user_id,exercise_name' })
        .then(() => {});
    }
  }, [user]);

  // ── Fetch session logs ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!connectionId) { setRawLogs([]); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('athlete_session_logs')
      .select('id, date, session_name, sets_logged')
      .eq('athlete_connection_id', connectionId)
      .not('completed_at', 'is', null)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setRawLogs((data ?? []) as RawSessionLog[]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [connectionId]);

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

  // ── Derived — history for a specific exercise ──────────────────────────────

  const getExerciseHistory = useCallback((exerciseName: string): ExerciseSession[] => {
    const tags = paramTags[exerciseName] ?? null;
    const sessions: ExerciseSession[] = [];

    // rawLogs is newest-first; reverse for chronological chart order
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
    loading,
    paramTags,
    setParamTags,
    getExerciseHistory,
  };
}
