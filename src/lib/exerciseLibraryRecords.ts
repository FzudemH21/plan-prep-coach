/**
 * The exercise library in `coach_records` (store "exercises"): one row per library (its columns,
 * name … and the order of its exercises), one per exercise, one per circuit, plus "_meta" (the order
 * of the libraries). Two people adding exercises at the same time can't overwrite each other, and a
 * save can't take the whole library with it.
 */
import { supabase } from '@/lib/supabase';
import { META_ID, joinList, splitList, type OrderEntry } from '@/lib/recordSplit';
import type { CustomLibrary, CustomLibraryData } from '@/contexts/CustomLibrariesContext';

export const EXERCISE_LIBRARY_VERSION = '3.0.0';

type Obj = Record<string, unknown>;

// Library ids become part of the keys of their exercises — encoded, so no id can reach into another's
const enc = encodeURIComponent;
const libKey = (id: string) => `lib:${enc(id)}`;
const exercisePrefix = (encId: string) => `ex:${encId}:`;
const circuitPrefix = (encId: string) => `ci:${encId}:`;

/** Old or partial data gets the required fields (never drops libraries) */
export function normalizeExerciseLibraries(raw: unknown): CustomLibraryData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CustomLibraryData>;
  return {
    ...r,
    libraries: Array.isArray(r.libraries) ? r.libraries : [],
    lastUpdated: r.lastUpdated ?? new Date().toISOString(),
    version: r.version ?? EXERCISE_LIBRARY_VERSION,
  };
}

export function splitExerciseLibraries(data: CustomLibraryData): Obj {
  const records: Obj = {};
  const libraryOrder: OrderEntry[] = [];
  const seen = new Set<string>();
  (data.libraries ?? []).forEach(lib => {
    const id = lib?.id;
    if (typeof id !== 'string' || !id || seen.has(id)) { libraryOrder.push({ inline: lib }); return; }
    seen.add(id);
    const { exercises, circuits, ...rest } = lib;
    const exerciseOrder = splitList(Array.isArray(exercises) ? exercises : [], exercisePrefix(enc(id)), records);
    const circuitOrder = Array.isArray(circuits) ? splitList(circuits, circuitPrefix(enc(id)), records) : undefined;
    records[libKey(id)] = { ...rest, exerciseOrder, ...(circuitOrder ? { circuitOrder } : {}) };
    libraryOrder.push(id);
  });
  const { libraries: _libraries, ...meta } = data;
  records[META_ID] = { ...meta, libraryOrder };
  return records;
}

export function joinExerciseLibraries(records: Obj): CustomLibraryData {
  const meta = (records[META_ID] && typeof records[META_ID] === 'object' ? records[META_ID] : {}) as Obj;
  const { libraryOrder, ...rest } = meta;
  const used = new Set<string>();
  const libraries: CustomLibrary[] = [];
  const addLibrary = (key: string) => {
    if (used.has(key) || !(key in records)) return;
    used.add(key);
    const { exerciseOrder, circuitOrder, ...lib } = records[key] as Obj;
    const encId = key.slice('lib:'.length);
    const exercises = joinList(exerciseOrder, exercisePrefix(encId), records, used);
    const circuits = joinList(circuitOrder, circuitPrefix(encId), records, used);
    libraries.push({
      ...lib,
      exercises,
      ...(circuitOrder !== undefined || circuits.length > 0 ? { circuits } : {}),
    } as unknown as CustomLibrary);
  };
  if (Array.isArray(libraryOrder)) {
    libraryOrder.forEach(entry => {
      if (typeof entry === 'string') addLibrary(libKey(entry));
      else if (entry && typeof entry === 'object' && 'inline' in entry) libraries.push((entry as { inline: CustomLibrary }).inline);
    });
  }
  Object.keys(records).filter(key => key.startsWith('lib:')).sort().forEach(addLibrary);
  return normalizeExerciseLibraries({ ...rest, libraries });
}

/**
 * A coach's exercise libraries, read directly (the athlete app and the schedule sync look up names,
 * videos and descriptions). From `coach_records`; before the coach's library has moved there (or
 * without the table), from the old one-row table. Null when it can't be read.
 */
export async function readCoachExerciseLibraries(coachUserId: string): Promise<CustomLibrary[] | null> {
  const rows: Array<{ id: string; data: unknown }> = [];
  let moved = true;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('coach_records')
      .select('id, data')
      .eq('coach_user_id', coachUserId).eq('store', 'exercises').is('deleted_at', null)
      .order('id').range(from, from + 999);
    if (error) { moved = false; break; }
    rows.push(...((data ?? []) as Array<{ id: string; data: unknown }>));
    if (!data || data.length < 1000) break;
  }
  if (moved && rows.some(r => r.id === META_ID)) {
    const records: Obj = {};
    rows.forEach(r => { records[r.id] = r.data; });
    return joinExerciseLibraries(records).libraries;
  }
  const { data: row, error } = await supabase.from('custom_libraries')
    .select('data').eq('user_id', coachUserId).maybeSingle();
  if (error) return null;
  return row?.data ? normalizeExerciseLibraries(row.data).libraries : [];
}
