import { useEffect, useState } from "react";
import { ExerciseDatabase, ExerciseEntry } from "@/types/exercises";
import { defaultExerciseDatabase } from "@/data/exerciseData";

export function useExerciseData() {
  const [data, setData] = useState<ExerciseDatabase>(defaultExerciseDatabase);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = () => {
      try {
        const stored = localStorage.getItem("exercise-database");
        if (stored) {
          const parsed = JSON.parse(stored) as ExerciseDatabase;
          setData(parsed);
        } else {
          setData(defaultExerciseDatabase);
          localStorage.setItem("exercise-database", JSON.stringify(defaultExerciseDatabase));
        }
      } catch (error) {
        console.error("Failed to load exercise data:", error);
        setData(defaultExerciseDatabase);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const saveData = (newData: ExerciseDatabase) => {
    try {
      const updatedData = {
        ...newData,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem("exercise-database", JSON.stringify(updatedData));
      setData(updatedData);
    } catch (error) {
      console.error("Failed to save exercise data:", error);
    }
  };

  const addEntry = (entry: Omit<ExerciseEntry, 'id'>) => {
    const newId = (Math.max(...data.exercises.map(e => parseInt(e.id) || 0)) + 1).toString();
    const newEntry: ExerciseEntry = {
      ...entry,
      id: newId
    };
    
    const newData: ExerciseDatabase = {
      ...data,
      exercises: [...data.exercises, newEntry]
    };
    
    saveData(newData);
  };

  const updateEntry = (id: string, entry: Partial<ExerciseEntry>) => {
    const newData: ExerciseDatabase = {
      ...data,
      exercises: data.exercises.map(e => 
        e.id === id ? { ...e, ...entry } : e
      )
    };
    
    saveData(newData);
  };

  const deleteEntry = (id: string) => {
    const newData: ExerciseDatabase = {
      ...data,
      exercises: data.exercises.filter(e => e.id !== id)
    };
    
    saveData(newData);
  };

  const importData = (tsvText: string) => {
    try {
      const lines = tsvText.trim().split('\n');
      if (lines.length < 2) return;
      
      const headers = lines[0].split('\t');
      const exerciseRows = lines.slice(1);
      
      const newEntries: ExerciseEntry[] = exerciseRows.map((line, index) => {
        const values = line.split('\t');
        const maxId = Math.max(...data.exercises.map(e => parseInt(e.id) || 0));
        
        return {
          id: (maxId + index + 1).toString(),
          übungsname: values[0] || '',
          akzentuierteKörperregion: values[1] || '',
          dominantesBewegungsmuster: values[2] || '',
          forcesActingOnSpine: values[3] || '',
          übungsausführung: values[4] || '',
          trunkTrainingFramework: values[5] || '',
          mainMovementPlane: values[6] || '',
          level: values[7] || '',
          artDesWiderstandes: values[8] || '',
          stand: values[9] || '',
          variationen: values[10] || ''
        };
      });
      
      const newData: ExerciseDatabase = {
        ...data,
        exercises: [...data.exercises, ...newEntries]
      };
      
      saveData(newData);
    } catch (error) {
      console.error("Failed to import exercise data:", error);
    }
  };

  const exportData = () => {
    const headers = [
      'Übungsname',
      'akzentuierte Körperregion',
      'dominantes Bewegungsmuster',
      'Forces acting on spine',
      'Übungsausführung',
      'Trunk Training Framework',
      'Main Movement Plane',
      'Level',
      'Art des Widerstandes',
      'Stand',
      'Variationen (siehe auch Supertraining)'
    ].join('\t');
    
    const rows = data.exercises.map(entry => [
      entry.übungsname,
      entry.akzentuierteKörperregion,
      entry.dominantesBewegungsmuster,
      entry.forcesActingOnSpine,
      entry.übungsausführung,
      entry.trunkTrainingFramework,
      entry.mainMovementPlane,
      entry.level,
      entry.artDesWiderstandes,
      entry.stand,
      entry.variationen
    ].join('\t'));
    
    return [headers, ...rows].join('\n');
  };

  return {
    data,
    isLoading,
    addEntry,
    updateEntry, 
    deleteEntry,
    importData,
    exportData,
    saveData
  };
}