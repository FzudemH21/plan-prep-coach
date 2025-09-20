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
  isBuiltIn?: boolean;
}

export interface CustomExercise {
  id: string;
  data: Record<string, any>;
}

export interface CustomLibraryData {
  libraries: CustomLibrary[];
  lastUpdated: string;
  version: string;
}

interface CustomLibrariesContextType {
  data: CustomLibraryData;
  isLoading: boolean;
  libraries: CustomLibrary[];
  addLibrary: (library: Omit<CustomLibrary, 'id' | 'exercises' | 'createdAt' | 'lastUpdated' | 'isBuiltIn'>) => CustomLibrary;
  editLibrary: (libraryId: string, updates: Partial<Pick<CustomLibrary, 'name' | 'description'>>) => void;
  deleteLibrary: (libraryId: string) => void;
  addExerciseToLibrary: (libraryId: string, exercise: Omit<CustomExercise, 'id'>) => CustomExercise;
  updateExerciseInLibrary: (libraryId: string, exerciseId: string, updates: Partial<CustomExercise>) => void;
  deleteExerciseFromLibrary: (libraryId: string, exerciseId: string) => void;
  addColumnToLibrary: (libraryId: string, column: Omit<LibraryColumn, 'id'>) => void;
  updateColumnInLibrary: (libraryId: string, columnId: string, updates: Partial<LibraryColumn>) => void;
  deleteColumnFromLibrary: (libraryId: string, columnId: string) => void;
  reorderColumnsInLibrary: (libraryId: string, columnIds: string[]) => void;
}

const CustomLibrariesContext = createContext<CustomLibrariesContextType | undefined>(undefined);

const STORAGE_KEY = 'custom_libraries';

const BUILT_IN_LIBRARIES: CustomLibrary[] = [
  {
    id: 'resistance-training',
    name: 'Resistance Exercise Library',
    type: 'Resistance Training',
    description: 'Comprehensive database of resistance training exercises',
    columns: [
      { id: 'übungsname', name: 'Exercise Name', type: 'text', required: true },
      { id: 'akzentuierteKörperregion', name: 'Accentuated Body Region', type: 'select', required: false, options: ['Unterkörper', 'Oberkörper', 'Ganzkörper'] },
      { id: 'dominantesBewegungsmuster', name: 'Dominant Movement Pattern', type: 'select', required: false, options: ['Squat', 'Hinge', 'Push', 'Pull', 'Carry', 'Lunge', '-'] },
      { id: 'forcesActingOnSpine', name: 'Forces Acting on Spine', type: 'select', required: false, options: ['Compression', 'Shear', 'Shear/Compression', 'Shear/Rotation', 'Rotation', '-'] },
      { id: 'übungsausführung', name: 'Exercise Execution', type: 'select', required: false, options: ['dynamisch', 'isometrisch', 'ballistisch'] },
      { id: 'trunkTrainingFramework', name: 'Trunk Training Framework', type: 'text', required: false },
      { id: 'mainMovementPlane', name: 'Main Movement Plane', type: 'select', required: false, options: ['Sagittal', 'Frontal', 'Transverse'] },
      { id: 'level', name: 'Level', type: 'text', required: false },
      { id: 'artDesWiderstandes', name: 'Type of Resistance', type: 'select', required: false, options: ['Körpergewicht', 'Kurzhantel', 'Langhantel', 'Kettlebell', 'Sonstiges', 'Safety Squat Bar'] },
      { id: 'stand', name: 'Stance', type: 'select', required: false, options: ['bilateral', 'unilateral', 'x'] },
      { id: 'variationen', name: 'Variations', type: 'textarea', required: false }
    ],
    exercises: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUpdated: new Date().toISOString(),
    isBuiltIn: true
  },
  {
    id: 'plyometrics',
    name: 'Plyometrics Library',
    type: 'Plyometrics',
    description: 'Collection of plyometric and explosive movement exercises',
    columns: [
      { id: 'übung', name: 'Exercise', type: 'text', required: true },
      { id: 'intensität', name: 'Intensity', type: 'select', required: false, options: ['Low', 'Medium', 'High', 'Very High'] },
      { id: 'tier', name: 'Tier', type: 'select', required: false, options: ['1', '2', '3', '4', '5'] },
      { id: 'dauerDVZ', name: 'Duration DVZ', type: 'select', required: false, options: ['<250ms', '250-500ms', '>500ms'] },
      { id: 'fokusrichtung', name: 'Focus Direction', type: 'select', required: false, options: ['Horizontal', 'Vertical', 'Lateral', 'Multi'] },
      { id: 'bewegungsart', name: 'Movement Type', type: 'select', required: false, options: ['Jump', 'Hop', 'Bound', 'Drop'] },
      { id: 'modus', name: 'Mode', type: 'select', required: false, options: ['Bilateral', 'Unilateral', 'Alternating'] },
      { id: 'emphasis', name: 'Emphasis', type: 'text', required: false },
      { id: 'übungsgruppe', name: 'Exercise Group', type: 'select', required: false, options: ['Basic', 'Intermediate', 'Advanced', 'Elite'] },
      { id: 'kommentar', name: 'Comment', type: 'textarea', required: false }
    ],
    exercises: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUpdated: new Date().toISOString(),
    isBuiltIn: true
  }
];

const DEFAULT_DATA: CustomLibraryData = {
  libraries: [...BUILT_IN_LIBRARIES],
  lastUpdated: new Date().toISOString(),
  version: '1.0.0'
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
        // Ensure built-in libraries are always present and up-to-date
        const existingBuiltIns = parsed.libraries.filter((lib: CustomLibrary) => lib.isBuiltIn);
        const nonBuiltIns = parsed.libraries.filter((lib: CustomLibrary) => !lib.isBuiltIn);
        
        // Always use the latest built-in library definitions
        const updatedBuiltIns = BUILT_IN_LIBRARIES.map(builtInLib => {
          const existing = existingBuiltIns.find((lib: CustomLibrary) => lib.id === builtInLib.id);
          if (existing && existing.exercises && existing.exercises.length > 0) {
            // Keep existing exercises but update columns structure
            return {
              ...builtInLib,
              exercises: existing.exercises,
              lastUpdated: existing.lastUpdated
            };
          }
          return builtInLib;
        });
        
        setData({
          ...parsed,
          libraries: [...updatedBuiltIns, ...nonBuiltIns]
        });
      } else {
        // First time - migrate data from static files
        const migratedData = migrateStaticData();
        setData(migratedData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedData));
      }
    } catch (error) {
      console.error('Error loading custom libraries:', error);
      toast({
        title: "Error",
        description: "Failed to load custom libraries",
        variant: "destructive"
      });
      const migratedData = migrateStaticData();
      setData(migratedData);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const migrateStaticData = (): CustomLibraryData => {
    // Import static data
    const migratedBuiltIns = BUILT_IN_LIBRARIES.map(lib => {
      if (lib.id === 'resistance-training') {
        try {
          // Import would need to be dynamic or we can populate with sample data
          const sampleExercises: CustomExercise[] = [
            {
              id: 'sample-1',
              data: {
                übungsname: 'Push-ups',
                akzentuierteKörperregion: 'Oberkörper',
                dominantesBewegungsmuster: 'Push',
                forcesActingOnSpine: 'Compression',
                übungsausführung: 'dynamisch',
                trunkTrainingFramework: '',
                mainMovementPlane: 'Sagittal',
                level: '1',
                artDesWiderstandes: 'Körpergewicht',
                stand: 'bilateral',
                variationen: 'Incline, decline, diamond'
              }
            }
          ];
          return { ...lib, exercises: sampleExercises };
        } catch (error) {
          console.error('Error migrating resistance training data:', error);
          return lib;
        }
      }
      
      if (lib.id === 'plyometrics') {
        try {
          const sampleExercises: CustomExercise[] = [
            {
              id: 'sample-ply-1',
              data: {
                übung: 'Jump Squat',
                intensität: 'Medium',
                tier: '2',
                dauerDVZ: '<250ms',
                fokusrichtung: 'Vertical',
                bewegungsart: 'Jump',
                modus: 'Bilateral',
                emphasis: 'Power',
                übungsgruppe: 'Basic',
                kommentar: 'Basic explosive movement'
              }
            }
          ];
          return { ...lib, exercises: sampleExercises };
        } catch (error) {
          console.error('Error migrating plyometrics data:', error);
          return lib;
        }
      }
      
      return lib;
    });

    return {
      libraries: migratedBuiltIns,
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };
  };

  const saveData = (newData: CustomLibraryData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
      console.log('Saved libraries data:', newData);
    } catch (error) {
      console.error('Error saving custom libraries:', error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive"
      });
    }
  };

  const addLibrary = (library: Omit<CustomLibrary, 'id' | 'exercises' | 'createdAt' | 'lastUpdated' | 'isBuiltIn'>) => {
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
      lastUpdated: new Date().toISOString(),
      isBuiltIn: false
    };

    const newData: CustomLibraryData = {
      ...data,
      libraries: [...data.libraries, newLibrary],
      lastUpdated: new Date().toISOString()
    };

    console.log('Adding library:', newLibrary);
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
    reorderColumnsInLibrary
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