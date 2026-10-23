/**
 * assignmentPlanStore — the coach-side plan of an athlete's program assignment (sessions per day,
 * exercises, parameter values, intensities) in Supabase (`athlete_assignment_plans`).
 *
 * Before, it lived ONLY in the localStorage of the browser where the program was assigned or
 * edited ("athlete-assignment-<id>"): another browser / device showed a different calendar, and
 * its syncs wrote a different copy to the athlete app. localStorage stays as the working cache
 * (the calendar reads it synchronously); this module keeps it in step with Supabase:
 *   - persistAssignmentPlan(): every write goes to localStorage AND (debounced) to Supabase
 *   - removeAssignmentPlan(): deletes both
 *   - ensureAssignmentPlansLoaded(): once per session — the newer copy wins (data.lastModified);
 *     plans so far only in this browser are uploaded (migration). The calendar waits for it
 *     (useAssignmentPlansReady) so it never starts from a stale or missing local copy.
 * Without the migration (table missing) everything keeps working on localStorage alone.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const PREFIX = 'athlete-assignment-';
const TABLE = 'athlete_assignment_plans';
const UPLOAD_DELAY_MS = 800;

let userId: string | null = null;
let loadPromise: Promise<void> | null = null;
let loadedFor: string | null = null;
let tableMissing = false;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const idOf = (key: string): string | null => {
  if (!key.startsWith(PREFIX)) return null;
  const id = key.slice(PREFIX.length);
  return id && id !== 'undefined' && id !== 'null' ? id : null;
};

type PlanData = Record<string, unknown> & { lastModified?: string; copiedAt?: string };
const stampOf = (d: PlanData | null | undefined): string => (d?.lastModified ?? d?.copiedAt ?? '') as string;

function readLocal(id: string): PlanData | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as PlanData) : null;
  } catch {
    return null;
  }
}

function noteError(message: string) {
  if (/athlete_assignment_plans|does not exist|schema cache/i.test(message)) {
    if (!tableMissing) {
      console.warn('[assignmentPlans] table missing — run the migration 20261023_athlete_assignment_plans.sql; plans stay in this browser only until then');
    }
    tableMissing = true;
  } else {
    console.error('[assignmentPlans]', message);
  }
}

async function upload(id: string): Promise<void> {
  timers.delete(id);
  if (!userId || tableMissing) return;
  const data = readLocal(id);
  if (!data) return;
  const { error } = await supabase.from(TABLE).upsert(
    { assignment_id: id, coach_user_id: userId, data, updated_at: new Date().toISOString() },
    { onConflict: 'assignment_id' },
  );
  if (error) noteError(error.message);
}

function queueUpload(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.set(id, setTimeout(() => { void upload(id); }, UPLOAD_DELAY_MS));
}

/** Save a plan: localStorage now (the calendar reads it), Supabase right after */
export function persistAssignmentPlan(key: string, json: string): void {
  localStorage.setItem(key, json);
  const id = idOf(key);
  if (id) queueUpload(id);
}

/** Delete a plan everywhere */
export function removeAssignmentPlan(assignmentId: string): void {
  localStorage.removeItem(PREFIX + assignmentId);
  const t = timers.get(assignmentId);
  if (t) { clearTimeout(t); timers.delete(assignmentId); }
  if (!userId || tableMissing) return;
  void supabase.from(TABLE).delete().eq('assignment_id', assignmentId)
    .then(({ error }) => { if (error) noteError(error.message); });
}

/** Once per signed-in coach: bring localStorage and Supabase in step (newer copy wins) */
export function ensureAssignmentPlansLoaded(uid: string): Promise<void> {
  if (loadPromise && loadedFor === uid) return loadPromise;
  userId = uid;
  loadedFor = uid;
  loadPromise = (async () => {
    try {
      const { data, error } = await supabase.from(TABLE).select('assignment_id, data').eq('coach_user_id', uid);
      if (error) { noteError(error.message); return; }
      const remoteIds = new Set<string>();
      for (const row of (data ?? []) as Array<{ assignment_id: string; data: PlanData }>) {
        remoteIds.add(row.assignment_id);
        const local = readLocal(row.assignment_id);
        const remoteStamp = stampOf(row.data);
        const localStamp = stampOf(local);
        if (!local || remoteStamp > localStamp) {
          localStorage.setItem(PREFIX + row.assignment_id, JSON.stringify(row.data));
        } else if (localStamp > remoteStamp) {
          queueUpload(row.assignment_id); // edited here, not uploaded yet
        }
      }
      // Plans so far only in this browser (from before this store existed) → upload
      for (let i = 0; i < localStorage.length; i++) {
        const id = idOf(localStorage.key(i) ?? '');
        if (id && !remoteIds.has(id)) queueUpload(id);
      }
    } catch (e) {
      console.error('[assignmentPlans] load failed — working from the copy in this browser', e);
    }
  })();
  return loadPromise;
}

/** True once the plans are in step for the signed-in coach (the calendar waits for it) */
export function useAssignmentPlansReady(): boolean {
  const { user, loading } = useAuth();
  const uid = user?.id ?? null;
  const [readyFor, setReadyFor] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    // A hanging request (bad connection) must not keep the calendar loading forever — after 8 s
    // it opens with this browser's copy
    void Promise.race([
      ensureAssignmentPlansLoaded(uid),
      new Promise<void>(resolve => setTimeout(resolve, 8000)),
    ]).then(() => { if (!cancelled) setReadyFor(uid); });
    return () => { cancelled = true; };
  }, [uid]);
  // Not signed in (no sync possible): don't block the calendar
  if (!uid) return !loading;
  return readyFor === uid;
}
