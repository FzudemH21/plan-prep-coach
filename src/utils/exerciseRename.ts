/**
 * exerciseRename
 *
 * Programs, selections, placed exercises, templates, the session library, the athlete calendar's
 * assigned plans and athlete schedules all
 * keep their own copy of an exercise's name next to its library id. When an exercise is renamed in
 * a library, propagateExerciseRename() updates the name in every one of those copies — whether or
 * not the program is assigned to an athlete — and changes nothing else.
 */
import { supabase } from '@/lib/supabase';
import { updateRecordStore } from '@/lib/recordStore';
import { templatesStore } from '@/hooks/useTemplates';
import { sessionLibraryStore } from '@/hooks/useSessionLibrary';
import { updateAllPrograms } from '@/lib/programStore';

/** Browser event fired after a rename so open pages can update what they hold in memory. */
export const EXERCISE_RENAMED_EVENT = 'ppc:exercise-renamed';
export interface ExerciseRenamedDetail { exerciseId: string; newName: string }

/** Subscribe to renames (use in an effect); returns the unsubscribe function. */
export function onExerciseRenamed(handler: (detail: ExerciseRenamedDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ExerciseRenamedDetail>).detail);
  window.addEventListener(EXERCISE_RENAMED_EVENT, listener);
  return () => window.removeEventListener(EXERCISE_RENAMED_EVENT, listener);
}

/**
 * Returns `value` with the exercise's name replaced wherever an object refers to it:
 *   • { exerciseId: id, exerciseName }        → exerciseName   (selections, placements, circuits)
 *   • { exerciseId: id, name } (no exerciseName) → name
 *   • { exerciseLibraryId: id, name }          → name           (athlete schedule summaries)
 * JSON stored as a string (e.g. a program's extraSessionState) is parsed, updated and re-serialised.
 * Unchanged branches keep their identity; if nothing matched, the very same value is returned.
 */
export function renameExerciseInValue<T>(value: T, exerciseId: string, newName: string): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const t = v.trim();
      if ((t.startsWith('{') || t.startsWith('[')) && v.includes(exerciseId)) {
        try {
          const parsed = JSON.parse(v);
          const updated = walk(parsed);
          return updated === parsed ? v : JSON.stringify(updated);
        } catch { return v; }
      }
      return v;
    }
    if (Array.isArray(v)) {
      let changed = false;
      const out = v.map(item => { const u = walk(item); if (u !== item) changed = true; return u; });
      return changed ? out : v;
    }
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      let changed = false;
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(obj)) {
        const u = walk(child);
        if (u !== child) changed = true;
        out[key] = u;
      }
      if (obj.exerciseId === exerciseId) {
        if ('exerciseName' in obj && obj.exerciseName !== newName) { out.exerciseName = newName; changed = true; }
        else if (!('exerciseName' in obj) && 'name' in obj && obj.name !== newName) { out.name = newName; changed = true; }
      }
      if (obj.exerciseLibraryId === exerciseId && 'name' in obj && obj.name !== newName) { out.name = newName; changed = true; }
      return changed ? out : v;
    }
    return v;
  };
  return walk(value) as T;
}

// Wizard session + session library data kept in the browser (the open program's working copy).
const LOCAL_KEYS = ['exerciseDistribution', 'exerciseSelectionData', 'microcyclePlanningState', 'ppc-session-library'];
const LOCAL_PREFIXES = ['workoutSections_', 'workoutSessions_'];

function renameInLocalStorage(exerciseId: string, newName: string): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (LOCAL_KEYS.includes(key) || LOCAL_PREFIXES.some(p => key.startsWith(p)))) keys.push(key);
  }
  keys.forEach(key => {
    const raw = localStorage.getItem(key);
    if (!raw || !raw.includes(exerciseId)) return;
    const updated = renameExerciseInValue(raw, exerciseId, newName);
    if (updated !== raw) localStorage.setItem(key, updated);
  });
}

async function renameInAthleteSchedules(exerciseId: string, newName: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;
  const { data: connections } = await supabase
    .from('athlete_connections').select('id').eq('coach_user_id', authData.user.id);
  if (!connections?.length) return;

  const { data: rows } = await supabase
    .from('athlete_schedule')
    .select('athlete_connection_id, date, sessions')
    .in('athlete_connection_id', connections.map(c => c.id as string));
  if (!rows?.length) return;

  const toUpdate = rows
    .map(row => ({ row, sessions: renameExerciseInValue(row.sessions, exerciseId, newName) }))
    .filter(({ row, sessions }) => sessions !== row.sessions)
    .map(({ row, sessions }) => ({ ...row, sessions }));

  for (let i = 0; i < toUpdate.length; i += 200) {
    const { error } = await supabase
      .from('athlete_schedule')
      .upsert(toUpdate.slice(i, i + 200), { onConflict: 'athlete_connection_id,date' });
    if (error) console.warn('[exerciseRename] schedule upsert error:', error.message);
  }
}

/**
 * The coach-side plans of assigned programs (athlete calendar — `athlete-assignment-<id>` in this
 * browser and `athlete_assignment_plans` in Supabase). Each plan is renamed in its newer copy (an
 * unsynced edit on either side is kept) and written to both, with a new lastModified.
 */
async function renameInAssignmentPlans(exerciseId: string, newName: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return;
  const PREFIX = 'athlete-assignment-';
  type Plan = Record<string, unknown> & { lastModified?: string; copiedAt?: string };
  const stampOf = (p: Plan | undefined) => (p?.lastModified ?? p?.copiedAt ?? '') as string;
  const readLocal = (id: string): Plan | undefined => {
    try { const raw = localStorage.getItem(PREFIX + id); return raw ? JSON.parse(raw) as Plan : undefined; } catch { return undefined; }
  };

  const ids = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX) && key.length > PREFIX.length) ids.add(key.slice(PREFIX.length));
  }
  const { data: rows, error } = await supabase
    .from('athlete_assignment_plans').select('assignment_id, data').eq('coach_user_id', uid);
  const remoteAvailable = !error;
  const remote = new Map<string, Plan>();
  for (const row of (rows ?? []) as Array<{ assignment_id: string; data: Plan }>) {
    remote.set(row.assignment_id, row.data);
    ids.add(row.assignment_id);
  }

  for (const id of ids) {
    const local = readLocal(id);
    const server = remote.get(id);
    const newest = !local ? server : !server ? local : (stampOf(server) > stampOf(local) ? server : local);
    if (!newest) continue;
    const renamed = renameExerciseInValue(newest, exerciseId, newName);
    if (renamed === newest) continue;
    const next = { ...renamed, lastModified: new Date().toISOString() };
    try { localStorage.setItem(PREFIX + id, JSON.stringify(next)); } catch (err) { console.warn('[exerciseRename] assignment local:', err); }
    if (remoteAvailable) {
      const { error: upErr } = await supabase.from('athlete_assignment_plans').upsert(
        { assignment_id: id, coach_user_id: uid, data: next, updated_at: new Date().toISOString() },
        { onConflict: 'assignment_id' },
      );
      if (upErr) console.warn('[exerciseRename] assignment upsert error:', upErr.message);
    }
  }
}

/**
 * Propagate a library exercise rename everywhere its name is copied. Circuits inside the exercise
 * libraries are updated by the library save itself (same store). Fire-and-forget; failures are
 * logged and never block the library save.
 */
export async function propagateExerciseRename(exerciseId: string, newName: string): Promise<void> {
  // 1. The open wizard session (browser storage) and pages holding it in memory
  try { renameInLocalStorage(exerciseId, newName); } catch (err) { console.warn('[exerciseRename] local:', err); }
  window.dispatchEvent(new CustomEvent<ExerciseRenamedDetail>(EXERCISE_RENAMED_EVENT, { detail: { exerciseId, newName } }));

  // 2. Saved programs, programming templates (all of them, assigned or not) and the session library
  const rename = <T,>(current: T) => renameExerciseInValue(current, exerciseId, newName);
  await Promise.all([
    updateAllPrograms(program => rename(program)).catch(err => console.warn('[exerciseRename] programs:', err)),
    updateRecordStore(templatesStore, rename).catch(err => console.warn('[exerciseRename] templates:', err)),
    updateRecordStore(sessionLibraryStore, rename).catch(err => console.warn('[exerciseRename] session library:', err)),
  ]);

  // 3. Assigned programs: the athlete calendar's plans (coach side) and the athlete app's schedules
  await renameInAssignmentPlans(exerciseId, newName).catch(err => console.warn('[exerciseRename] assignment plans:', err));
  await renameInAthleteSchedules(exerciseId, newName).catch(err => console.warn('[exerciseRename] schedules:', err));
}
