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
 *
 * Several coaches of one athlete (2026-11-23):
 *   - a save only replaces the stored plan if nobody else saved it since it was loaded here (the
 *     row's updated_at is compared). Otherwise nothing is overwritten: the newer version is loaded
 *     and the calendar says so (onAssignmentPlansChanged with conflict: true);
 *   - refreshAssignmentPlans() (live refresh: once a minute and when the app comes to the front)
 *     loads the plans another coach changed — never one with a save of this tab still pending.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useDataScope } from '@/hooks/useDataScope';

const PREFIX = 'athlete-assignment-';
const TABLE = 'athlete_assignment_plans';
const UPLOAD_DELAY_MS = 800;

let userId: string | null = null;
let loadPromise: Promise<void> | null = null;
let loadedFor: string | null = null;
let tableMissing = false;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** The stored row's updated_at as last loaded / saved here — a save replaces only that version */
const seenAt = new Map<string, string>();
/** Saves on their way to Supabase (result false: someone else had saved first) */
const inFlight = new Map<string, Promise<boolean>>();

export interface AssignmentPlansChange {
  /** Plans whose stored version was just loaded into this browser */
  ids: string[];
  /** A save of this tab was refused: another coach had saved the plan first */
  conflict: boolean;
}
const changeListeners = new Set<(change: AssignmentPlansChange) => void>();
/** Plans changed by another coach (or a refused save) — the calendar reloads them */
export function onAssignmentPlansChanged(fn: (change: AssignmentPlansChange) => void): () => void {
  changeListeners.add(fn);
  return () => { changeListeners.delete(fn); };
}
function emitChange(change: AssignmentPlansChange) {
  if (change.ids.length > 0) changeListeners.forEach(fn => fn(change));
}

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

/** Takes over the stored version of a plan (another coach's): localStorage + the version seen */
async function loadStored(id: string): Promise<boolean> {
  const { data, error } = await supabase.from(TABLE).select('data, updated_at').eq('assignment_id', id).maybeSingle();
  if (error || !data) return false;
  const row = data as { data: PlanData; updated_at: string };
  try { localStorage.setItem(PREFIX + id, JSON.stringify(row.data)); } catch { return false; }
  seenAt.set(id, row.updated_at);
  return true;
}

/** Sends this browser's copy. false: another coach saved the plan first — theirs is loaded instead */
async function send(id: string): Promise<boolean> {
  if (!userId || tableMissing) return true;
  // The stored versions must be known first (a save right after opening waits for them)
  if (loadPromise) await loadPromise;
  const data = readLocal(id);
  if (!data) return true;
  const now = new Date().toISOString();
  const seen = seenAt.get(id);
  if (seen) {
    // Only over the version this tab started from
    const { data: rows, error } = await supabase.from(TABLE)
      .update({ data, updated_at: now })
      .eq('assignment_id', id)
      .eq('updated_at', seen)
      .select('updated_at');
    if (error) { noteError(error.message); return true; }
    const row = (rows as Array<{ updated_at: string }> | null)?.[0];
    if (row) { seenAt.set(id, row.updated_at); return true; }
    // Nothing replaced: someone else saved the plan meanwhile (or it was deleted — then it stays so)
    if (await loadStored(id)) { emitChange({ ids: [id], conflict: true }); return false; }
    return true;
  }
  // Not stored yet: a new row — never over one another coach just created
  const { data: rows, error } = await supabase.from(TABLE)
    .insert({ assignment_id: id, coach_user_id: userId, data, updated_at: now })
    .select('updated_at');
  if (!error) {
    const row = (rows as Array<{ updated_at: string }> | null)?.[0];
    if (row) seenAt.set(id, row.updated_at);
    return true;
  }
  if (error.code === '23505' || /duplicate key/i.test(error.message)) {
    if (await loadStored(id)) { emitChange({ ids: [id], conflict: true }); return false; }
    return true;
  }
  noteError(error.message);
  return true;
}

function upload(id: string): Promise<boolean> {
  timers.delete(id);
  // One save of a plan at a time, in order
  const before = inFlight.get(id) ?? Promise.resolve(true);
  const run = before.then(() => send(id), () => send(id));
  inFlight.set(id, run);
  void run.finally(() => { if (inFlight.get(id) === run) inFlight.delete(id); });
  return run;
}

function queueUpload(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.set(id, setTimeout(() => { void upload(id); }, UPLOAD_DELAY_MS));
}

/** A save of the plan is waiting or on its way */
export function hasPendingAssignmentPlanSave(assignmentId: string): boolean {
  return timers.has(assignmentId) || inFlight.has(assignmentId);
}

/**
 * Sends a waiting save now and waits for it. false: another coach had saved the plan first — it
 * was not overwritten (their version is loaded), so what was built on this tab's copy must not be
 * passed on either (e.g. to the athlete app).
 */
export async function flushAssignmentPlan(assignmentId: string): Promise<boolean> {
  const t = timers.get(assignmentId);
  if (t) {
    clearTimeout(t);
    return upload(assignmentId);
  }
  return inFlight.get(assignmentId) ?? true;
}

/** A plan saved outside this store (e.g. an exercise rename): that version is the one seen here */
export function noteAssignmentPlanSaved(assignmentId: string, updatedAt: string): void {
  seenAt.set(assignmentId, updatedAt);
}

let refreshing: Promise<void> | null = null;
/**
 * The plans another coach changed since they were loaded here → into this browser (not one with a
 * save of this tab pending — that save finds out itself). Cheap: compares change times first.
 */
export function refreshAssignmentPlans(): Promise<void> {
  if (!userId || tableMissing || !loadPromise) return Promise.resolve();
  if (refreshing) return refreshing;
  const uid = userId;
  const loaded = loadPromise;
  refreshing = (async () => {
    try {
      await loaded;
      const { data, error } = await supabase.from(TABLE).select('assignment_id, updated_at').eq('coach_user_id', uid);
      if (error || !data) return;
      const changed = (data as Array<{ assignment_id: string; updated_at: string }>)
        .filter(r => r.updated_at !== seenAt.get(r.assignment_id) && !hasPendingAssignmentPlanSave(r.assignment_id))
        .map(r => r.assignment_id);
      if (changed.length === 0) return;
      const { data: rows, error: rowsError } = await supabase.from(TABLE)
        .select('assignment_id, data, updated_at').in('assignment_id', changed);
      if (rowsError || !rows) return;
      const ids: string[] = [];
      for (const row of rows as Array<{ assignment_id: string; data: PlanData; updated_at: string }>) {
        // A save started meanwhile: it decides
        if (hasPendingAssignmentPlanSave(row.assignment_id)) continue;
        try { localStorage.setItem(PREFIX + row.assignment_id, JSON.stringify(row.data)); } catch { continue; }
        seenAt.set(row.assignment_id, row.updated_at);
        ids.push(row.assignment_id);
      }
      emitChange({ ids, conflict: false });
    } catch (e) {
      console.warn('[assignmentPlans] refresh failed', e);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
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
  seenAt.delete(assignmentId);
  if (!userId || tableMissing) return;
  void supabase.from(TABLE).delete().eq('assignment_id', assignmentId)
    .then(({ error }) => { if (error) noteError(error.message); });
}

/** Once per signed-in coach: bring localStorage and Supabase in step (newer copy wins) */
export function ensureAssignmentPlansLoaded(uid: string): Promise<void> {
  if (loadPromise && loadedFor === uid) return loadPromise;
  userId = uid;
  loadedFor = uid;
  seenAt.clear();
  loadPromise = (async () => {
    try {
      const { data, error } = await supabase.from(TABLE).select('assignment_id, data, updated_at').eq('coach_user_id', uid);
      if (error) { noteError(error.message); return; }
      const remoteIds = new Set<string>();
      for (const row of (data ?? []) as Array<{ assignment_id: string; data: PlanData; updated_at: string }>) {
        remoteIds.add(row.assignment_id);
        seenAt.set(row.assignment_id, row.updated_at);
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

/** True once the plans are in step for the signed-in coach (the calendar waits for it) — each
 *  calendar opened also takes over what other coaches changed since (one small request) */
export function useAssignmentPlansReady(): boolean {
  const { loading } = useAuth();
  // The account holding the athletes' plans (the organization's for members, lib/dataScope)
  const { dataId: uid } = useDataScope('athletes');
  const [readyFor, setReadyFor] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    // A hanging request (bad connection) must not keep the calendar loading forever — after 8 s
    // it opens with this browser's copy
    void Promise.race([
      ensureAssignmentPlansLoaded(uid).then(() => refreshAssignmentPlans()),
      new Promise<void>(resolve => setTimeout(resolve, 8000)),
    ]).then(() => { if (!cancelled) setReadyFor(uid); });
    return () => { cancelled = true; };
  }, [uid]);
  // Not signed in (no sync possible): don't block the calendar
  if (!uid) return !loading;
  return readyFor === uid;
}
