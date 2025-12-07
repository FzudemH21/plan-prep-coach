import { useState, useEffect } from 'react';
import { ToolboxEntry, ToolboxDatabase } from '@/types/toolbox';
import { defaultToolboxData } from '@/data/toolboxData';

// Migration function to parse legacy bracket notation
function migrateLegacyEntry(entry: ToolboxEntry): ToolboxEntry {
  // If already migrated, return as-is
  if (entry.parameterName && entry.parameterType && entry.options && 'exerciseCategories' in entry) {
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
      options,
      exerciseCategories: entry.exerciseCategories || []
    };
  } else {
    // No brackets - treat as qualitative with empty options
    return {
      ...entry,
      parameterName: parameter,
      parameterType: 'qualitative',
      options: [],
      exerciseCategories: entry.exerciseCategories || []
    };
  }
}

// Migration function to mark frequency parameters
function migrateFrequencyParameter(entries: ToolboxEntry[]): ToolboxEntry[] {
  // Group entries by method (category + subCategory)
  const byMethod = new Map<string, ToolboxEntry[]>();
  
  entries.forEach(entry => {
    const key = `${entry.category}::${entry.subCategory}`;
    if (!byMethod.has(key)) byMethod.set(key, []);
    byMethod.get(key)!.push(entry);
  });
  
  // For each method, mark frequency parameter if not already marked
  return entries.map(entry => {
    const methodKey = `${entry.category}::${entry.subCategory}`;
    const methodEntries = byMethod.get(methodKey) || [];
    
    // Check if this method already has a marked frequency parameter
    const hasMarkedFrequency = methodEntries.some(e => e.isFrequencyParameter);
    
    // If not, and this entry's name contains "frequency" AND is quantitative, mark it
    if (!hasMarkedFrequency 
        && entry.parameter.toLowerCase().includes('frequency')
        && entry.parameterType === 'quantitative') {
      return { ...entry, isFrequencyParameter: true };
    }
    
    return entry;
  });
}

// Migration function to mark set parameters
function migrateSetParameter(entries: ToolboxEntry[]): ToolboxEntry[] {
  // Group entries by method (category + subCategory)
  const byMethod = new Map<string, ToolboxEntry[]>();
  
  entries.forEach(entry => {
    const key = `${entry.category}::${entry.subCategory}`;
    if (!byMethod.has(key)) byMethod.set(key, []);
    byMethod.get(key)!.push(entry);
  });
  
  // For each method, mark set parameter if not already marked
  return entries.map(entry => {
    const methodKey = `${entry.category}::${entry.subCategory}`;
    const methodEntries = byMethod.get(methodKey) || [];
    
    // Check if this method already has a marked set parameter
    const hasMarkedSetParam = methodEntries.some(e => e.isSetParameter);
    
    if (hasMarkedSetParam) {
      return entry;
    }
    
    const paramLower = entry.parameter.toLowerCase();
    const paramNameLower = entry.parameterName?.toLowerCase() || '';
    
    // Check for set-like parameters:
    // 1. Contains "set" or "sets"
    // 2. Contains "ground contacts per session" (for plyometrics)
    const isSetLike = 
      paramLower.includes('set') || 
      paramNameLower.includes('set') ||
      paramLower.includes('ground contacts per session') ||
      paramNameLower.includes('ground contacts per session');
    
    if (isSetLike && entry.parameterType === 'quantitative') {
      return { ...entry, isSetParameter: true };
    }
    
    return entry;
  });
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
        // Migrate legacy entries and frequency/set parameters
        let migratedEntries = parsedData.entries.map(migrateLegacyEntry);
        migratedEntries = migrateFrequencyParameter(migratedEntries);
        migratedEntries = migrateSetParameter(migratedEntries);
        const migratedData = { ...parsedData, entries: migratedEntries };
        setData(migratedData);
        // Save migrated data back to localStorage
        localStorage.setItem('toolbox-data', JSON.stringify(migratedData));
      } else {
        // Migrate default data on first load
        let migratedEntries = defaultToolboxData.entries.map(migrateLegacyEntry);
        migratedEntries = migrateFrequencyParameter(migratedEntries);
        migratedEntries = migrateSetParameter(migratedEntries);
        const migratedDefault = {
          ...defaultToolboxData,
          entries: migratedEntries
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

  // Copy an entry (duplicate sub-category with all parameters)
  const copyEntry = (categorySubCategoryKey: string) => {
    const [category, subCategory] = categorySubCategoryKey.split('|||');
    const existingEntries = data.entries.filter(
      e => e.category === category && e.subCategory === subCategory
    );
    
    if (existingEntries.length === 0) return;
    
    // Create a new sub-category name
    const newSubCategory = `${subCategory} (Copy)`;
    
    // Duplicate all parameters for this sub-category
    const newEntries = existingEntries.map(entry => ({
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      subCategory: newSubCategory
    }));
    
    const newData = {
      ...data,
      entries: [...data.entries, ...newEntries],
      lastUpdated: new Date().toISOString()
    };
    
    saveData(newData);
  };

  // Reorder parameters within a sub-category
  const reorderParameters = (categorySubCategoryKey: string, reorderedParameters: ToolboxEntry[]) => {
    const [category, subCategory] = categorySubCategoryKey.split('|||');
    
    // Remove old parameters for this sub-category
    const otherEntries = data.entries.filter(
      e => !(e.category === category && e.subCategory === subCategory)
    );
    
    // Add reordered parameters
    const newData = {
      ...data,
      entries: [...otherEntries, ...reorderedParameters],
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
    copyEntry,
    reorderParameters,
    importData,
    exportData,
    saveData
  };
}