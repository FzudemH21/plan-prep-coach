/**
 * useSessionLibrary — the coach's reusable sessions (Session Library page, "Add from session
 * library" in the athlete calendar and the coach mobile app, "Save to library").
 *
 * Stored in Supabase, one row per session (coach_records, store "workouts", since 2026-11-13; before
 * one row per coach in `session_library`, kept as a frozen backup), so every device sees the same
 * library. It used to live only in the browser (localStorage 'ppc-session-library'): a library still
 * left in a browser is merged in (entries and columns by id) and removed from that browser once
 * every session of it is confirmed stored.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createRecordStore, useRecordStore } from '@/lib/recordStore';
import { joinFields, splitFields } from '@/lib/recordSplit';
import type {
  SessionLibraryData,
  SessionLibraryEntry,
  SessionLibraryColumn,
} from '@/types/sessionLibrary';

const LEGACY_KEY = 'ppc-session-library';

const DEFAULT_DATA: SessionLibraryData = { version: '1', columns: [], entries: [] };

/** Migration guard: older or partial data gets the required fields */
function normalize(raw: unknown): SessionLibraryData {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<SessionLibraryData>;
  return {
    version: '1',
    columns: Array.isArray(parsed.columns) ? parsed.columns : [],
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
  };
}

function readLegacy(): SessionLibraryData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

const WORKOUT_LISTS = { entries: 'w:' };

/** One row per session (coach_records, store "workouts"); session_library stays as a frozen backup */
export const sessionLibraryStore = createRecordStore<SessionLibraryData>({
  table: 'coach_records',
  store: 'workouts',
  legacyTable: 'session_library',
  label: 'session library',
  defaultValue: () => DEFAULT_DATA,
  migrate: normalize,
  split: data => splitFields(data, WORKOUT_LISTS),
  join: records => normalize(joinFields(records, WORKOUT_LISTS, DEFAULT_DATA)),
  guardedPrefix: id => id.startsWith('w:'),
  refuseEmptying: true,
  cacheKey: 'coach_records_workouts_sb_cache',
  oldCacheKeys: [`${LEGACY_KEY}_sb_cache`],
});

/** Only one instance merges a leftover browser library per page load */
let legacyMergeDone = false;

export function useSessionLibrary() {
  const { user } = useAuth();
  const [stored, save, isLoading] = useRecordStore(sessionLibraryStore);
  const data = normalize(stored);

  // Latest data for back-to-back changes (two updates before the next render build on each other)
  const latest = useRef<SessionLibraryData>(data);
  const seen = useRef<SessionLibraryData>(stored);
  if (stored !== seen.current) {
    seen.current = stored;
    latest.current = data;
  }

  const update = useCallback(
    (updater: (prev: SessionLibraryData) => SessionLibraryData) => {
      const next = updater(latest.current);
      latest.current = next;
      void save(next);
    },
    [save]
  );

  // A library left in this browser (the Supabase row already existed, e.g. created on another
  // device): add its sessions and columns that the stored library doesn't have yet
  useEffect(() => {
    if (isLoading || !user || legacyMergeDone) return;
    const legacy = readLegacy();
    if (!legacy) return;
    legacyMergeDone = true;
    const current = latest.current;
    const entryIds = new Set(current.entries.map(e => e.id));
    const columnIds = new Set(current.columns.map(c => c.id));
    const newEntries = legacy.entries.filter(e => !entryIds.has(e.id));
    const newColumns = legacy.columns.filter(c => !columnIds.has(c.id));
    (async () => {
      if (newEntries.length > 0 || newColumns.length > 0) {
        const merged = { ...current, entries: [...current.entries, ...newEntries], columns: [...current.columns, ...newColumns] };
        latest.current = merged;
        await save(merged);
      }
      // Remove the browser copy only once every session of it is confirmed in Supabase
      const saved = sessionLibraryStore.savedIds();
      const inLegacyMode = sessionLibraryStore.getState().mode === 'legacy';
      if (!inLegacyMode && legacy.entries.every(e => saved.has(`w:${e.id}`))) {
        localStorage.removeItem(LEGACY_KEY);
        if (newEntries.length > 0) console.info(`[sessionLibrary] ${newEntries.length} session(s) from this browser added to the library`);
      } else {
        legacyMergeDone = false; // try again on the next load
      }
    })().catch(err => { legacyMergeDone = false; console.error('[sessionLibrary] merging the browser library failed', err); });
  }, [isLoading, user, save]);

  // ── Entries ────────────────────────────────────────────────────────────────

  const addEntry = useCallback(
    (entry: Omit<SessionLibraryEntry, 'id' | 'createdAt' | 'updatedAt'>): SessionLibraryEntry => {
      const now = new Date().toISOString();
      const newEntry: SessionLibraryEntry = {
        ...entry,
        id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };
      update(prev => ({ ...prev, entries: [...prev.entries, newEntry] }));
      return newEntry;
    },
    [update]
  );

  const updateEntry = useCallback(
    (id: string, updates: Partial<Omit<SessionLibraryEntry, 'id' | 'createdAt'>>) => {
      update(prev => ({
        ...prev,
        entries: prev.entries.map(e =>
          e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
        ),
      }));
    },
    [update]
  );

  const deleteEntry = useCallback(
    (id: string) => {
      update(prev => ({ ...prev, entries: prev.entries.filter(e => e.id !== id) }));
    },
    [update]
  );

  const duplicateEntry = useCallback(
    (id: string) => {
      update(prev => {
        const entry = prev.entries.find(e => e.id === id);
        if (!entry) return prev;
        const now = new Date().toISOString();
        const copy: SessionLibraryEntry = {
          ...entry,
          id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: `${entry.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
        };
        return { ...prev, entries: [...prev.entries, copy] };
      });
    },
    [update]
  );

  // ── Columns ────────────────────────────────────────────────────────────────

  const addColumn = useCallback(
    (col: Omit<SessionLibraryColumn, 'id'>): SessionLibraryColumn => {
      const newCol: SessionLibraryColumn = {
        ...col,
        id: `slc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      };
      update(prev => ({ ...prev, columns: [...prev.columns, newCol] }));
      return newCol;
    },
    [update]
  );

  const updateColumn = useCallback(
    (id: string, updates: Partial<Omit<SessionLibraryColumn, 'id'>>) => {
      update(prev => ({
        ...prev,
        columns: prev.columns.map(c => (c.id === id ? { ...c, ...updates } : c)),
      }));
    },
    [update]
  );

  const removeColumn = useCallback(
    (id: string) => {
      update(prev => ({
        ...prev,
        columns: prev.columns.filter(c => c.id !== id),
        // Strip the removed column's value from all entries
        entries: prev.entries.map(e => {
          const { [id]: _removed, ...rest } = e.columnValues;
          return { ...e, columnValues: rest };
        }),
      }));
    },
    [update]
  );

  return {
    entries: data.entries,
    columns: data.columns,
    /** True until the library has been loaded from Supabase */
    isLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    duplicateEntry,
    addColumn,
    updateColumn,
    removeColumn,
  };
}
