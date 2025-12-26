import { useState, useEffect } from 'react';
import { ParametersDatabaseV2, ParameterV2, ParameterInteraction, ParameterMethodV2 } from '@/types/parametersV2';

const STORAGE_KEY = 'parameters-database-v2';
const OLD_STORAGE_KEY = 'goals-database-v2';

const defaultDatabase: ParametersDatabaseV2 = {
  parameters: [],
  interactions: [],
  parameterMethods: [],
  lastUpdated: new Date().toISOString(),
};

// Migration function to convert old goal data to new parameter format
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
      parameterId: i.goalId,
      interactingParameterId: i.interactingGoalId,
    })),
    parameterMethods: (oldData.goalMethods || []).map((m: any) => ({
      id: m.id,
      parameterId: m.goalId,
      methodId: m.methodId,
      rationale: m.rationale,
      // Note: loadingRecommendations is intentionally dropped
    })),
    lastUpdated: oldData.lastUpdated || new Date().toISOString(),
  };
}

export function useParametersDataV2() {
  const [data, setData] = useState<ParametersDatabaseV2>(defaultDatabase);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try new key first
    let stored = localStorage.getItem(STORAGE_KEY);
    
    // If not found, try migrating from old key
    if (!stored) {
      const oldStored = localStorage.getItem(OLD_STORAGE_KEY);
      if (oldStored) {
        try {
          const oldParsed = JSON.parse(oldStored);
          const migrated = migrateFromGoals(oldParsed);
          // Save to new key
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          // Remove old key
          localStorage.removeItem(OLD_STORAGE_KEY);
          setData(migrated);
          setIsLoading(false);
          return;
        } catch (error) {
          console.error('Failed to migrate old goals data:', error);
        }
      }
    }
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData(parsed);
      } catch (error) {
        console.error('Failed to parse stored parameters data:', error);
        setData(defaultDatabase);
      }
    }
    setIsLoading(false);
  }, []);

  const saveData = (newData: ParametersDatabaseV2) => {
    const updatedData = {
      ...newData,
      lastUpdated: new Date().toISOString(),
    };
    setData(updatedData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
  };

  // Parameter CRUD
  const addParameter = (parameter: Omit<ParameterV2, 'id' | 'createdAt'>) => {
    const newParameter: ParameterV2 = {
      ...parameter,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    saveData({
      ...data,
      parameters: [...data.parameters, newParameter],
    });
    return newParameter;
  };

  const updateParameter = (id: string, updates: Partial<ParameterV2>) => {
    const newParameters = data.parameters.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    saveData({ ...data, parameters: newParameters });
  };

  const deleteParameter = (id: string) => {
    // Also delete related interactions and methods
    const newParameters = data.parameters.filter((p) => p.id !== id);
    const newInteractions = data.interactions.filter(
      (i) => i.parameterId !== id && i.interactingParameterId !== id
    );
    const newParameterMethods = data.parameterMethods.filter((m) => m.parameterId !== id);
    saveData({
      ...data,
      parameters: newParameters,
      interactions: newInteractions,
      parameterMethods: newParameterMethods,
    });
  };

  // Interaction CRUD
  const addInteraction = (parameterId: string, interactingParameterId: string) => {
    // Prevent duplicates
    const exists = data.interactions.some(
      (i) => i.parameterId === parameterId && i.interactingParameterId === interactingParameterId
    );
    if (exists) return;

    const newInteraction: ParameterInteraction = {
      id: Date.now().toString(),
      parameterId,
      interactingParameterId,
    };
    saveData({
      ...data,
      interactions: [...data.interactions, newInteraction],
    });
  };

  const removeInteraction = (id: string) => {
    const newInteractions = data.interactions.filter((i) => i.id !== id);
    saveData({ ...data, interactions: newInteractions });
  };

  const getInteractionsForParameter = (parameterId: string) => {
    return data.interactions.filter((i) => i.parameterId === parameterId);
  };

  // Parameter Method CRUD
  const addParameterMethod = (
    parameterId: string,
    methodId: string,
    rationale?: string
  ) => {
    // Prevent duplicates
    const exists = data.parameterMethods.some(
      (m) => m.parameterId === parameterId && m.methodId === methodId
    );
    if (exists) return;

    const newMethod: ParameterMethodV2 = {
      id: Date.now().toString(),
      parameterId,
      methodId,
      rationale,
    };
    saveData({
      ...data,
      parameterMethods: [...data.parameterMethods, newMethod],
    });
  };

  const updateParameterMethod = (id: string, updates: Partial<ParameterMethodV2>) => {
    const newMethods = data.parameterMethods.map((m) =>
      m.id === id ? { ...m, ...updates } : m
    );
    saveData({ ...data, parameterMethods: newMethods });
  };

  const removeParameterMethod = (id: string) => {
    const newMethods = data.parameterMethods.filter((m) => m.id !== id);
    saveData({ ...data, parameterMethods: newMethods });
  };

  const getMethodsForParameter = (parameterId: string) => {
    return data.parameterMethods.filter((m) => m.parameterId === parameterId);
  };

  return {
    data,
    isLoading,
    // Parameter operations
    addParameter,
    updateParameter,
    deleteParameter,
    // Interaction operations
    addInteraction,
    removeInteraction,
    getInteractionsForParameter,
    // Method operations
    addParameterMethod,
    updateParameterMethod,
    removeParameterMethod,
    getMethodsForParameter,
    // Raw save for bulk operations
    saveData,
  };
}
