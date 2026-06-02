// Coach-side hook — parses athlete_session_logs into per-exercise history
// and manages 1RM param tags in localStorage.

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
  lastDate: string;       // yyyy-MM-dd
  allParamNames: string[]; // union of all param names seen across all sets
}

// Param role tags — stored per exercise in localStorage
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

const TAGS_KEY_PREFIX = 'exercise_param_tags_';

export function useExerciseMetrics(connectionId: string | null) {
  const { user } = useAuth();
  const [rawLogs, setRawLogs] = useState<RawSessionLog[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Param tags (localStorage) ──────────────────────────────────────────────

  const tagsKey = user ? `${TAGS_KEY_PREFIX}${user.id}` : null;

  const [paramTags, setParamTagsState] = useState<Record<string, ParamTags>>(() => {
    if (!user) return {};
    try {
      const raw = localStorage.getItem(`${TAGS_KEY_PREFIX}${user.id}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const setParamTags = useCallback((exerciseName: string, tags: ParamTags | null) => {
    setParamTagsState(prev => {
      const next = { ...prev };
      if (tags === null) {
        delete next[exerciseName];
      } else {
        next[exerciseName] = tags;
      }
      if (tagsKey) localStorage.setItem(tagsKey, JSON.stringify(next));
      return next;
    });
  }, [tagsKey]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!connectionId) { setRawLogs([]); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('athlete_session_logs')
      .select('id, date, session_name, sets_logged')
      .eq('athlete_connection_id', connectionId)
      .not('completed_at', 'is', null)   // completed sessions only
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setRawLogs((data ?? []) as RawSessionLog[]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [connectionId]);

  // ── Derived — exercise list ────────────────────────────────────────────────

  const exercises = useMemo<ExerciseEntry[]>(() => {
    const map = new Map<string, { dates: string[]; paramNames: Set<string> }>();
    for (const log of rawLogs) {
      for (const ex of log.sets_logged ?? []) {
        if (ex.isCircuit || !ex.exerciseName) continue;
        if (!ex.sets?.length) continue;
        const entry = map.get(ex.exerciseName) ?? { dates: [], paramNames: new Set() };
        entry.dates.push(log.date);
        // Helper: strip storage suffixes to get the base column-header name.
        // Keys like "Weight_set1", "Weight_unit", "Weight_set1_unit" are internal
        // storage artefacts — the real param name is "Weight".
        const baseKey = (k: string) => k.replace(/_set\d+/g, '').replace(/_unit$/, '');
        const isMetaKey = (k: string) => k.endsWith('_unit') || /_set\d+/.test(k);

        for (const set of ex.sets) {
          for (const k of Object.keys(set.values ?? {})) {
            if (!isMetaKey(k)) entry.paramNames.add(k);
          }
        }
        if (ex.plannedParams) {
          for (const k of Object.keys(ex.plannedParams)) {
            const base = baseKey(k);
            if (base) entry.paramNames.add(base);
          }
        }
        map.set(ex.exerciseName, entry);
      }
    }
    return Array.from(map.entries())
      .map(([name, { dates, paramNames }]) => ({
        name,
        sessionCount: dates.length,
        lastDate: dates.sort().reverse()[0],
        allParamNames: Array.from(paramNames).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawLogs]);

  // ── Derived — history for a specific exercise ──────────────────────────────

  const getExerciseHistory = useCallback((exerciseName: string): ExerciseSession[] => {
    const tags = paramTags[exerciseName] ?? null;
    const sessions: ExerciseSession[] = [];

    // rawLogs is newest-first; we want chronological for chart so we'll reverse
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
