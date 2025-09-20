import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface CustomLibrary {
  id: string;
  name: string;
  type: string;
  description: string;
  exercises: CustomExercise[];
  createdAt: string;
  lastUpdated: string;
  isBuiltIn?: boolean;
}

export interface CustomExercise {
  id: string;
  name: string;
  category?: string;
  type?: string;
  metadata?: Record<string, any>;
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
}

const CustomLibrariesContext = createContext<CustomLibrariesContextType | undefined>(undefined);

const STORAGE_KEY = 'custom_libraries';

const BUILT_IN_LIBRARIES: CustomLibrary[] = [
  {
    id: 'resistance-training',
    name: 'Resistance Exercise Library',
    type: 'Resistance Training',
    description: 'Comprehensive database of resistance training exercises',
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
        // Ensure built-in libraries are always present
        const existingBuiltIns = parsed.libraries.filter((lib: CustomLibrary) => lib.isBuiltIn);
        const missingBuiltIns = BUILT_IN_LIBRARIES.filter(lib => 
          !existingBuiltIns.some((existing: CustomLibrary) => existing.id === lib.id)
        );
        
        setData({
          ...parsed,
          libraries: [...parsed.libraries, ...missingBuiltIns]
        });
      } else {
        setData(DEFAULT_DATA);
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
    const newLibrary: CustomLibrary = {
      ...library,
      id: Date.now().toString(),
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

  const value: CustomLibrariesContextType = {
    data,
    isLoading,
    libraries: data.libraries,
    addLibrary,
    editLibrary,
    deleteLibrary,
    addExerciseToLibrary,
    updateExerciseInLibrary,
    deleteExerciseFromLibrary
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