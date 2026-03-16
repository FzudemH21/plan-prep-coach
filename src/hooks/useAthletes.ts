import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
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

// Legacy interface for migration
interface LegacyAthleteDatabase {
  groups: AthleteGroup[];
  athletes: Athlete[];
  parameterDefinitions?: BiometricDefinition[];
  athleteParameters?: AthleteBiometric[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const migrateData = (data: LegacyAthleteDatabase | AthleteDatabase): AthleteDatabase => {
  // Check if migration is needed (old format uses parameterDefinitions/athleteParameters)
  if ('parameterDefinitions' in data && !('biometricDefinitions' in data)) {
    // Migrate old athleteParameters to new format with biometricDefinitionId
    const migratedBiometrics = (data.athleteParameters || []).map(ap => ({
      ...ap,
      biometricDefinitionId: (ap as any).parameterDefinitionId || ap.biometricDefinitionId,
      parameterDefinitionId: (ap as any).parameterDefinitionId || ap.biometricDefinitionId, // Keep for backward compat
    }));
    
    return {
      groups: data.groups || [],
      athletes: (data.athletes || []).map(a => ({
        ...a,
        groupIds: a.groupIds ?? [],
      })),
      biometricDefinitions: data.parameterDefinitions || [],
      athleteBiometrics: migratedBiometrics,
      athletePerformanceParameters: [],
      calendarAssignments: [],
    };
  }
  
  // Already in new format, but ensure all biometrics have parameterDefinitionId for backward compat
  const biometrics = ((data as AthleteDatabase).athleteBiometrics || []).map(ab => ({
    ...ab,
    parameterDefinitionId: ab.parameterDefinitionId || ab.biometricDefinitionId,
  }));
  
  return {
    groups: data.groups || [],
    athletes: (data.athletes || []).map(a => ({
      ...a,
      groupIds: a.groupIds ?? [],
    })),
    biometricDefinitions: (data as AthleteDatabase).biometricDefinitions || [],
    athleteBiometrics: biometrics,
    athletePerformanceParameters: (data as AthleteDatabase).athletePerformanceParameters || [],
    calendarAssignments: (data as AthleteDatabase).calendarAssignments || [],
  };
};

const getInitialData = (): AthleteDatabase => {
  const now = new Date().toISOString();
  const defaultDefs: BiometricDefinition[] = DEFAULT_BIOMETRICS.map((p, i) => ({
    id: `default-param-${i}`,
    name: p.name,
    type: p.type,
    unit: p.unit,
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
};

export function useAthletes() {
  const [rawData, setData] = useLocalStorage<AthleteDatabase | LegacyAthleteDatabase>('athlete-database', getInitialData());
  
  // Migrate data on read
  const data = useMemo(() => migrateData(rawData), [rawData]);

  // Groups
  const createGroup = useCallback((name: string): AthleteGroup => {
    const group: AthleteGroup = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => {
      const migrated = migrateData(prev);
      return { ...migrated, groups: [...migrated.groups, group] };
    });
    return group;
  }, [setData]);

  const updateGroup = useCallback((id: string, name: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        groups: migrated.groups.map((g) => (g.id === id ? { ...g, name } : g)),
      };
    });
  }, [setData]);

  const deleteGroup = useCallback((id: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        groups: migrated.groups.filter((g) => g.id !== id),
        athletes: migrated.athletes.map((a) => ({
          ...a,
          groupIds: a.groupIds.filter((gId) => gId !== id),
        })),
      };
    });
  }, [setData]);

  // Athletes
  const createAthlete = useCallback((athlete: Omit<Athlete, 'id' | 'createdAt' | 'updatedAt'>): Athlete => {
    const now = new Date().toISOString();
    const athleteId = generateId();
    const newAthlete: Athlete = {
      ...athlete,
      id: athleteId,
      isArchived: athlete.isArchived ?? false,
      createdAt: now,
      updatedAt: now,
    };
    
    // Find Height and Weight biometric definitions
    const heightDef = data.biometricDefinitions.find(d => d.name === 'Height');
    const weightDef = data.biometricDefinitions.find(d => d.name === 'Weight');
    
    // Auto-create Height and Weight biometrics for new athlete
    const newBiometrics: AthleteBiometric[] = [];
    if (heightDef) {
      newBiometrics.push({
        id: generateId(),
        athleteId,
        biometricDefinitionId: heightDef.id,
        parameterDefinitionId: heightDef.id, // Legacy alias
        values: [],
      });
    }
    if (weightDef) {
      newBiometrics.push({
        id: generateId(),
        athleteId,
        biometricDefinitionId: weightDef.id,
        parameterDefinitionId: weightDef.id, // Legacy alias
        values: [],
      });
    }
    
    setData((prev) => {
      const migrated = migrateData(prev);
      return { 
        ...migrated, 
        athletes: [...migrated.athletes, newAthlete],
        athleteBiometrics: [...migrated.athleteBiometrics, ...newBiometrics],
      };
    });
    return newAthlete;
  }, [setData, data.biometricDefinitions]);

  const updateAthlete = useCallback((id: string, updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletes: migrated.athletes.map((a) =>
          a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
        ),
      };
    });
  }, [setData]);

  const deleteAthlete = useCallback((id: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletes: migrated.athletes.filter((a) => a.id !== id),
        athleteBiometrics: migrated.athleteBiometrics.filter((ab) => ab.athleteId !== id),
        athletePerformanceParameters: migrated.athletePerformanceParameters.filter((pp) => pp.athleteId !== id),
        calendarAssignments: migrated.calendarAssignments.filter((ca) => ca.athleteId !== id),
      };
    });
  }, [setData]);

  // ============ BIOMETRIC DEFINITIONS ============
  const createBiometricDefinition = useCallback((def: Omit<BiometricDefinition, 'id' | 'createdAt'>): BiometricDefinition => {
    const newDef: BiometricDefinition = {
      ...def,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        biometricDefinitions: [...migrated.biometricDefinitions, newDef],
      };
    });
    return newDef;
  }, [setData]);

  const deleteBiometricDefinition = useCallback((id: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        biometricDefinitions: migrated.biometricDefinitions.filter((bd) => bd.id !== id),
        athleteBiometrics: migrated.athleteBiometrics.filter((ab) => ab.biometricDefinitionId !== id),
      };
    });
  }, [setData]);

  // ============ ATHLETE BIOMETRICS ============
  const addBiometricToAthlete = useCallback((athleteId: string, biometricDefinitionId: string): AthleteBiometric => {
    const existing = data.athleteBiometrics.find(
      (ab) => ab.athleteId === athleteId && ab.biometricDefinitionId === biometricDefinitionId
    );
    if (existing) return existing;

    const newAb: AthleteBiometric = {
      id: generateId(),
      athleteId,
      biometricDefinitionId,
      parameterDefinitionId: biometricDefinitionId, // Legacy alias
      values: [],
    };
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athleteBiometrics: [...migrated.athleteBiometrics, newAb],
      };
    });
    return newAb;
  }, [data.athleteBiometrics, setData]);

  const removeBiometricFromAthlete = useCallback((athleteBiometricId: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athleteBiometrics: migrated.athleteBiometrics.filter((ab) => ab.id !== athleteBiometricId),
      };
    });
  }, [setData]);

  const addBiometricValue = useCallback((athleteBiometricId: string, value: string): ParameterValue => {
    const newValue: ParameterValue = {
      id: generateId(),
      value,
      recordedAt: new Date().toISOString(),
    };
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athleteBiometrics: migrated.athleteBiometrics.map((ab) =>
          ab.id === athleteBiometricId
            ? { ...ab, values: [...ab.values, newValue] }
            : ab
        ),
      };
    });
    return newValue;
  }, [setData]);

  const updateBiometricValue = useCallback((athleteBiometricId: string, valueId: string, newValue: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athleteBiometrics: migrated.athleteBiometrics.map((ab) =>
          ab.id === athleteBiometricId
            ? {
                ...ab,
                values: ab.values.map((v) =>
                  v.id === valueId ? { ...v, value: newValue } : v
                ),
              }
            : ab
        ),
      };
    });
  }, [setData]);

  const deleteBiometricValue = useCallback((athleteBiometricId: string, valueId: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athleteBiometrics: migrated.athleteBiometrics.map((ab) =>
          ab.id === athleteBiometricId
            ? { ...ab, values: ab.values.filter((v) => v.id !== valueId) }
            : ab
        ),
      };
    });
  }, [setData]);

  // ============ PERFORMANCE PARAMETERS ============
  const addPerformanceParameter = useCallback((athleteId: string, athleticismParameterId: string): AthletePerformanceParameter => {
    const existing = data.athletePerformanceParameters.find(
      (pp) => pp.athleteId === athleteId && pp.athleticismParameterId === athleticismParameterId
    );
    if (existing) return existing;

    const newPp: AthletePerformanceParameter = {
      id: generateId(),
      athleteId,
      athleticismParameterId,
      values: [],
    };
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletePerformanceParameters: [...migrated.athletePerformanceParameters, newPp],
      };
    });
    return newPp;
  }, [data.athletePerformanceParameters, setData]);

  const removePerformanceParameter = useCallback((performanceParameterId: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletePerformanceParameters: migrated.athletePerformanceParameters.filter((pp) => pp.id !== performanceParameterId),
      };
    });
  }, [setData]);

  const addPerformanceParameterValue = useCallback((performanceParameterId: string, value: string): ParameterValue => {
    const newValue: ParameterValue = {
      id: generateId(),
      value,
      recordedAt: new Date().toISOString(),
    };
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletePerformanceParameters: migrated.athletePerformanceParameters.map((pp) =>
          pp.id === performanceParameterId
            ? { ...pp, values: [...pp.values, newValue] }
            : pp
        ),
      };
    });
    return newValue;
  }, [setData]);

  const updatePerformanceParameterValue = useCallback((performanceParameterId: string, valueId: string, newValue: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletePerformanceParameters: migrated.athletePerformanceParameters.map((pp) =>
          pp.id === performanceParameterId
            ? {
                ...pp,
                values: pp.values.map((v) =>
                  v.id === valueId ? { ...v, value: newValue } : v
                ),
              }
            : pp
        ),
      };
    });
  }, [setData]);

  const deletePerformanceParameterValue = useCallback((performanceParameterId: string, valueId: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletePerformanceParameters: migrated.athletePerformanceParameters.map((pp) =>
          pp.id === performanceParameterId
            ? { ...pp, values: pp.values.filter((v) => v.id !== valueId) }
            : pp
        ),
      };
    });
  }, [setData]);

  // ============ ARCHIVE FUNCTIONS ============
  const archiveAthlete = useCallback((id: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletes: migrated.athletes.map((a) =>
          a.id === id ? { ...a, isArchived: true, updatedAt: new Date().toISOString() } : a
        ),
      };
    });
  }, [setData]);

  const unarchiveAthlete = useCallback((id: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        athletes: migrated.athletes.map((a) =>
          a.id === id ? { ...a, isArchived: false, updatedAt: new Date().toISOString() } : a
        ),
      };
    });
  }, [setData]);

  const getArchivedAthletes = useCallback(() => {
    return data.athletes.filter((a) => a.isArchived === true);
  }, [data.athletes]);

  // ============ HELPER FUNCTIONS ============
  const getAthletesByGroup = useCallback((groupId: string) => {
    return data.athletes.filter((a) => a.groupIds.includes(groupId) && !a.isArchived);
  }, [data.athletes]);

  const getAthletesWithoutGroup = useCallback(() => {
    return data.athletes.filter((a) => a.groupIds.length === 0 && !a.isArchived);
  }, [data.athletes]);

  const getAthleteBiometrics = useCallback((athleteId: string) => {
    return data.athleteBiometrics.filter((ab) => ab.athleteId === athleteId);
  }, [data.athleteBiometrics]);

  const getBiometricDefinition = useCallback((id: string) => {
    return data.biometricDefinitions.find((bd) => bd.id === id);
  }, [data.biometricDefinitions]);

  const getAthletePerformanceParameters = useCallback((athleteId: string) => {
    return data.athletePerformanceParameters.filter((pp) => pp.athleteId === athleteId);
  }, [data.athletePerformanceParameters]);

  const getAthlete = useCallback((id: string) => {
    return data.athletes.find((a) => a.id === id);
  }, [data.athletes]);

  // ============ CALENDAR ASSIGNMENTS ============
  const createCalendarAssignment = useCallback((
    athleteId: string, 
    assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>
  ): AthleteCalendarAssignment => {
    const newAssignment: AthleteCalendarAssignment = {
      ...assignment,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        calendarAssignments: [...migrated.calendarAssignments, newAssignment],
      };
    });
    return newAssignment;
  }, [setData]);

  const updateCalendarAssignment = useCallback((id: string, updates: Partial<AthleteCalendarAssignment>) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        calendarAssignments: migrated.calendarAssignments.map((ca) =>
          ca.id === id ? { ...ca, ...updates } : ca
        ),
      };
    });
  }, [setData]);

  const deleteCalendarAssignment = useCallback((id: string) => {
    setData((prev) => {
      const migrated = migrateData(prev);
      return {
        ...migrated,
        calendarAssignments: migrated.calendarAssignments.filter((ca) => ca.id !== id),
      };
    });
  }, [setData]);

  const getAthleteCalendarAssignments = useCallback((athleteId: string) => {
    return data.calendarAssignments.filter((ca) => ca.athleteId === athleteId);
  }, [data.calendarAssignments]);

  // ============ LEGACY ALIASES ============
  // These are kept for backward compatibility with existing code

  /** @deprecated Use biometricDefinitions instead */
  const parameterDefinitions = data.biometricDefinitions;
  
  /** @deprecated Use athleteBiometrics instead */
  const athleteParameters = data.athleteBiometrics;
  
  /** @deprecated Use createBiometricDefinition instead */
  const createParameterDefinition = createBiometricDefinition;
  
  /** @deprecated Use deleteBiometricDefinition instead */
  const deleteParameterDefinition = deleteBiometricDefinition;
  
  /** @deprecated Use getBiometricDefinition instead */
  const getParameterDefinition = getBiometricDefinition;
  
  /** @deprecated Use addBiometricToAthlete instead */
  const addParameterToAthlete = addBiometricToAthlete;
  
  /** @deprecated Use removeBiometricFromAthlete instead */
  const removeParameterFromAthlete = removeBiometricFromAthlete;
  
  /** @deprecated Use getAthleteBiometrics instead */
  const getAthleteParameters = getAthleteBiometrics;
  
  /** @deprecated Use addBiometricValue instead */
  const addParameterValue = addBiometricValue;
  
  /** @deprecated Use updateBiometricValue instead */
  const updateParameterValue = updateBiometricValue;
  
  /** @deprecated Use deleteBiometricValue instead */
  const deleteParameterValue = deleteBiometricValue;

  return {
    // Data
    groups: data.groups,
    athletes: data.athletes,
    biometricDefinitions: data.biometricDefinitions,
    athleteBiometrics: data.athleteBiometrics,
    athletePerformanceParameters: data.athletePerformanceParameters,
    calendarAssignments: data.calendarAssignments,

    // Legacy data aliases
    parameterDefinitions,
    athleteParameters,

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
    archiveAthlete,
    unarchiveAthlete,
    getArchivedAthletes,

    // Biometric definition operations
    createBiometricDefinition,
    deleteBiometricDefinition,
    getBiometricDefinition,

    // Legacy definition aliases
    createParameterDefinition,
    deleteParameterDefinition,
    getParameterDefinition,

    // Athlete biometric operations
    addBiometricToAthlete,
    removeBiometricFromAthlete,
    getAthleteBiometrics,
    addBiometricValue,
    updateBiometricValue,
    deleteBiometricValue,

    // Legacy biometric aliases
    addParameterToAthlete,
    removeParameterFromAthlete,
    getAthleteParameters,
    addParameterValue,
    updateParameterValue,
    deleteParameterValue,

    // Performance parameter operations
    addPerformanceParameter,
    removePerformanceParameter,
    getAthletePerformanceParameters,
    addPerformanceParameterValue,
    updatePerformanceParameterValue,
    deletePerformanceParameterValue,

    // Calendar assignment operations
    createCalendarAssignment,
    updateCalendarAssignment,
    deleteCalendarAssignment,
    getAthleteCalendarAssignments,
  };
}
