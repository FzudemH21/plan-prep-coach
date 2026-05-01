import { useCallback } from 'react';
import { useSupabaseStore } from './useSupabaseStore';
import { ParametersDatabaseV2, ParameterV2, ParameterInteraction, ParameterMethodV2, InteractionDirection, InteractionStrength } from '@/types/parametersV2';

const LEGACY_KEY = 'parameters-database-v2';
const OLD_LEGACY_KEY = 'goals-database-v2';

const defaultDatabase: ParametersDatabaseV2 = {
  parameters: [],
  interactions: [],
  parameterMethods: [],
  lastUpdated: new Date().toISOString(),
};

// ─── Migration helpers (same logic as before, applied on legacy load) ─────────

function migrateFromGoals(oldData: any): ParametersDatabaseV2 {
  return {
    parameters: (oldData.goals || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      unit: g.unit,
      category: g.category,
      createdAt: g.createdAt,
    })),
    interactions: (oldData.interactions || []).map((i: any) => ({
      id: i.id,
      sourceParameterId: i.goalId,
      targetParameterId: i.interactingGoalId,
      direction: 'contributes_to' as InteractionDirection,
      strength: 'moderate' as InteractionStrength,
    })),
    parameterMethods: (oldData.goalMethods || []).map((m: any) => ({
      id: m.id,
      parameterId: m.goalId,
      methodId: m.methodId,
      rationale: m.rationale,
    })),
    lastUpdated: oldData.lastUpdated || new Date().toISOString(),
  };
}

function migrateToDirectional(data: ParametersDatabaseV2): ParametersDatabaseV2 {
  return {
    ...data,
    interactions: data.interactions.map((i: any) => {
      if (i.sourceParameterId && i.targetParameterId && i.direction) return i;
      return {
        id: i.id,
        sourceParameterId: i.parameterId || i.sourceParameterId,
        targetParameterId: i.interactingParameterId || i.targetParameterId,
        direction: i.direction || ('contributes_to' as InteractionDirection),
        strength: i.strength || ('moderate' as InteractionStrength),
      };
    }),
  };
}

function migrateLegacy(raw: unknown): ParametersDatabaseV2 {
  // Try the very old goals format first
  const r = raw as any;
  let db: ParametersDatabaseV2;
  if (r && 'goals' in r) {
    db = migrateFromGoals(r);
  } else {
    db = r as ParametersDatabaseV2;
  }
  // Also check for old key in localStorage (one-time migration)
  if (!r && typeof window !== 'undefined') {
    const oldRaw = localStorage.getItem(OLD_LEGACY_KEY);
    if (oldRaw) {
      try {
        db = migrateFromGoals(JSON.parse(oldRaw));
        localStorage.removeItem(OLD_LEGACY_KEY);
      } catch { db = defaultDatabase; }
    }
  }
  return migrateToDirectional(db ?? defaultDatabase);
}

export function useParametersDataV2() {
  const [data, setData, isLoading] = useSupabaseStore<ParametersDatabaseV2>({
    tableName: 'parameters_database',
    legacyKey: LEGACY_KEY,
    defaultValue: defaultDatabase,
    migrate: migrateLegacy,
  });

  const saveData = useCallback(async (newData: ParametersDatabaseV2) => {
    await setData({ ...newData, lastUpdated: new Date().toISOString() });
  }, [setData]);

  // ── Parameter CRUD ────────────────────────────────────────────────────────

  const addParameter = useCallback(async (parameter: Omit<ParameterV2, 'id' | 'createdAt'>) => {
    const newParameter: ParameterV2 = {
      ...parameter,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    await saveData({ ...data, parameters: [...data.parameters, newParameter] });
    return newParameter;
  }, [data, saveData]);

  const updateParameter = useCallback(async (id: string, updates: Partial<ParameterV2>) => {
    await saveData({
      ...data,
      parameters: data.parameters.map(p => p.id === id ? { ...p, ...updates } : p),
    });
  }, [data, saveData]);

  const deleteParameter = useCallback(async (id: string) => {
    await saveData({
      ...data,
      parameters: data.parameters.filter(p => p.id !== id),
      interactions: data.interactions.filter(i => i.sourceParameterId !== id && i.targetParameterId !== id),
      parameterMethods: data.parameterMethods.filter(m => m.parameterId !== id),
    });
  }, [data, saveData]);

  // ── Interaction CRUD ──────────────────────────────────────────────────────

  const addInteraction = useCallback(async (
    sourceParameterId: string,
    targetParameterId: string,
    direction: InteractionDirection = 'contributes_to',
    strength: InteractionStrength = 'moderate',
  ) => {
    const exists = data.interactions.some(
      i => i.sourceParameterId === sourceParameterId &&
           i.targetParameterId === targetParameterId &&
           i.direction === direction
    );
    if (exists) return;
    const newInteraction: ParameterInteraction = {
      id: Date.now().toString(),
      sourceParameterId,
      targetParameterId,
      direction,
      strength,
    };
    await saveData({ ...data, interactions: [...data.interactions, newInteraction] });
  }, [data, saveData]);

  const updateInteraction = useCallback(async (id: string, updates: Partial<ParameterInteraction>) => {
    await saveData({
      ...data,
      interactions: data.interactions.map(i => i.id === id ? { ...i, ...updates } : i),
    });
  }, [data, saveData]);

  const removeInteraction = useCallback(async (id: string) => {
    await saveData({ ...data, interactions: data.interactions.filter(i => i.id !== id) });
  }, [data, saveData]);

  const getContributesToParameters = useCallback((sourceParameterId: string) =>
    data.interactions.filter(i => i.sourceParameterId === sourceParameterId && i.direction === 'contributes_to'),
  [data.interactions]);

  const getImprovedByParameters = useCallback((targetParameterId: string) =>
    data.interactions.filter(i => i.targetParameterId === targetParameterId && i.direction === 'contributes_to'),
  [data.interactions]);

  const getInteractionsForParameter = useCallback((parameterId: string) =>
    data.interactions.filter(i => i.sourceParameterId === parameterId || i.targetParameterId === parameterId),
  [data.interactions]);

  // ── Parameter Method CRUD ─────────────────────────────────────────────────

  const addParameterMethod = useCallback(async (parameterId: string, methodId: string, rationale?: string) => {
    const exists = data.parameterMethods.some(m => m.parameterId === parameterId && m.methodId === methodId);
    if (exists) return;
    const newMethod: ParameterMethodV2 = { id: Date.now().toString(), parameterId, methodId, rationale };
    await saveData({ ...data, parameterMethods: [...data.parameterMethods, newMethod] });
  }, [data, saveData]);

  const updateParameterMethod = useCallback(async (id: string, updates: Partial<ParameterMethodV2>) => {
    await saveData({
      ...data,
      parameterMethods: data.parameterMethods.map(m => m.id === id ? { ...m, ...updates } : m),
    });
  }, [data, saveData]);

  const removeParameterMethod = useCallback(async (id: string) => {
    await saveData({ ...data, parameterMethods: data.parameterMethods.filter(m => m.id !== id) });
  }, [data, saveData]);

  const getMethodsForParameter = useCallback((parameterId: string) =>
    data.parameterMethods.filter(m => m.parameterId === parameterId),
  [data.parameterMethods]);

  return {
    data,
    isLoading,
    addParameter,
    updateParameter,
    deleteParameter,
    addInteraction,
    updateInteraction,
    removeInteraction,
    getInteractionsForParameter,
    getContributesToParameters,
    getImprovedByParameters,
    addParameterMethod,
    updateParameterMethod,
    removeParameterMethod,
    getMethodsForParameter,
    saveData,
  };
}
