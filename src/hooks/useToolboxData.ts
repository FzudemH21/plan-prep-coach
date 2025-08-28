import { useState, useEffect } from 'react';
import { ToolboxEntry, ToolboxDatabase } from '@/types/toolbox';
import { defaultToolboxData } from '@/data/toolboxData';

// Migration function to parse legacy bracket notation
function migrateLegacyEntry(entry: ToolboxEntry): ToolboxEntry {
  // If already migrated, return as-is
  if (entry.parameterName && entry.parameterType && entry.options) {
    return entry;
  }

  const parameter = entry.parameter;
  const bracketMatch = parameter.match(/^(.+?)\s*\[(.+?)\]$/);
  
  if (bracketMatch) {
    const parameterName = bracketMatch[1].trim();
    const optionsString = bracketMatch[2].trim();
    const options = optionsString.split(',').map(opt => opt.trim());
    
    // Auto-detect parameter type based on options content
    const hasUnits = options.some(opt => 
      /^(m|km|s|min|h|%|kg|lbs|reps?|sets?|#)$/i.test(opt) ||
      opt.toLowerCase().includes('second') ||
      opt.toLowerCase().includes('minute') ||
      opt.toLowerCase().includes('meter') ||
      opt.toLowerCase().includes('percent')
    );
    
    return {
      ...entry,
      parameterName,
      parameterType: hasUnits ? 'quantitative' : 'qualitative',
      options
    };
  } else {
    // No brackets - treat as qualitative with empty options
    return {
      ...entry,
      parameterName: parameter,
      parameterType: 'qualitative',
      options: []
    };
  }
}

export function useToolboxData() {
  const [data, setData] = useState<ToolboxDatabase>(defaultToolboxData);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from localStorage on mount with migration
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('toolbox-data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        // Migrate legacy entries
        const migratedEntries = parsedData.entries.map(migrateLegacyEntry);
        const migratedData = { ...parsedData, entries: migratedEntries };
        setData(migratedData);
        // Save migrated data back to localStorage
        localStorage.setItem('toolbox-data', JSON.stringify(migratedData));
      } else {
        // Migrate default data on first load
        const migratedDefault = {
          ...defaultToolboxData,
          entries: defaultToolboxData.entries.map(migrateLegacyEntry)
        };
        setData(migratedDefault);
      }
    } catch (error) {
      console.error('Failed to load toolbox data from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save data to localStorage
  const saveData = (newData: ToolboxDatabase) => {
    try {
      localStorage.setItem('toolbox-data', JSON.stringify(newData));
      setData(newData);
    } catch (error) {
      console.error('Failed to save toolbox data to localStorage:', error);
    }
  };

  // Add a new entry
  const addEntry = (entry: Omit<ToolboxEntry, 'id'>) => {
    const newEntry: ToolboxEntry = {
      ...entry,
      id: Date.now().toString()
    };
    
    const newData = {
      ...data,
      entries: [...data.entries, newEntry],
      lastUpdated: new Date().toISOString()
    };
    
    saveData(newData);
  };

  // Update an existing entry
  const updateEntry = (id: string, entry: Partial<ToolboxEntry>) => {
    const newData = {
      ...data,
      entries: data.entries.map(e => e.id === id ? { ...e, ...entry } : e),
      lastUpdated: new Date().toISOString()
    };
    
    saveData(newData);
  };

  // Delete an entry
  const deleteEntry = (id: string) => {
    const newData = {
      ...data,
      entries: data.entries.filter(e => e.id !== id),
      lastUpdated: new Date().toISOString()
    };
    
    saveData(newData);
  };

  // Import data from TSV
  const importData = (tsvText: string) => {
    try {
      const lines = tsvText.trim().split('\n');
      const headers = lines[0].toLowerCase().split('\t');
      
      const categoryIndex = headers.findIndex(h => h.includes('category'));
      const subCategoryIndex = headers.findIndex(h => h.includes('sub') || h.includes('subcategory'));
      const parameterIndex = headers.findIndex(h => h.includes('parameter'));
      
      if (categoryIndex === -1 || parameterIndex === -1) {
        throw new Error('Required columns not found. Make sure your file has Category and Parameter columns.');
      }
      
      const newEntries: ToolboxEntry[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        
        if (values.length >= 2) {
          const entry: ToolboxEntry = {
            id: Date.now().toString() + i,
            category: values[categoryIndex]?.trim() || '',
            subCategory: subCategoryIndex !== -1 ? (values[subCategoryIndex]?.trim() || '') : '',
            parameter: values[parameterIndex]?.trim() || ''
          };
          
          if (entry.category && entry.parameter) {
            newEntries.push(entry);
          }
        }
      }
      
      const newData = {
        ...data,
        entries: [...data.entries, ...newEntries],
        lastUpdated: new Date().toISOString()
      };
      
      saveData(newData);
      return newEntries.length;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  };

  // Export data to TSV
  const exportData = () => {
    const headers = ['Category', 'Sub-Category', 'Parameter'];
    const rows = data.entries.map(entry => [
      entry.category,
      entry.subCategory,
      entry.parameter
    ]);
    
    const tsvContent = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\n');
    
    return tsvContent;
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