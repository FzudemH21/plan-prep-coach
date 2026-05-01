import React, { createContext, useContext, useCallback } from 'react';
import { useSupabaseStore } from '@/hooks/useSupabaseStore';

export interface LibraryColumn {
  id: string;
  name: string;
  type: 'text' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  width?: number;
  role?: 'video' | 'description';
}

export interface CustomLibrary {
  id: string;
  name: string;
  type: string;
  description: string;
  columns: LibraryColumn[];
  exercises: CustomExercise[];
  createdAt: string;
  lastUpdated: string;
}

export interface CustomExercise {
  id: string;
  data: Record<string, any>;
  videoUrl?: string;
  description?: string;
}

export interface CustomLibraryData {
  libraries: CustomLibrary[];
  lastUpdated: string;
  version: string;
}

export interface BulkImportPayload {
  newColumns: LibraryColumn[];
  exercises: Array<Omit<CustomExercise, 'id'>>;
  firstColumnRename?: { id: string; name: string };
  columnRoleUpdates?: Array<{ id: string; role: 'video' | 'description' }>;
}

interface CustomLibrariesContextType {
  data: CustomLibraryData;
  isLoading: boolean;
  libraries: CustomLibrary[];
  addLibrary: (library: Omit<CustomLibrary, 'id' | 'exercises' | 'createdAt' | 'lastUpdated'>) => CustomLibrary;
  editLibrary: (libraryId: string, updates: Partial<Pick<CustomLibrary, 'name' | 'description'>>) => void;
  deleteLibrary: (libraryId: string) => void;
  addExerciseToLibrary: (libraryId: string, exercise: Omit<CustomExercise, 'id'>) => CustomExercise;
  updateExerciseInLibrary: (libraryId: string, exerciseId: string, updates: Partial<CustomExercise>) => void;
  deleteExerciseFromLibrary: (libraryId: string, exerciseId: string) => void;
  addColumnToLibrary: (libraryId: string, column: Omit<LibraryColumn, 'id'>) => void;
  updateColumnInLibrary: (libraryId: string, columnId: string, updates: Partial<LibraryColumn>) => void;
  deleteColumnFromLibrary: (libraryId: string, columnId: string) => void;
  reorderColumnsInLibrary: (libraryId: string, columnIds: string[]) => void;
  bulkImportToLibrary: (libraryId: string, payload: BulkImportPayload) => void;
}

const CustomLibrariesContext = createContext<CustomLibrariesContextType | undefined>(undefined);

const CURRENT_VERSION = '3.0.0';

const DEFAULT_DATA: CustomLibraryData = {
  libraries: [],
  lastUpdated: new Date().toISOString(),
  version: CURRENT_VERSION,
};

function migrateLegacy(raw: unknown): CustomLibraryData {
  const r = raw as CustomLibraryData;
  // If version is outdated, discard old built-in libraries and start fresh
  if (!r?.version || r.version < CURRENT_VERSION) return DEFAULT_DATA;
  return r;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CustomLibrariesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, saveData, isLoading] = useSupabaseStore<CustomLibraryData>({
    tableName: 'custom_libraries',
    legacyKey: 'custom_libraries',
    defaultValue: DEFAULT_DATA,
    migrate: migrateLegacy,
  });

  // Fire-and-forget helper — keeps public API synchronous
  const save = useCallback((newData: CustomLibraryData) => {
    void saveData({ ...newData, lastUpdated: new Date().toISOString() });
  }, [saveData]);

  // ── Library operations ────────────────────────────────────────────────────

  const addLibrary = useCallback((
    library: Omit<CustomLibrary, 'id' | 'exercises' | 'createdAt' | 'lastUpdated'>,
  ): CustomLibrary => {
    const createSlug = (name: string) =>
      name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();

    let baseSlug = createSlug(library.name);
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (data.libraries.some(lib => lib.id === uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${counter++}`;
    }

    const newLibrary: CustomLibrary = {
      ...library,
      id: uniqueSlug,
      columns: library.columns || [{ id: 'exercise', name: 'Exercise', type: 'text', required: true }],
      exercises: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    save({ ...data, libraries: [...data.libraries, newLibrary] });
    return newLibrary;
  }, [data, save]);

  const editLibrary = useCallback((libraryId: string, updates: Partial<Pick<CustomLibrary, 'name' | 'description'>>) => {
    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId ? { ...lib, ...updates, lastUpdated: new Date().toISOString() } : lib
      ),
    });
  }, [data, save]);

  const deleteLibrary = useCallback((libraryId: string) => {
    save({ ...data, libraries: data.libraries.filter(lib => lib.id !== libraryId) });
  }, [data, save]);

  // ── Exercise operations ───────────────────────────────────────────────────

  const addExerciseToLibrary = useCallback((libraryId: string, exercise: Omit<CustomExercise, 'id'>): CustomExercise => {
    const newExercise: CustomExercise = { ...exercise, id: Date.now().toString() };
    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? { ...lib, exercises: [...lib.exercises, newExercise], lastUpdated: new Date().toISOString() }
          : lib
      ),
    });
    return newExercise;
  }, [data, save]);

  const updateExerciseInLibrary = useCallback((libraryId: string, exerciseId: string, updates: Partial<CustomExercise>) => {
    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? {
              ...lib,
              exercises: lib.exercises.map(ex => ex.id === exerciseId ? { ...ex, ...updates } : ex),
              lastUpdated: new Date().toISOString(),
            }
          : lib
      ),
    });
  }, [data, save]);

  const deleteExerciseFromLibrary = useCallback((libraryId: string, exerciseId: string) => {
    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? {
              ...lib,
              exercises: lib.exercises.filter(ex => ex.id !== exerciseId),
              lastUpdated: new Date().toISOString(),
            }
          : lib
      ),
    });
  }, [data, save]);

  // ── Column operations ─────────────────────────────────────────────────────

  const addColumnToLibrary = useCallback((libraryId: string, column: Omit<LibraryColumn, 'id'>) => {
    const newColumn: LibraryColumn = { ...column, id: `column_${Date.now()}` };
    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? { ...lib, columns: [...lib.columns, newColumn], lastUpdated: new Date().toISOString() }
          : lib
      ),
    });
  }, [data, save]);

  const updateColumnInLibrary = useCallback((libraryId: string, columnId: string, updates: Partial<LibraryColumn>) => {
    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? {
              ...lib,
              columns: lib.columns.map(col => col.id === columnId ? { ...col, ...updates } : col),
              lastUpdated: new Date().toISOString(),
            }
          : lib
      ),
    });
  }, [data, save]);

  const deleteColumnFromLibrary = useCallback((libraryId: string, columnId: string) => {
    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? {
              ...lib,
              columns: lib.columns.filter(col => col.id !== columnId),
              exercises: lib.exercises.map(ex => {
                const { [columnId]: _removed, ...remainingData } = ex.data;
                return { ...ex, data: remainingData };
              }),
              lastUpdated: new Date().toISOString(),
            }
          : lib
      ),
    });
  }, [data, save]);

  const reorderColumnsInLibrary = useCallback((libraryId: string, columnIds: string[]) => {
    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? {
              ...lib,
              columns: columnIds.map(id => lib.columns.find(col => col.id === id)!).filter(Boolean),
              lastUpdated: new Date().toISOString(),
            }
          : lib
      ),
    });
  }, [data, save]);

  const bulkImportToLibrary = useCallback((libraryId: string, payload: BulkImportPayload) => {
    const baseTs = Date.now();
    const newExercises: CustomExercise[] = payload.exercises.map((ex, index) => ({
      ...ex,
      id: `${baseTs + index}`,
    }));

    save({
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? {
              ...lib,
              columns: [
                ...lib.columns.map(col => {
                  let updated = col;
                  if (payload.firstColumnRename && col.id === payload.firstColumnRename.id) {
                    updated = { ...updated, name: payload.firstColumnRename.name };
                  }
                  const roleUpdate = payload.columnRoleUpdates?.find(r => r.id === col.id);
                  if (roleUpdate) updated = { ...updated, role: roleUpdate.role };
                  return updated;
                }),
                ...payload.newColumns,
              ],
              exercises: [...lib.exercises, ...newExercises],
              lastUpdated: new Date().toISOString(),
            }
          : lib
      ),
    });
  }, [data, save]);

  const value: CustomLibrariesContextType = {
    data,
    isLoading,
    libraries: data.libraries,
    addLibrary,
    editLibrary,
    deleteLibrary,
    addExerciseToLibrary,
    updateExerciseInLibrary,
    deleteExerciseFromLibrary,
    addColumnToLibrary,
    updateColumnInLibrary,
    deleteColumnFromLibrary,
    reorderColumnsInLibrary,
    bulkImportToLibrary,
  };

  return (
    <CustomLibrariesContext.Provider value={value}>
      {children}
    </CustomLibrariesContext.Provider>
  );
};

export const useCustomLibraries = () => {
  const context = useContext(CustomLibrariesContext);
  if (context === undefined) {
    throw new Error('useCustomLibraries must be used within a CustomLibrariesProvider');
  }
  return context;
};
