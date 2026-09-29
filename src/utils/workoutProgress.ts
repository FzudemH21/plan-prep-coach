/**
 * workoutProgress — pause / resume for workouts logged in the athlete app and the coach mobile app.
 *
 * A started workout's progress (logged values, ticked sets, set count changes, swaps, current section,
 * elapsed time) is kept on its athlete_session_logs row (`progress`, `paused_at`), so it survives
 * leaving the page or closing the app and can be resumed on any device. A copy is kept in
 * localStorage as a fallback for when the columns don't exist yet (migration not run) or the
 * network write fails.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface WorkoutSwapRecord {
  replacementName: string;
  originalName: string;
  direction: 'progression' | 'regression';
  level: number;
  reason: string;
}

export interface WorkoutProgress {
  v: 1;
  /** Section the workout was in */
  sectionIdx: number;
  /** 'sectionIntro' = the section hadn't been started yet */
  phase: 'sectionIntro' | 'active';
  /** Workout time so far (the clock stops while paused) */
  elapsedSeconds: number;
  loggedValues: Record<string, Record<number, Record<string, string>>>;
  completedSets: Record<string, number[]>;
  setCountOverrides: Record<string, number>;
  swappedExercises: Record<string, WorkoutSwapRecord>;
}

export interface UnfinishedWorkout {
  logId: string;
  startedAt: string;
  /** Set when the workout was paused explicitly (null = the app was closed mid-workout) */
  pausedAt: string | null;
  progress: WorkoutProgress | null;
}

const localKey = (logId: string) => `ppc-workout-progress:${logId}`;

function readLocal(logId: string): { progress: WorkoutProgress; pausedAt: string | null } | null {
  try {
    const raw = localStorage.getItem(localKey(logId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { progress?: WorkoutProgress; pausedAt?: string | null };
    return parsed.progress?.v === 1 ? { progress: parsed.progress, pausedAt: parsed.pausedAt ?? null } : null;
  } catch {
    return null;
  }
}

function writeLocal(logId: string, progress: WorkoutProgress, pausedAt: string | null) {
  try { localStorage.setItem(localKey(logId), JSON.stringify({ progress, pausedAt })); } catch { /* ignore */ }
}

/** Number of ticked sets / rounds in a saved workout */
export function countDoneSets(progress: WorkoutProgress | null): number {
  if (!progress) return 0;
  return Object.values(progress.completedSets).reduce((n, arr) => n + arr.length, 0);
}

/**
 * The newest started-but-unfinished log of this session instance that `role` started — the
 * workout to resume. Returns null when there is none.
 */
export async function findUnfinishedWorkout(
  connectionId: string,
  date: string,
  sessionId: string,
  role: 'coach' | 'athlete',
): Promise<UnfinishedWorkout | null> {
  type Row = { id: string; started_at: string | null; started_by: string | null; paused_at?: string | null; progress?: WorkoutProgress | null };
  const query = (columns: string) => supabase
    .from('athlete_session_logs')
    .select(columns)
    .eq('athlete_connection_id', connectionId)
    .eq('date', date)
    .eq('session_id', sessionId)
    .is('completed_at', null)
    .not('started_at', 'is', null)
    .order('started_at', { ascending: false });

  let rows: Row[] | null = null;
  const full = await query('id, started_at, started_by, paused_at, progress');
  if (full.error) {
    // progress / paused_at columns not there yet — the local copy still allows resuming on this device
    const basic = await query('id, started_at, started_by');
    rows = (basic.data as unknown as Row[] | null) ?? null;
  } else {
    rows = (full.data as unknown as Row[] | null) ?? null;
  }
  // Rows without started_by predate the field — treat them as the caller's own
  const row = (rows ?? []).find(r => !r.started_by || r.started_by === role);
  if (!row?.started_at) return null;

  const local = readLocal(row.id);
  const remote = row.progress?.v === 1 ? row.progress : null;
  // The copy with more ticked sets wins (the remote write may have failed while offline)
  const progress = remote && (!local || countDoneSets(remote) >= countDoneSets(local.progress))
    ? remote
    : local?.progress ?? null;
  return {
    logId: row.id,
    startedAt: row.started_at,
    pausedAt: row.paused_at ?? local?.pausedAt ?? null,
    progress,
  };
}

/** Save a running (paused = false) or paused workout's progress on its log row + locally */
export async function saveWorkoutProgress(logId: string, progress: WorkoutProgress, paused: boolean): Promise<void> {
  const pausedAt = paused ? new Date().toISOString() : null;
  writeLocal(logId, progress, pausedAt);
  const { error } = await supabase
    .from('athlete_session_logs')
    .update({ progress, paused_at: pausedAt })
    .eq('id', logId);
  if (error) console.warn('[workoutProgress] progress saved on this device only:', error.message);
}

/** Drop a finished / abandoned workout's saved progress */
export async function clearWorkoutProgress(logId: string, alsoRemote: boolean): Promise<void> {
  try { localStorage.removeItem(localKey(logId)); } catch { /* ignore */ }
  if (!alsoRemote) return;
  const { error } = await supabase
    .from('athlete_session_logs')
    .update({ progress: null, paused_at: null })
    .eq('id', logId);
  if (error) console.warn('[workoutProgress] could not clear saved progress:', error.message);
}

/**
 * Keeps a running workout's progress saved: shortly after every change, and right away when the
 * app goes to the background (phone locked, app switched) — so closing the app mid-workout
 * doesn't lose it. `progress` is null while there's nothing to save (not started / paused / done).
 */
export function useWorkoutAutosave(logId: string | null, progress: WorkoutProgress | null) {
  const latest = useRef<{ logId: string | null; progress: WorkoutProgress | null }>({ logId, progress });
  latest.current = { logId, progress };
  // Elapsed time changes every second — leave it out of the change detection
  const key = progress ? JSON.stringify({ ...progress, elapsedSeconds: 0 }) : null;

  useEffect(() => {
    if (!logId || !key) return;
    const timer = setTimeout(() => {
      const { logId: id, progress: p } = latest.current;
      if (id && p) void saveWorkoutProgress(id, p, false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [logId, key]);

  useEffect(() => {
    const flush = () => {
      const { logId: id, progress: p } = latest.current;
      if (id && p) void saveWorkoutProgress(id, p, false);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      // Leaving the page (e.g. the phone's back gesture) — save what the pending autosave would have
      flush();
    };
  }, []);
}
