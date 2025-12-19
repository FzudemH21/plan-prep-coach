import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  Athlete,
  AthleteGroup,
  AthleteParameter,
  ParameterDefinition,
  ParameterValue,
  DEFAULT_PARAMETERS,
} from '@/types/athlete';

interface AthleteDatabase {
  groups: AthleteGroup[];
  athletes: Athlete[];
  parameterDefinitions: ParameterDefinition[];
  athleteParameters: AthleteParameter[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getInitialData = (): AthleteDatabase => {
  const now = new Date().toISOString();
  const defaultDefs: ParameterDefinition[] = DEFAULT_PARAMETERS.map((p, i) => ({
    id: `default-param-${i}`,
    name: p.name,
    type: p.type,
    unit: p.unit,
    createdAt: now,
  }));

  return {
    groups: [],
    athletes: [],
    parameterDefinitions: defaultDefs,
    athleteParameters: [],
  };
};

export function useAthletes() {
  const [data, setData] = useLocalStorage<AthleteDatabase>('athlete-database', getInitialData());

  // Groups
  const createGroup = useCallback((name: string): AthleteGroup => {
    const group: AthleteGroup = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, groups: [...prev.groups, group] }));
    return group;
  }, [setData]);

  const updateGroup = useCallback((id: string, name: string) => {
    setData((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === id ? { ...g, name } : g)),
    }));
  }, [setData]);

  const deleteGroup = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== id),
      athletes: prev.athletes.map((a) => ({
        ...a,
        groupIds: a.groupIds.filter((gId) => gId !== id),
      })),
    }));
  }, [setData]);

  // Athletes
  const createAthlete = useCallback((athlete: Omit<Athlete, 'id' | 'createdAt' | 'updatedAt'>): Athlete => {
    const now = new Date().toISOString();
    const athleteId = generateId();
    const newAthlete: Athlete = {
      ...athlete,
      id: athleteId,
      createdAt: now,
      updatedAt: now,
    };
    
    // Find Height and Weight parameter definitions
    const heightDef = data.parameterDefinitions.find(d => d.name === 'Height');
    const weightDef = data.parameterDefinitions.find(d => d.name === 'Weight');
    
    // Auto-create Height and Weight parameters for new athlete
    const newParams: AthleteParameter[] = [];
    if (heightDef) {
      newParams.push({
        id: generateId(),
        athleteId,
        parameterDefinitionId: heightDef.id,
        values: [],
      });
    }
    if (weightDef) {
      newParams.push({
        id: generateId(),
        athleteId,
        parameterDefinitionId: weightDef.id,
        values: [],
      });
    }
    
    setData((prev) => ({ 
      ...prev, 
      athletes: [...prev.athletes, newAthlete],
      athleteParameters: [...prev.athleteParameters, ...newParams],
    }));
    return newAthlete;
  }, [setData, data.parameterDefinitions]);

  const updateAthlete = useCallback((id: string, updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>) => {
    setData((prev) => ({
      ...prev,
      athletes: prev.athletes.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
      ),
    }));
  }, [setData]);

  const deleteAthlete = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      athletes: prev.athletes.filter((a) => a.id !== id),
      athleteParameters: prev.athleteParameters.filter((ap) => ap.athleteId !== id),
    }));
  }, [setData]);

  // Parameter Definitions
  const createParameterDefinition = useCallback((def: Omit<ParameterDefinition, 'id' | 'createdAt'>): ParameterDefinition => {
    const newDef: ParameterDefinition = {
      ...def,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      parameterDefinitions: [...prev.parameterDefinitions, newDef],
    }));
    return newDef;
  }, [setData]);

  const deleteParameterDefinition = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      parameterDefinitions: prev.parameterDefinitions.filter((pd) => pd.id !== id),
      athleteParameters: prev.athleteParameters.filter((ap) => ap.parameterDefinitionId !== id),
    }));
  }, [setData]);

  // Athlete Parameters
  const addParameterToAthlete = useCallback((athleteId: string, parameterDefinitionId: string): AthleteParameter => {
    const existing = data.athleteParameters.find(
      (ap) => ap.athleteId === athleteId && ap.parameterDefinitionId === parameterDefinitionId
    );
    if (existing) return existing;

    const newAp: AthleteParameter = {
      id: generateId(),
      athleteId,
      parameterDefinitionId,
      values: [],
    };
    setData((prev) => ({
      ...prev,
      athleteParameters: [...prev.athleteParameters, newAp],
    }));
    return newAp;
  }, [data.athleteParameters, setData]);

  const removeParameterFromAthlete = useCallback((athleteParameterId: string) => {
    setData((prev) => ({
      ...prev,
      athleteParameters: prev.athleteParameters.filter((ap) => ap.id !== athleteParameterId),
    }));
  }, [setData]);

  const addParameterValue = useCallback((athleteParameterId: string, value: string): ParameterValue => {
    const newValue: ParameterValue = {
      id: generateId(),
      value,
      recordedAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      athleteParameters: prev.athleteParameters.map((ap) =>
        ap.id === athleteParameterId
          ? { ...ap, values: [...ap.values, newValue] }
          : ap
      ),
    }));
    return newValue;
  }, [setData]);

  const updateParameterValue = useCallback((athleteParameterId: string, valueId: string, newValue: string) => {
    setData((prev) => ({
      ...prev,
      athleteParameters: prev.athleteParameters.map((ap) =>
        ap.id === athleteParameterId
          ? {
              ...ap,
              values: ap.values.map((v) =>
                v.id === valueId ? { ...v, value: newValue } : v
              ),
            }
          : ap
      ),
    }));
  }, [setData]);

  const deleteParameterValue = useCallback((athleteParameterId: string, valueId: string) => {
    setData((prev) => ({
      ...prev,
      athleteParameters: prev.athleteParameters.map((ap) =>
        ap.id === athleteParameterId
          ? { ...ap, values: ap.values.filter((v) => v.id !== valueId) }
          : ap
      ),
    }));
  }, [setData]);

  // Helper functions
  const getAthletesByGroup = useCallback((groupId: string) => {
    return data.athletes.filter((a) => a.groupIds.includes(groupId));
  }, [data.athletes]);

  const getAthletesWithoutGroup = useCallback(() => {
    return data.athletes.filter((a) => a.groupIds.length === 0);
  }, [data.athletes]);

  const getAthleteParameters = useCallback((athleteId: string) => {
    return data.athleteParameters.filter((ap) => ap.athleteId === athleteId);
  }, [data.athleteParameters]);

  const getParameterDefinition = useCallback((id: string) => {
    return data.parameterDefinitions.find((pd) => pd.id === id);
  }, [data.parameterDefinitions]);

  const getAthlete = useCallback((id: string) => {
    return data.athletes.find((a) => a.id === id);
  }, [data.athletes]);

  return {
    // Data
    groups: data.groups,
    athletes: data.athletes,
    parameterDefinitions: data.parameterDefinitions,
    athleteParameters: data.athleteParameters,

    // Group operations
    createGroup,
    updateGroup,
    deleteGroup,

    // Athlete operations
    createAthlete,
    updateAthlete,
    deleteAthlete,
    getAthlete,
    getAthletesByGroup,
    getAthletesWithoutGroup,

    // Parameter definition operations
    createParameterDefinition,
    deleteParameterDefinition,
    getParameterDefinition,

    // Athlete parameter operations
    addParameterToAthlete,
    removeParameterFromAthlete,
    getAthleteParameters,

    // Value operations
    addParameterValue,
    updateParameterValue,
    deleteParameterValue,
  };
}
