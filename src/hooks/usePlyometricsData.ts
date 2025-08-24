import { useEffect, useState } from "react";
import { PlyometricsDatabase, PlyometricsEntry } from "../types/plyometrics";
import { completePlyometricsDatabase } from "../data/plyometricsData";

export function usePlyometricsData() {
  const [data, setData] = useState<PlyometricsDatabase>(completePlyometricsDatabase);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = () => {
      try {
        const stored = localStorage.getItem("plyometrics-database");
        if (stored) {
          const parsed = JSON.parse(stored) as PlyometricsDatabase;
          setData(parsed);
        } else {
          setData(completePlyometricsDatabase);
          localStorage.setItem("plyometrics-database", JSON.stringify(completePlyometricsDatabase));
        }
      } catch (error) {
        console.error("Error loading plyometrics data:", error);
        setData(completePlyometricsDatabase);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const saveData = (newData: PlyometricsDatabase) => {
    const updatedData = {
      ...newData,
      lastUpdated: new Date().toISOString(),
    };
    setData(updatedData);
    localStorage.setItem("plyometrics-database", JSON.stringify(updatedData));
  };

  const addEntry = (entry: Omit<PlyometricsEntry, 'id'>) => {
    const newEntry: PlyometricsEntry = {
      ...entry,
      id: `plyometric-${Date.now()}`,
    };
    const newData = {
      ...data,
      exercises: [...data.exercises, newEntry],
    };
    saveData(newData);
  };

  const updateEntry = (id: string, entry: Partial<PlyometricsEntry>) => {
    const newData = {
      ...data,
      exercises: data.exercises.map((ex) =>
        ex.id === id ? { ...ex, ...entry } : ex
      ),
    };
    saveData(newData);
  };

  const deleteEntry = (id: string) => {
    const newData = {
      ...data,
      exercises: data.exercises.filter((ex) => ex.id !== id),
    };
    saveData(newData);
  };

  const importData = (tsvText: string, mode: 'replace' | 'append' = 'append') => {
    try {
      const lines = tsvText.trim().split(/\r?\n/);
      const headers = lines[0].split('\t').map(h => h.trim());
      
      const expectedHeaders = [
        'Übung', 'Intensität', 'Tier', 'Dauer DVZ', 'Fokusrichtung', 
        'Bewegungsart', 'Modus', 'Emphasis', 'Übungsgruppe', 'Kommentar'
      ];
      
      const importedExercises: PlyometricsEntry[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split('\t');
        
        const exercise: PlyometricsEntry = {
          id: `imported-${Date.now()}-${i}`,
          übung: values[0]?.trim() || '',
          intensität: values[1]?.trim() || '',
          tier: values[2]?.trim() || '',
          dauerDVZ: values[3]?.trim() || '',
          fokusrichtung: values[4]?.trim() || '',
          bewegungsart: values[5]?.trim() || '',
          modus: values[6]?.trim() || '',
          emphasis: values[7]?.trim() || '',
          übungsgruppe: values[8]?.trim() || '',
          kommentar: values[9]?.trim() || '',
        };
        
        importedExercises.push(exercise);
      }
      
      const newData = {
        ...data,
        exercises: mode === 'replace' ? importedExercises : [...data.exercises, ...importedExercises],
        lastUpdated: new Date().toISOString(),
      };
      
      saveData(newData);
      return { success: true, count: importedExercises.length };
    } catch (error) {
      console.error("Import error:", error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const exportData = () => {
    const headers = [
      'Übung', 'Intensität', 'Tier', 'Dauer DVZ', 'Fokusrichtung', 
      'Bewegungsart', 'Modus', 'Emphasis', 'Übungsgruppe', 'Kommentar'
    ];
    
    const rows = data.exercises.map(exercise => [
      exercise.übung,
      exercise.intensität,
      exercise.tier,
      exercise.dauerDVZ,
      exercise.fokusrichtung,
      exercise.bewegungsart,
      exercise.modus,
      exercise.emphasis,
      exercise.übungsgruppe,
      exercise.kommentar
    ]);
    
    const tsvContent = [headers, ...rows]
      .map(row => row.join('\t'))
      .join('\n');
      
    return tsvContent;
  };

  const resetToDefaults = () => {
    localStorage.removeItem("plyometrics-database");
    setData(completePlyometricsDatabase);
    localStorage.setItem("plyometrics-database", JSON.stringify(completePlyometricsDatabase));
  };

  return {
    data,
    isLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    importData,
    exportData,
    resetToDefaults,
  };
}