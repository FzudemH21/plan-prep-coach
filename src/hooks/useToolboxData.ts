import { useState, useEffect } from 'react';
import { ToolboxEntry, ToolboxDatabase } from '@/types/toolbox';
import { defaultToolboxData } from '@/data/toolboxData';

// Legacy entry type for migration (supports old 'parameter' field)
interface LegacyToolboxEntry {
  id: string;
  category: string;
  subCategory: string;
  parameter?: string; // Legacy field
  parameterName?: string;
  parameterType?: 'qualitative' | 'quantitative';
  options?: string[];
  exerciseCategories?: string[];
  isFrequencyParameter?: boolean;
  isSetParameter?: boolean;
  showInGridByDefault?: boolean;
  // Calculated parameter fields
  isCalculated?: boolean;
  formula?: string;
  sourceParameterIds?: string[];
}

// Migration function to parse legacy bracket notation and consolidate to parameterName
function migrateLegacyEntry(entry: LegacyToolboxEntry): ToolboxEntry {
  // If already has required fields, just ensure defaults
  if (entry.parameterName && entry.parameterType !== undefined && Array.isArray(entry.options)) {
    return {
      id: entry.id,
      category: entry.category,
      subCategory: entry.subCategory,
      parameterName: entry.parameterName,
      parameterType: entry.parameterType,
      options: entry.options,
      exerciseCategories: entry.exerciseCategories || [],
      isFrequencyParameter: entry.isFrequencyParameter,
      isSetParameter: entry.isSetParameter,
      showInGridByDefault: entry.showInGridByDefault ?? true,
      isCalculated: entry.isCalculated,
      formula: entry.formula,
      sourceParameterIds: entry.sourceParameterIds
    };
  }

  // Get the source string - prefer parameterName, fall back to legacy parameter
  const sourceParam = entry.parameterName || entry.parameter || '';
  const bracketMatch = sourceParam.match(/^(.+?)\s*\[(.+?)\]$/);
  
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
      id: entry.id,
      category: entry.category,
      subCategory: entry.subCategory,
      parameterName,
      parameterType: hasUnits ? 'quantitative' : 'qualitative',
      options,
      exerciseCategories: entry.exerciseCategories || [],
      isFrequencyParameter: entry.isFrequencyParameter,
      isSetParameter: entry.isSetParameter,
      showInGridByDefault: entry.showInGridByDefault ?? true,
      isCalculated: entry.isCalculated,
      formula: entry.formula,
      sourceParameterIds: entry.sourceParameterIds
    };
  } else {
    // No brackets - treat as qualitative with empty options
    return {
      id: entry.id,
      category: entry.category,
      subCategory: entry.subCategory,
      parameterName: sourceParam,
      parameterType: 'qualitative',
      options: [],
      exerciseCategories: entry.exerciseCategories || [],
      isFrequencyParameter: entry.isFrequencyParameter,
      isSetParameter: entry.isSetParameter,
      showInGridByDefault: entry.showInGridByDefault ?? true,
      isCalculated: entry.isCalculated,
      formula: entry.formula,
      sourceParameterIds: entry.sourceParameterIds
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
        && entry.parameterName.toLowerCase().includes('frequency')
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
    
    const paramNameLower = entry.parameterName.toLowerCase();
    
    // Check for set-like parameters:
    // 1. Contains "set" or "sets" (but not "reset")
    // 2. Contains "ground contacts per session" (for plyometrics)
    // 3. Contains "contacts per session" (for plyometrics - shorter match)
    const isSetLike = 
      (paramNameLower.includes('set') && !paramNameLower.includes('reset')) ||
      paramNameLower.includes('ground contacts per session') ||
      paramNameLower.includes('contacts per session');
    
    if (isSetLike && entry.parameterType === 'quantitative') {
      return { ...entry, isSetParameter: true };
    }
    
    return entry;
  });
}

export function useToolboxData() {
  const [data, setData] = useState<ToolboxDatabase>({ entries: [], lastUpdated: new Date().toISOString() });
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
          const rawParameter = values[parameterIndex]?.trim() || '';
          // Parse bracket notation for imports
          const bracketMatch = rawParameter.match(/^(.+?)\s*\[(.+?)\]$/);
          
          let parameterName: string;
          let options: string[];
          let parameterType: 'qualitative' | 'quantitative';
          
          if (bracketMatch) {
            parameterName = bracketMatch[1].trim();
            options = bracketMatch[2].split(',').map(opt => opt.trim());
            const hasUnits = options.some(opt => 
              /^(m|km|s|min|h|%|kg|lbs|reps?|sets?|#)$/i.test(opt)
            );
            parameterType = hasUnits ? 'quantitative' : 'qualitative';
          } else {
            parameterName = rawParameter;
            options = [];
            parameterType = 'qualitative';
          }
          
          const entry: ToolboxEntry = {
            id: Date.now().toString() + i,
            category: values[categoryIndex]?.trim() || '',
            subCategory: subCategoryIndex !== -1 ? (values[subCategoryIndex]?.trim() || '') : '',
            parameterName,
            parameterType,
            options
          };
          
          if (entry.category && entry.parameterName) {
            newEntries.push(entry);
          }
        }
      }
      
      // Apply migrations to newly imported entries
      let migratedEntries = migrateFrequencyParameter(newEntries);
      migratedEntries = migrateSetParameter(migratedEntries);
      
      const newData = {
        ...data,
        entries: [...data.entries, ...migratedEntries],
        lastUpdated: new Date().toISOString()
      };
      
      saveData(newData);
      return migratedEntries.length;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  };

  // Export data to TSV (exports parameterName with options in bracket format for compatibility)
  const exportData = () => {
    const headers = ['Category', 'Sub-Category', 'Parameter', 'Type'];
    const rows = data.entries.map(entry => {
      // Reconstruct legacy format for backward compatibility in exports
      const paramWithOptions = entry.options.length > 0 
        ? `${entry.parameterName} [${entry.options.join(', ')}]`
        : entry.parameterName;
      return [
        entry.category,
        entry.subCategory,
        paramWithOptions,
        entry.parameterType
      ];
    });
    
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