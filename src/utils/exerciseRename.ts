/**
 * exerciseRename
 *
 * Programs, selections, placed exercises, templates, the session library and athlete schedules all
 * keep their own copy of an exercise's name next to its library id. When an exercise is renamed in
 * a library, propagateExerciseRename() updates the name in every one of those copies — whether or
 * not the program is assigned to an athlete — and changes nothing else.
 */
import { supabase } from '@/lib/supabase';
import { updateSupabaseStoreData } from '@/hooks/useSupabaseStore';

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
 * Propagate a library exercise rename everywhere its name is copied. Circuits inside the exercise
 * libraries are updated by the library save itself (same store). Fire-and-forget; failures are
 * logged and never block the library save.
 */
export async function propagateExerciseRename(exerciseId: string, newName: string): Promise<void> {
  // 1. The open wizard session (browser storage) and pages holding it in memory
  try { renameInLocalStorage(exerciseId, newName); } catch (err) { console.warn('[exerciseRename] local:', err); }
  window.dispatchEvent(new CustomEvent<ExerciseRenamedDetail>(EXERCISE_RENAMED_EVENT, { detail: { exerciseId, newName } }));

  // 2. Saved programs and programming templates (all of them, assigned or not)
  const rename = <T,>(current: T) => renameExerciseInValue(current, exerciseId, newName);
  await Promise.all([
    updateSupabaseStoreData('training_programs', 'trainingPrograms', rename).catch(err => console.warn('[exerciseRename] programs:', err)),
    updateSupabaseStoreData('programming_templates', 'programTemplates', rename).catch(err => console.warn('[exerciseRename] templates:', err)),
  ]);

  // 3. Athlete schedules of assigned programs
  await renameInAthleteSchedules(exerciseId, newName).catch(err => console.warn('[exerciseRename] schedules:', err));
}
