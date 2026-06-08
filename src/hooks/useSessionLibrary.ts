import { useState, useCallback } from 'react';
import type {
  SessionLibraryData,
  SessionLibraryEntry,
  SessionLibraryColumn,
} from '@/types/sessionLibrary';

const STORAGE_KEY = 'ppc-session-library';

const DEFAULT_DATA: SessionLibraryData = { version: '1', columns: [], entries: [] };

function readCache(): SessionLibraryData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as SessionLibraryData;
    // Migration guard: ensure required fields exist
    return {
      version: '1',
      columns: parsed.columns ?? [],
      entries: parsed.entries ?? [],
    };
  } catch {
    return DEFAULT_DATA;
  }
}

function writeCache(data: SessionLibraryData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useSessionLibrary() {
  const [data, setData] = useState<SessionLibraryData>(readCache);

  const update = useCallback(
    (updater: (prev: SessionLibraryData) => SessionLibraryData) => {
      setData(prev => {
        const next = updater(prev);
        writeCache(next);
        return next;
      });
    },
    []
  );

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
    addEntry,
    updateEntry,
    deleteEntry,
    duplicateEntry,
    addColumn,
    updateColumn,
    removeColumn,
  };
}
