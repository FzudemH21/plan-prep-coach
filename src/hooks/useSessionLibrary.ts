/**
 * useSessionLibrary — the coach's reusable sessions (Session Library page, "Add from session
 * library" in the athlete calendar and the coach mobile app, "Save to library").
 *
 * Stored in Supabase (table `session_library`, one row per coach, migration 20261009) via
 * useSupabaseStore, so every device sees the same library. It used to live only in the browser
 * (localStorage 'ppc-session-library'): on the first load without a Supabase row the store uploads
 * it; a library still left in another browser is merged in (entries and columns by id) and removed
 * from that browser once the upload is confirmed.
 */
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseStore } from '@/hooks/useSupabaseStore';
import type {
  SessionLibraryData,
  SessionLibraryEntry,
  SessionLibraryColumn,
} from '@/types/sessionLibrary';

const TABLE = 'session_library';
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

/** Only one instance merges a leftover browser library per page load */
let legacyMergeDone = false;

export function useSessionLibrary() {
  const { user } = useAuth();
  const [stored, save, isLoading] = useSupabaseStore<SessionLibraryData>({
    tableName: TABLE,
    legacyKey: LEGACY_KEY,
    defaultValue: DEFAULT_DATA,
    migrate: normalize,
  });
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
      // Remove the browser copy only once the library is confirmed in Supabase
      const { data: row, error } = await supabase.from(TABLE).select('data').eq('user_id', user.id).maybeSingle();
      const savedIds = new Set(normalize(row?.data).entries.map(e => e.id));
      if (!error && row && legacy.entries.every(e => savedIds.has(e.id))) {
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
