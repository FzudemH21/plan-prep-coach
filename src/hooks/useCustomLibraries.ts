import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface CustomLibrary {
  id: string;
  name: string;
  type: string;
  description: string;
  exercises: CustomExercise[];
  createdAt: string;
  lastUpdated: string;
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

const STORAGE_KEY = 'custom_libraries';
const DEFAULT_DATA: CustomLibraryData = {
  libraries: [],
  lastUpdated: new Date().toISOString(),
  version: '1.0.0'
};

export function useCustomLibraries() {
  const [data, setData] = useState<CustomLibraryData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(parsed);
      }
    } catch (error) {
      console.error('Error loading custom libraries:', error);
      toast({
        title: "Error",
        description: "Failed to load custom libraries",
        variant: "destructive"
      });
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
    const newLibrary: CustomLibrary = {
      ...library,
      id: Date.now().toString(),
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

  const deleteLibrary = (libraryId: string) => {
    const newData: CustomLibraryData = {
      ...data,
      libraries: data.libraries.filter(lib => lib.id !== libraryId),
      lastUpdated: new Date().toISOString()
    };

    saveData(newData);
  };

  return {
    data,
    isLoading,
    libraries: data.libraries,
    addLibrary,
    deleteLibrary,
    addExerciseToLibrary,
    updateExerciseInLibrary,
    deleteExerciseFromLibrary
  };
}