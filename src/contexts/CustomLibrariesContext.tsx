import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface LibraryColumn {
  id: string;
  name: string;
  type: 'text' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  width?: number;
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
  // Special fields (not columns) - every exercise can have these
  videoUrl?: string;          // YouTube or video link
  description?: string;       // Exercise execution description
}

export interface CustomLibraryData {
  libraries: CustomLibrary[];
  lastUpdated: string;
  version: string;
}

export interface BulkImportPayload {
  /** New columns to add. The `id` field is pre-assigned by the caller. */
  newColumns: LibraryColumn[];
  /** Exercises to add. `data` keys must be valid column ids (existing or from newColumns). */
  exercises: Array<Omit<CustomExercise, 'id'>>;
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
  /** Atomically add new columns and exercises in a single state update. */
  bulkImportToLibrary: (libraryId: string, payload: BulkImportPayload) => void;
}

const CustomLibrariesContext = createContext<CustomLibrariesContextType | undefined>(undefined);

const STORAGE_KEY = 'custom_libraries';

const DEFAULT_DATA: CustomLibraryData = {
  libraries: [],
  lastUpdated: new Date().toISOString(),
  version: '3.0.0'
};

export const CustomLibrariesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<CustomLibraryData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // If version is outdated, start fresh (removes old built-in libraries)
        if (!parsed.version || parsed.version < '3.0.0') {
          setData(DEFAULT_DATA);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
        } else {
          setData(parsed);
        }
      } else {
        // First time - use empty default
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
      }
    } catch (error) {
      console.error('Error loading custom libraries:', error);
      toast({
        title: "Error",
        description: "Failed to load custom libraries",
        variant: "destructive"
      });
      setData(DEFAULT_DATA);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const saveData = (newData: CustomLibraryData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
    } catch (error) {
      console.error('Error saving custom libraries:', error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive"
      });
    }
  };

  const addLibrary = (library: Omit<CustomLibrary, 'id' | 'exercises' | 'createdAt' | 'lastUpdated'>) => {
    // Create URL-safe ID from library name
    const createSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    };

    let baseSlug = createSlug(library.name);
    let uniqueSlug = baseSlug;
    let counter = 1;

    // Ensure unique ID
    while (data.libraries.some(lib => lib.id === uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const newLibrary: CustomLibrary = {
      ...library,
      id: uniqueSlug,
      columns: library.columns || [
        { id: 'exercise', name: 'Exercise', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'textarea', required: false }
      ],
      exercises: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    const newData: CustomLibraryData = {
      ...data,
      libraries: [...data.libraries, newLibrary],
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
    return newLibrary;
  };

  const addExerciseToLibrary = (libraryId: string, exercise: Omit<CustomExercise, 'id'>) => {
    const newExercise: CustomExercise = {
      ...exercise,
      id: Date.now().toString()
    };

    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib => 
        lib.id === libraryId 
          ? { 
              ...lib, 
              exercises: [...lib.exercises, newExercise],
              lastUpdated: new Date().toISOString()
            }
          : lib
      ),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
    return newExercise;
  };

  const updateExerciseInLibrary = (libraryId: string, exerciseId: string, updates: Partial<CustomExercise>) => {
    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib => 
        lib.id === libraryId 
          ? {
              ...lib,
              exercises: lib.exercises.map(ex => 
                ex.id === exerciseId ? { ...ex, ...updates } : ex
              ),
              lastUpdated: new Date().toISOString()
            }
          : lib
      ),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  const deleteExerciseFromLibrary = (libraryId: string, exerciseId: string) => {
    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib => 
        lib.id === libraryId 
          ? {
              ...lib,
              exercises: lib.exercises.filter(ex => ex.id !== exerciseId),
              lastUpdated: new Date().toISOString()
            }
          : lib
      ),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  const editLibrary = (libraryId: string, updates: Partial<Pick<CustomLibrary, 'name' | 'description'>>) => {
    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib => 
        lib.id === libraryId
          ? { ...lib, ...updates, lastUpdated: new Date().toISOString() }
          : lib
      ),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  const deleteLibrary = (libraryId: string) => {
    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.filter(lib => lib.id !== libraryId),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  const addColumnToLibrary = (libraryId: string, column: Omit<LibraryColumn, 'id'>) => {
    const newColumn: LibraryColumn = {
      ...column,
      id: `column_${Date.now()}`
    };

    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib => 
        lib.id === libraryId 
          ? { 
              ...lib, 
              columns: [...lib.columns, newColumn],
              lastUpdated: new Date().toISOString()
            }
          : lib
      ),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  const updateColumnInLibrary = (libraryId: string, columnId: string, updates: Partial<LibraryColumn>) => {
    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib => 
        lib.id === libraryId 
          ? {
              ...lib,
              columns: lib.columns.map(col => 
                col.id === columnId ? { ...col, ...updates } : col
              ),
              lastUpdated: new Date().toISOString()
            }
          : lib
      ),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  const deleteColumnFromLibrary = (libraryId: string, columnId: string) => {
    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib => 
        lib.id === libraryId 
          ? {
              ...lib,
              columns: lib.columns.filter(col => col.id !== columnId),
              exercises: lib.exercises.map(ex => {
                const { [columnId]: removed, ...remainingData } = ex.data;
                return { ...ex, data: remainingData };
              }),
              lastUpdated: new Date().toISOString()
            }
          : lib
      ),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  const reorderColumnsInLibrary = (libraryId: string, columnIds: string[]) => {
    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib => 
        lib.id === libraryId 
          ? {
              ...lib,
              columns: columnIds.map(id => lib.columns.find(col => col.id === id)!).filter(Boolean),
              lastUpdated: new Date().toISOString()
            }
          : lib
      ),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  const bulkImportToLibrary = (libraryId: string, payload: BulkImportPayload) => {
    const baseTs = Date.now();
    const newExercises: CustomExercise[] = payload.exercises.map((ex, index) => ({
      ...ex,
      id: `${baseTs + index}`,
    }));

    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.map(lib =>
        lib.id === libraryId
          ? {
              ...lib,
              columns: [...lib.columns, ...payload.newColumns],
              exercises: [...lib.exercises, ...newExercises],
              lastUpdated: new Date().toISOString(),
            }
          : lib
      ),
      lastUpdated: new Date().toISOString(),
    };

    saveData(newData);
  };

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
