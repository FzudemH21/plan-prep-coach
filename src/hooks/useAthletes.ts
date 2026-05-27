import { useCallback, useMemo } from 'react';
import { useSupabaseStore } from './useSupabaseStore';
import {
  Athlete,
  AthleteGroup,
  AthleteBiometric,
  BiometricDefinition,
  ParameterValue,
  DEFAULT_BIOMETRICS,
  AthletePerformanceParameter,
  AthleteCalendarAssignment,
} from '@/types/athlete';

interface AthleteDatabase {
  groups: AthleteGroup[];
  athletes: Athlete[];
  biometricDefinitions: BiometricDefinition[];
  athleteBiometrics: AthleteBiometric[];
  athletePerformanceParameters: AthletePerformanceParameter[];
  calendarAssignments: AthleteCalendarAssignment[];
}

interface LegacyAthleteDatabase {
  groups: AthleteGroup[];
  athletes: Athlete[];
  parameterDefinitions?: BiometricDefinition[];
  athleteParameters?: AthleteBiometric[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const migrateData = (data: LegacyAthleteDatabase | AthleteDatabase): AthleteDatabase => {
  if ('parameterDefinitions' in data && !('biometricDefinitions' in data)) {
    const migratedBiometrics = (data.athleteParameters || []).map(ap => ({
      ...ap,
      biometricDefinitionId: (ap as any).parameterDefinitionId || ap.biometricDefinitionId,
      parameterDefinitionId: (ap as any).parameterDefinitionId || ap.biometricDefinitionId,
    }));
    return {
      groups: data.groups || [],
      athletes: (data.athletes || []).map(a => ({ ...a, groupIds: a.groupIds ?? [] })),
      biometricDefinitions: data.parameterDefinitions || [],
      athleteBiometrics: migratedBiometrics,
      athletePerformanceParameters: [],
      calendarAssignments: [],
    };
  }

  const biometrics = ((data as AthleteDatabase).athleteBiometrics || []).map(ab => ({
    ...ab,
    parameterDefinitionId: ab.parameterDefinitionId || ab.biometricDefinitionId,
  }));

  return {
    groups: data.groups || [],
    athletes: (data.athletes || []).map(a => ({ ...a, groupIds: a.groupIds ?? [] })),
    biometricDefinitions: ensureDefaultBiometrics((data as AthleteDatabase).biometricDefinitions || []),
    athleteBiometrics: biometrics,
    athletePerformanceParameters: (data as AthleteDatabase).athletePerformanceParameters || [],
    calendarAssignments: (data as AthleteDatabase).calendarAssignments || [],
  };
};

function getInitialData(): AthleteDatabase {
  const now = new Date().toISOString();
  const defaultDefs: BiometricDefinition[] = DEFAULT_BIOMETRICS.map((p, i) => ({
    id: `default-param-${i}`,
    name: p.name,
    type: p.type,
    unit: p.unit,
    isSystem: p.isSystem,
    createdAt: now,
  }));
  return {
    groups: [],
    athletes: [],
    biometricDefinitions: defaultDefs,
    athleteBiometrics: [],
    athletePerformanceParameters: [],
    calendarAssignments: [],
  };
}

/**
 * Ensures existing databases have all expected default biometric definitions.
 * Adds any missing defaults (e.g. Body Fat, Resting Heart Rate added in a later version).
 * Also stamps isSystem on Height/Weight if missing.
 */
function ensureDefaultBiometrics(defs: BiometricDefinition[]): BiometricDefinition[] {
  let result = defs.map(d => {
    // Stamp isSystem on Height/Weight if not already set
    if (d.name === 'Height' || d.name === 'Weight') {
      return { ...d, isSystem: true };
    }
    return d;
  });
  const now = new Date().toISOString();
  DEFAULT_BIOMETRICS.forEach((p, i) => {
    if (!result.some(d => d.name === p.name)) {
      result = [...result, {
        id: `default-param-${i}`,
        name: p.name,
        type: p.type,
        unit: p.unit,
        isSystem: p.isSystem,
        createdAt: now,
      }];
    }
  });
  return result;
}

export function useAthletes() {
  const [rawData, setRawData, isLoading] = useSupabaseStore<AthleteDatabase | LegacyAthleteDatabase>({
    tableName: 'athlete_database',
    legacyKey: 'athlete-database',
    defaultValue: getInitialData(),
    migrate: (raw) => migrateData(raw as LegacyAthleteDatabase | AthleteDatabase),
  });

  const data = useMemo(() => migrateData(rawData), [rawData]);

  const setData = useCallback(
    async (updater: (prev: AthleteDatabase) => AthleteDatabase) => {
      await setRawData(updater(migrateData(rawData)));
    },
    [rawData, setRawData],
  );

  // ── Groups ────────────────────────────────────────────────────────────────

  const createGroup = useCallback(async (name: string): Promise<AthleteGroup> => {
    const group: AthleteGroup = { id: generateId(), name, createdAt: new Date().toISOString() };
    await setData(prev => ({ ...prev, groups: [...prev.groups, group] }));
    return group;
  }, [setData]);

  const updateGroup = useCallback(async (id: string, name: string) => {
    await setData(prev => ({ ...prev, groups: prev.groups.map(g => g.id === id ? { ...g, name } : g) }));
  }, [setData]);

  const deleteGroup = useCallback(async (id: string) => {
    await setData(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== id),
      athletes: prev.athletes.map(a => ({ ...a, groupIds: a.groupIds.filter(gId => gId !== id) })),
    }));
  }, [setData]);

  // ── Athletes ──────────────────────────────────────────────────────────────

  const createAthlete = useCallback(async (athlete: Omit<Athlete, 'id' | 'createdAt' | 'updatedAt'>): Promise<Athlete> => {
    const now = new Date().toISOString();
    const athleteId = generateId();
    const newAthlete: Athlete = { ...athlete, id: athleteId, isArchived: athlete.isArchived ?? false, createdAt: now, updatedAt: now };

    const heightDef = data.biometricDefinitions.find(d => d.name === 'Height');
    const weightDef = data.biometricDefinitions.find(d => d.name === 'Weight');
    const newBiometrics: AthleteBiometric[] = [];
    if (heightDef) newBiometrics.push({ id: generateId(), athleteId, biometricDefinitionId: heightDef.id, parameterDefinitionId: heightDef.id, values: [] });
    if (weightDef) newBiometrics.push({ id: generateId(), athleteId, biometricDefinitionId: weightDef.id, parameterDefinitionId: weightDef.id, values: [] });

    await setData(prev => ({
      ...prev,
      athletes: [...prev.athletes, newAthlete],
      athleteBiometrics: [...prev.athleteBiometrics, ...newBiometrics],
    }));
    return newAthlete;
  }, [setData, data.biometricDefinitions]);

  const updateAthlete = useCallback(async (id: string, updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>) => {
    await setData(prev => ({
      ...prev,
      athletes: prev.athletes.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a),
    }));
  }, [setData]);

  const deleteAthlete = useCallback(async (id: string) => {
    await setData(prev => ({
      ...prev,
      athletes: prev.athletes.filter(a => a.id !== id),
      athleteBiometrics: prev.athleteBiometrics.filter(ab => ab.athleteId !== id),
      athletePerformanceParameters: prev.athletePerformanceParameters.filter(pp => pp.athleteId !== id),
      calendarAssignments: prev.calendarAssignments.filter(ca => ca.athleteId !== id),
    }));
  }, [setData]);

  // ── Biometric Definitions ─────────────────────────────────────────────────

  const createBiometricDefinition = useCallback(async (def: Omit<BiometricDefinition, 'id' | 'createdAt'>): Promise<BiometricDefinition> => {
    const newDef: BiometricDefinition = { ...def, id: generateId(), createdAt: new Date().toISOString() };
    await setData(prev => ({ ...prev, biometricDefinitions: [...prev.biometricDefinitions, newDef] }));
    return newDef;
  }, [setData]);

  const deleteBiometricDefinition = useCallback(async (id: string) => {
    await setData(prev => ({
      ...prev,
      biometricDefinitions: prev.biometricDefinitions.filter(bd => bd.id !== id),
      athleteBiometrics: prev.athleteBiometrics.filter(ab => ab.biometricDefinitionId !== id),
    }));
  }, [setData]);

  // ── Athlete Biometrics ────────────────────────────────────────────────────

  const addBiometricToAthlete = useCallback(async (athleteId: string, biometricDefinitionId: string): Promise<AthleteBiometric> => {
    const existing = data.athleteBiometrics.find(ab => ab.athleteId === athleteId && ab.biometricDefinitionId === biometricDefinitionId);
    if (existing) return existing;
    const newAb: AthleteBiometric = { id: generateId(), athleteId, biometricDefinitionId, parameterDefinitionId: biometricDefinitionId, values: [] };
    await setData(prev => ({ ...prev, athleteBiometrics: [...prev.athleteBiometrics, newAb] }));
    return newAb;
  }, [data.athleteBiometrics, setData]);

  const removeBiometricFromAthlete = useCallback(async (athleteBiometricId: string) => {
    await setData(prev => ({ ...prev, athleteBiometrics: prev.athleteBiometrics.filter(ab => ab.id !== athleteBiometricId) }));
  }, [setData]);

  const addBiometricValue = useCallback(async (athleteBiometricId: string, value: string, recordedAt?: string): Promise<ParameterValue> => {
    const newValue: ParameterValue = { id: generateId(), value, recordedAt: recordedAt ?? new Date().toISOString() };
    await setData(prev => ({
      ...prev,
      athleteBiometrics: prev.athleteBiometrics.map(ab =>
        ab.id === athleteBiometricId ? { ...ab, values: [...ab.values, newValue] } : ab
      ),
    }));
    return newValue;
  }, [setData]);

  const updateBiometricValue = useCallback(async (athleteBiometricId: string, valueId: string, newValue: string) => {
    await setData(prev => ({
      ...prev,
      athleteBiometrics: prev.athleteBiometrics.map(ab =>
        ab.id === athleteBiometricId
          ? { ...ab, values: ab.values.map(v => v.id === valueId ? { ...v, value: newValue } : v) }
          : ab
      ),
    }));
  }, [setData]);

  const deleteBiometricValue = useCallback(async (athleteBiometricId: string, valueId: string) => {
    await setData(prev => ({
      ...prev,
      athleteBiometrics: prev.athleteBiometrics.map(ab =>
        ab.id === athleteBiometricId ? { ...ab, values: ab.values.filter(v => v.id !== valueId) } : ab
      ),
    }));
  }, [setData]);

  // ── Performance Parameters ────────────────────────────────────────────────

  const addPerformanceParameter = useCallback(async (athleteId: string, athleticismParameterId: string): Promise<AthletePerformanceParameter> => {
    const existing = data.athletePerformanceParameters.find(pp => pp.athleteId === athleteId && pp.athleticismParameterId === athleticismParameterId);
    if (existing) return existing;
    const newPp: AthletePerformanceParameter = { id: generateId(), athleteId, athleticismParameterId, values: [] };
    await setData(prev => ({ ...prev, athletePerformanceParameters: [...prev.athletePerformanceParameters, newPp] }));
    return newPp;
  }, [data.athletePerformanceParameters, setData]);

  const removePerformanceParameter = useCallback(async (performanceParameterId: string) => {
    await setData(prev => ({ ...prev, athletePerformanceParameters: prev.athletePerformanceParameters.filter(pp => pp.id !== performanceParameterId) }));
  }, [setData]);

  const addPerformanceParameterValue = useCallback(async (performanceParameterId: string, value: string, recordedAt?: string): Promise<ParameterValue> => {
    const newValue: ParameterValue = { id: generateId(), value, recordedAt: recordedAt ?? new Date().toISOString() };
    await setData(prev => ({
      ...prev,
      athletePerformanceParameters: prev.athletePerformanceParameters.map(pp =>
        pp.id === performanceParameterId ? { ...pp, values: [...pp.values, newValue] } : pp
      ),
    }));
    return newValue;
  }, [setData]);

  const updatePerformanceParameterValue = useCallback(async (performanceParameterId: string, valueId: string, newValue: string) => {
    await setData(prev => ({
      ...prev,
      athletePerformanceParameters: prev.athletePerformanceParameters.map(pp =>
        pp.id === performanceParameterId
          ? { ...pp, values: pp.values.map(v => v.id === valueId ? { ...v, value: newValue } : v) }
          : pp
      ),
    }));
  }, [setData]);

  const deletePerformanceParameterValue = useCallback(async (performanceParameterId: string, valueId: string) => {
    await setData(prev => ({
      ...prev,
      athletePerformanceParameters: prev.athletePerformanceParameters.map(pp =>
        pp.id === performanceParameterId ? { ...pp, values: pp.values.filter(v => v.id !== valueId) } : pp
      ),
    }));
  }, [setData]);

  // ── Archive ───────────────────────────────────────────────────────────────

  const archiveAthlete = useCallback(async (id: string) => {
    await setData(prev => ({ ...prev, athletes: prev.athletes.map(a => a.id === id ? { ...a, isArchived: true, updatedAt: new Date().toISOString() } : a) }));
  }, [setData]);

  const unarchiveAthlete = useCallback(async (id: string) => {
    await setData(prev => ({ ...prev, athletes: prev.athletes.map(a => a.id === id ? { ...a, isArchived: false, updatedAt: new Date().toISOString() } : a) }));
  }, [setData]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getArchivedAthletes = useCallback(() => data.athletes.filter(a => a.isArchived === true), [data.athletes]);
  const getAthletesByGroup = useCallback((groupId: string) => data.athletes.filter(a => a.groupIds.includes(groupId) && !a.isArchived), [data.athletes]);
  const getAthletesWithoutGroup = useCallback(() => data.athletes.filter(a => a.groupIds.length === 0 && !a.isArchived), [data.athletes]);
  const getAthleteBiometrics = useCallback((athleteId: string) => data.athleteBiometrics.filter(ab => ab.athleteId === athleteId), [data.athleteBiometrics]);
  const getBiometricDefinition = useCallback((id: string) => data.biometricDefinitions.find(bd => bd.id === id), [data.biometricDefinitions]);
  const getAthletePerformanceParameters = useCallback((athleteId: string) => data.athletePerformanceParameters.filter(pp => pp.athleteId === athleteId), [data.athletePerformanceParameters]);
  const getAthlete = useCallback((id: string) => data.athletes.find(a => a.id === id), [data.athletes]);

  // ── Calendar Assignments ──────────────────────────────────────────────────

  const createCalendarAssignment = useCallback(async (athleteId: string, assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>): Promise<AthleteCalendarAssignment> => {
    const newAssignment: AthleteCalendarAssignment = { ...assignment, id: generateId(), createdAt: new Date().toISOString() };
    await setData(prev => ({ ...prev, calendarAssignments: [...prev.calendarAssignments, newAssignment] }));
    return newAssignment;
  }, [setData]);

  const updateCalendarAssignment = useCallback(async (id: string, updates: Partial<AthleteCalendarAssignment>) => {
    await setData(prev => ({
      ...prev,
      calendarAssignments: prev.calendarAssignments.map(ca => ca.id === id ? { ...ca, ...updates } : ca),
    }));
  }, [setData]);

  const deleteCalendarAssignment = useCallback(async (id: string) => {
    await setData(prev => ({ ...prev, calendarAssignments: prev.calendarAssignments.filter(ca => ca.id !== id) }));
  }, [setData]);

  const getAthleteCalendarAssignments = useCallback((athleteId: string) => data.calendarAssignments.filter(ca => ca.athleteId === athleteId), [data.calendarAssignments]);

  // ── Legacy aliases ────────────────────────────────────────────────────────

  const parameterDefinitions = data.biometricDefinitions;
  const athleteParameters = data.athleteBiometrics;
  const createParameterDefinition = createBiometricDefinition;
  const deleteParameterDefinition = deleteBiometricDefinition;
  const getParameterDefinition = getBiometricDefinition;
  const addParameterToAthlete = addBiometricToAthlete;
  const removeParameterFromAthlete = removeBiometricFromAthlete;
  const getAthleteParameters = getAthleteBiometrics;
  const addParameterValue = addBiometricValue;
  const updateParameterValue = updateBiometricValue;
  const deleteParameterValue = deleteBiometricValue;

  return {
    groups: data.groups,
    athletes: data.athletes,
    biometricDefinitions: data.biometricDefinitions,
    athleteBiometrics: data.athleteBiometrics,
    athletePerformanceParameters: data.athletePerformanceParameters,
    calendarAssignments: data.calendarAssignments,
    isLoading,

    parameterDefinitions,
    athleteParameters,

    createGroup, updateGroup, deleteGroup,
    createAthlete, updateAthlete, deleteAthlete, getAthlete,
    getAthletesByGroup, getAthletesWithoutGroup,
    archiveAthlete, unarchiveAthlete, getArchivedAthletes,

    createBiometricDefinition, deleteBiometricDefinition, getBiometricDefinition,
    createParameterDefinition, deleteParameterDefinition, getParameterDefinition,

    addBiometricToAthlete, removeBiometricFromAthlete, getAthleteBiometrics,
    addBiometricValue, updateBiometricValue, deleteBiometricValue,
    addParameterToAthlete, removeParameterFromAthlete, getAthleteParameters,
    addParameterValue, updateParameterValue, deleteParameterValue,

    addPerformanceParameter, removePerformanceParameter, getAthletePerformanceParameters,
    addPerformanceParameterValue, updatePerformanceParameterValue, deletePerformanceParameterValue,

    createCalendarAssignment, updateCalendarAssignment, deleteCalendarAssignment, getAthleteCalendarAssignments,
  };
}
