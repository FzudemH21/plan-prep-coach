import { useCallback } from 'react';
import { useSupabaseStore } from './useSupabaseStore';
import { ToolboxEntry, ToolboxDatabase } from '@/types/toolbox';
import { defaultToolboxData } from '@/data/toolboxData';

// Legacy entry type for migration (supports old 'parameter' field)
interface LegacyToolboxEntry {
  id: string;
  category: string;
  subCategory: string;
  parameter?: string;
  parameterName?: string;
  parameterType?: 'qualitative' | 'quantitative';
  options?: string[];
  exerciseCategories?: string[];
  isFrequencyParameter?: boolean;
  isSetParameter?: boolean;
  isRestParameter?: boolean;
  showInGridByDefault?: boolean;
  isCalculated?: boolean;
  formula?: string;
  sourceParameterIds?: string[];
}

function migrateLegacyEntry(entry: LegacyToolboxEntry): ToolboxEntry {
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
      isRestParameter: entry.isRestParameter,
      showInGridByDefault: entry.showInGridByDefault ?? true,
      isCalculated: entry.isCalculated,
      formula: entry.formula,
      sourceParameterIds: entry.sourceParameterIds,
    };
  }

  const sourceParam = entry.parameterName || entry.parameter || '';
  const bracketMatch = sourceParam.match(/^(.+?)\s*\[(.+?)\]$/);

  if (bracketMatch) {
    const parameterName = bracketMatch[1].trim();
    const options = bracketMatch[2].split(',').map(opt => opt.trim());
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
      isRestParameter: entry.isRestParameter,
      showInGridByDefault: entry.showInGridByDefault ?? true,
      isCalculated: entry.isCalculated,
      formula: entry.formula,
      sourceParameterIds: entry.sourceParameterIds,
    };
  }

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
    isRestParameter: entry.isRestParameter,
    showInGridByDefault: entry.showInGridByDefault ?? true,
    isCalculated: entry.isCalculated,
    formula: entry.formula,
    sourceParameterIds: entry.sourceParameterIds,
  };
}

function migrateFrequencyParameter(entries: ToolboxEntry[]): ToolboxEntry[] {
  const byMethod = new Map<string, ToolboxEntry[]>();
  entries.forEach(entry => {
    const key = `${entry.category}::${entry.subCategory}`;
    if (!byMethod.has(key)) byMethod.set(key, []);
    byMethod.get(key)!.push(entry);
  });
  return entries.map(entry => {
    const methodKey = `${entry.category}::${entry.subCategory}`;
    const methodEntries = byMethod.get(methodKey) || [];
    const hasMarkedFrequency = methodEntries.some(e => e.isFrequencyParameter);
    if (!hasMarkedFrequency &&
        entry.parameterName.toLowerCase().includes('frequency') &&
        entry.parameterType === 'quantitative') {
      return { ...entry, isFrequencyParameter: true };
    }
    return entry;
  });
}

function migrateSetParameter(entries: ToolboxEntry[]): ToolboxEntry[] {
  const byMethod = new Map<string, ToolboxEntry[]>();
  entries.forEach(entry => {
    const key = `${entry.category}::${entry.subCategory}`;
    if (!byMethod.has(key)) byMethod.set(key, []);
    byMethod.get(key)!.push(entry);
  });
  return entries.map(entry => {
    const methodKey = `${entry.category}::${entry.subCategory}`;
    const methodEntries = byMethod.get(methodKey) || [];
    const hasMarkedSetParam = methodEntries.some(e => e.isSetParameter);
    if (hasMarkedSetParam) return entry;
    const paramNameLower = entry.parameterName.toLowerCase();
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

function migrateRestParameter(entries: ToolboxEntry[]): ToolboxEntry[] {
  const byMethod = new Map<string, ToolboxEntry[]>();
  entries.forEach(entry => {
    const key = `${entry.category}::${entry.subCategory}`;
    if (!byMethod.has(key)) byMethod.set(key, []);
    byMethod.get(key)!.push(entry);
  });
  return entries.map(entry => {
    const methodKey = `${entry.category}::${entry.subCategory}`;
    const methodEntries = byMethod.get(methodKey) || [];
    const hasMarkedRestParam = methodEntries.some(e => e.isRestParameter);
    if (hasMarkedRestParam) return entry;
    const paramNameLower = entry.parameterName.toLowerCase();
    const isRestLike =
      paramNameLower.includes('rest') ||
      paramNameLower.includes('pause') ||
      paramNameLower.includes('recovery');
    if (isRestLike && entry.parameterType === 'quantitative') {
      return { ...entry, isRestParameter: true, showInGridByDefault: false };
    }
    return entry;
  });
}

function applyAllMigrations(entries: LegacyToolboxEntry[]): ToolboxEntry[] {
  let migrated = entries.map(migrateLegacyEntry);
  migrated = migrateFrequencyParameter(migrated);
  migrated = migrateSetParameter(migrated);
  migrated = migrateRestParameter(migrated);
  return migrated;
}

function migrateToolboxData(raw: unknown): ToolboxDatabase {
  const r = raw as any;
  if (!r || !Array.isArray(r.entries)) return getDefaultMigratedData();
  return { ...r, entries: applyAllMigrations(r.entries) };
}

function getDefaultMigratedData(): ToolboxDatabase {
  return {
    ...defaultToolboxData,
    entries: applyAllMigrations(defaultToolboxData.entries as LegacyToolboxEntry[]),
  };
}

export function useToolboxData() {
  const [data, setData, isLoading] = useSupabaseStore<ToolboxDatabase>({
    tableName: 'toolbox_data',
    legacyKey: 'toolbox-data',
    defaultValue: getDefaultMigratedData(),
    migrate: migrateToolboxData,
  });

  const saveData = useCallback(async (newData: ToolboxDatabase) => {
    await setData({ ...newData, lastUpdated: new Date().toISOString() });
  }, [setData]);

  const addEntry = useCallback(async (entry: Omit<ToolboxEntry, 'id'>) => {
    const newEntry: ToolboxEntry = { ...entry, id: Date.now().toString() };
    await saveData({ ...data, entries: [...data.entries, newEntry] });
  }, [data, saveData]);

  const addEntries = useCallback(async (entries: Omit<ToolboxEntry, 'id'>[]) => {
    const newEntries = entries.map((e, i) => ({ ...e, id: (Date.now() + i).toString() }));
    await saveData({ ...data, entries: [...data.entries, ...newEntries] });
  }, [data, saveData]);

  const updateEntry = useCallback(async (id: string, entry: Partial<ToolboxEntry>) => {
    await saveData({
      ...data,
      entries: data.entries.map(e => e.id === id ? { ...e, ...entry } : e),
    });
  }, [data, saveData]);

  const deleteEntry = useCallback(async (id: string) => {
    await saveData({ ...data, entries: data.entries.filter(e => e.id !== id) });
  }, [data, saveData]);

  const copyEntry = useCallback(async (categorySubCategoryKey: string) => {
    const [category, subCategory] = categorySubCategoryKey.split('|||');
    const existingEntries = data.entries.filter(
      e => e.category === category && e.subCategory === subCategory
    );
    if (existingEntries.length === 0) return;
    const newSubCategory = `${subCategory} (Copy)`;
    const newEntries = existingEntries.map(entry => ({
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      subCategory: newSubCategory,
    }));
    await saveData({ ...data, entries: [...data.entries, ...newEntries] });
  }, [data, saveData]);

  const reorderParameters = useCallback(async (categorySubCategoryKey: string, reorderedParameters: ToolboxEntry[]) => {
    const [category, subCategory] = categorySubCategoryKey.split('|||');
    const otherEntries = data.entries.filter(
      e => !(e.category === category && e.subCategory === subCategory)
    );
    await saveData({ ...data, entries: [...otherEntries, ...reorderedParameters] });
  }, [data, saveData]);

  const importData = useCallback(async (tsvText: string): Promise<number> => {
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
        const bracketMatch = rawParameter.match(/^(.+?)\s*\[(.+?)\]$/);
        let parameterName: string;
        let options: string[];
        let parameterType: 'qualitative' | 'quantitative';
        if (bracketMatch) {
          parameterName = bracketMatch[1].trim();
          options = bracketMatch[2].split(',').map(opt => opt.trim());
          const hasUnits = options.some(opt => /^(m|km|s|min|h|%|kg|lbs|reps?|sets?|#)$/i.test(opt));
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
          options,
        };
        if (entry.category && entry.parameterName) newEntries.push(entry);
      }
    }

    let migrated = migrateFrequencyParameter(newEntries);
    migrated = migrateSetParameter(migrated);
    await saveData({ ...data, entries: [...data.entries, ...migrated] });
    return migrated.length;
  }, [data, saveData]);

  const exportData = useCallback((): string => {
    const headers = ['Category', 'Sub-Category', 'Parameter', 'Type'];
    const rows = data.entries.map(entry => {
      const paramWithOptions = entry.options.length > 0
        ? `${entry.parameterName} [${entry.options.join(', ')}]`
        : entry.parameterName;
      return [entry.category, entry.subCategory, paramWithOptions, entry.parameterType];
    });
    return [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
  }, [data.entries]);

  return {
    data,
    isLoading,
    addEntry,
    addEntries,
    updateEntry,
    deleteEntry,
    copyEntry,
    reorderParameters,
    importData,
    exportData,
    saveData,
  };
}
