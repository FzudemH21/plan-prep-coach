import { useState, useEffect } from 'react';
import { AthleticismDatabase, AthleticismEntry } from '@/types/athleticism';
import { defaultAthleticismData } from '@/data/athleticismData';

const STORAGE_KEY = 'athleticism-database';

export function useAthleticismData() {
  const [data, setData] = useState<AthleticismDatabase>(defaultAthleticismData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData(parsed);
      } catch (error) {
        console.error('Failed to parse stored athleticism data:', error);
        setData(defaultAthleticismData);
      }
    }
    setIsLoading(false);
  }, []);

  const saveData = (newData: AthleticismDatabase) => {
    const updatedData = {
      ...newData,
      lastUpdated: new Date().toISOString()
    };
    setData(updatedData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
  };

  const addEntry = (entry: Omit<AthleticismEntry, 'id'>) => {
    const newEntry: AthleticismEntry = {
      ...entry,
      id: Date.now().toString()
    };
    const newData = {
      ...data,
      entries: [...data.entries, newEntry]
    };
    saveData(newData);
  };

  const updateEntry = (id: string, entry: Partial<AthleticismEntry>) => {
    const newEntries = data.entries.map(e => 
      e.id === id ? { ...e, ...entry } : e
    );
    saveData({ ...data, entries: newEntries });
  };

  const deleteEntry = (id: string) => {
    const newEntries = data.entries.filter(e => e.id !== id);
    saveData({ ...data, entries: newEntries });
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    result.push(current);
    return result;
  };

  const importData = (csvText: string) => {
    try {
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = parseCsvLine(lines[0]);
      
      if (headers.length < 5) {
        throw new Error('Invalid format. Expected at least 5 columns.');
      }

      const entries: AthleticismEntry[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length >= 5) {
          const entry: AthleticismEntry = {
            id: Date.now().toString() + i,
            overarchingGoal: values[0] || '',
            subGoal: values[1] || '',
            quality: values[2] || '',
            mappedMethods: values[3] ? JSON.parse(values[3]) : [],
            loadingRecommendations: values[4] ? JSON.parse(values[4]) : {}
          };
          entries.push(entry);
        }
      }

      saveData({ ...data, entries });
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  };

  const escapeCsvValue = (value: string): string => {
    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  };

  const exportData = () => {
    const headers = ['Overarching Goal', 'Sub-goal', 'Quality or Determining Factor', 'Mapped Methods', 'Loading Recommendations'];
    const rows = data.entries.map(entry => [
      entry.overarchingGoal,
      entry.subGoal,
      entry.quality,
      JSON.stringify(entry.mappedMethods),
      JSON.stringify(entry.loadingRecommendations)
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(escapeCsvValue).join(',')
    ).join('\n');
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