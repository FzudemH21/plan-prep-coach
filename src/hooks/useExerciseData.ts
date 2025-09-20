import { useEffect, useState } from "react";
import { ExerciseDatabase, ExerciseEntry } from "@/types/exercises";
import { completeExerciseDatabase } from "@/data/exerciseDataComplete";
import { TableColumn } from "@/components/shared/EnhancedEditableTable";

export function useExerciseData() {
  const [data, setData] = useState<ExerciseDatabase>(completeExerciseDatabase);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = () => {
      try {
        const stored = localStorage.getItem("exercise-database");
        if (stored) {
          const parsed = JSON.parse(stored) as ExerciseDatabase;
          setData(parsed);
        } else {
          setData(completeExerciseDatabase);
          localStorage.setItem("exercise-database", JSON.stringify(completeExerciseDatabase));
        }
      } catch (error) {
        console.error("Failed to load exercise data:", error);
        setData(completeExerciseDatabase);
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
      id: newId,
      übungsname: entry.übungsname || '',
      akzentuierteKörperregion: entry.akzentuierteKörperregion || '',
      dominantesBewegungsmuster: entry.dominantesBewegungsmuster || '',
      forcesActingOnSpine: entry.forcesActingOnSpine || '',
      übungsausführung: entry.übungsausführung || '',
      trunkTrainingFramework: entry.trunkTrainingFramework || '',
      mainMovementPlane: entry.mainMovementPlane || '',
      level: entry.level || '',
      artDesWiderstandes: entry.artDesWiderstandes || '',
      stand: entry.stand || '',
      variationen: entry.variationen || '',
      ...entry
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

  const importData = (tsvText: string, mode: 'replace' | 'append' = 'append') => {
    try {
      // Remove BOM and normalize line endings
      const cleanText = tsvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = cleanText.trim().split('\n');
      if (lines.length < 2) return;
      
      // Skip header line
      const exerciseRows = lines.slice(1);
      
      const newEntries: ExerciseEntry[] = [];
      let currentLine = '';
      let fieldCount = 0;
      
      // Robust parsing that handles multi-line fields
      for (let i = 0; i < exerciseRows.length; i++) {
        currentLine += (currentLine ? '\n' : '') + exerciseRows[i];
        fieldCount = currentLine.split('\t').length;
        
        // We expect 11 fields total
        if (fieldCount >= 11) {
          const values = currentLine.split('\t');
          const maxId = mode === 'replace' ? 0 : Math.max(...data.exercises.map(e => parseInt(e.id) || 0));
          
          newEntries.push({
            id: (maxId + newEntries.length + 1).toString(),
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
            variationen: values.slice(10).join('\t') // Handle multi-line variations field
          });
          
          currentLine = '';
          fieldCount = 0;
        }
      }
      
      const newData: ExerciseDatabase = {
        ...data,
        exercises: mode === 'replace' ? newEntries : [...data.exercises, ...newEntries],
        version: data.version
      };
      
      saveData(newData);
    } catch (error) {
      console.error("Failed to import exercise data:", error);
      throw error;
    }
  };

  const resetToDefaults = () => {
    setData(completeExerciseDatabase);
    localStorage.removeItem("exercise-database");
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

  // Default column definitions - preserve existing structure
  const getDefaultColumns = (): TableColumn[] => [
    { key: 'übungsname', label: 'Übungsname', type: 'text', required: true },
    { key: 'akzentuierteKörperregion', label: 'Akzentuierte Körperregion', type: 'select', options: ['Unterkörper', 'Oberkörper', 'Ganzkörper', 'Rumpf', 'Schulter'], required: true },
    { key: 'dominantesBewegungsmuster', label: 'Dominantes Bewegungsmuster', type: 'select', options: ['Hinge', 'Squat', 'Vertical Pull', 'Vertical Push', 'Horizontal Pull', 'Horizontal Push', '-', 'x'], required: true },
    { key: 'forcesActingOnSpine', label: 'Forces Acting on Spine', type: 'select', options: ['Compression', 'Shear', 'Distraction', 'Rotation', 'Torque', 'Multi', 'Shear/Compression', 'Shear/Rotation', 'Shear/Distraction'], required: true },
    { key: 'übungsausführung', label: 'Übungsausführung', type: 'select', options: ['isometrisch', 'dynamisch', 'ballistisch', 'quasi-isometrisch'], required: true },
    { key: 'trunkTrainingFramework', label: 'Trunk Training Framework', type: 'text' },
    { key: 'mainMovementPlane', label: 'Main Movement Plane', type: 'select', options: ['Sagittal', 'Frontal', 'Transversal', 'Sagittal/Frontal', 'Sagittal/Transversal', 'Frontal/Transversal'] },
    { key: 'level', label: 'Level', type: 'text' },
    { key: 'artDesWiderstandes', label: 'Art des Widerstandes', type: 'select', options: ['Körpergewicht', 'Kurzhantel', 'Langhantel', 'Kettlebell', 'Kabelzug', 'Maschine', 'Medizinball', 'Sonstiges', 'Partner', 'Prowler', 'Safety Squat Bar', 'Trap Bar'], required: true },
    { key: 'stand', label: 'Stand', type: 'select', options: ['bilateral', 'unilateral', 'x', 'sitting', 'liegend', 'kneeling', 'half-kneeling', 'staggered', 'prone', 'supine', 'gehend', 'quadruped', 'unimanual', 'bimanual'] },
    { key: 'variationen', label: 'Variationen', type: 'multiline' }
  ];

  // Initialize columns if not present
  const columns = data.columnDefinitions || getDefaultColumns();

  // Column management functions
  const addColumn = (column: Omit<TableColumn, 'key'>) => {
    const newColumn: TableColumn = {
      ...column,
      key: `custom_${Date.now()}`
    };
    
    const newData = {
      ...data,
      columnDefinitions: [...columns, newColumn],
      // Add empty values for new column to all existing exercises
      exercises: data.exercises.map(exercise => ({
        ...exercise,
        [newColumn.key]: ''
      }))
    };
    
    saveData(newData);
  };

  const updateColumn = (key: string, updates: Partial<TableColumn>) => {
    const newColumns = columns.map(col => 
      col.key === key ? { ...col, ...updates } : col
    );
    
    const newData = {
      ...data,
      columnDefinitions: newColumns
    };
    
    saveData(newData);
  };

  const deleteColumn = (key: string) => {
    const column = columns.find(col => col.key === key);
    if (column?.required) return; // Don't delete required columns
    
    const newColumns = columns.filter(col => col.key !== key);
    const newData = {
      ...data,
      columnDefinitions: newColumns,
      // Remove column data from all exercises
      exercises: data.exercises.map(exercise => {
        const { [key]: deletedField, ...rest } = exercise;
        return rest as ExerciseEntry;
      })
    };
    
    saveData(newData);
  };

  return {
    data,
    isLoading,
    columns,
    addEntry,
    updateEntry, 
    deleteEntry,
    importData,
    exportData,
    saveData,
    resetToDefaults,
    // Column management
    addColumn,
    updateColumn,
    deleteColumn,
  };
}