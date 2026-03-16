import { useState, useEffect, useCallback } from 'react';
import { PlanDuration, SmartGoal, SubGoal, Event, TrainableQuality, IntensityLevel } from '@/types/training';

// Interface for manually added methods
interface ManuallyAddedMethod {
  methodId: string;
  rationale?: string;
}

// Core training program interface
export interface TrainingProgram {
  id: string;
  name: string;
  athleteId: string | null;
  athleteName: string | null;
  primaryGoal: string;
  duration: {
    startDate: string;
    endDate: string;
    weeks: number;
  };
  createdAt: string;
  lastModifiedAt: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  
  // Macrocycle data
  macrocycleData: {
    planName: string;
    selectedAthleteId: string | null;
    planDuration: PlanDuration | null;
    smartGoals: SmartGoal[];
    subGoals: SubGoal[];
    events: Event[];
    qualities: TrainableQuality[];
    qualitiesBySubGoal: Record<string, { label: string; list: string[] }>;
    methodsByQuality: Record<string, { subGoalLabel: string; qualityName: string; list: string[] }>;
    selectedTest: string | null;
    selectedEvent: string | null;
    selectedMethods: string[];
    manuallyAddedMethods: ManuallyAddedMethod[];
  } | null;
  
  // Mesocycle data
  mesocycleData: any | null;
  
  // Microcycle planning data
  trainingDays: any[] | null;
  exerciseDistribution: any[] | null;
  parameterValues: Record<string, any> | null;
  dailyIntensityData: any[] | null;
  daySplitStates: Record<string, number> | null;
  sessionSections: Record<string, any[]> | null;
  supersets: Record<string, Record<string, string>> | null;
}

interface TrainingProgramsData {
  version: number;
  programs: TrainingProgram[];
}

const STORAGE_KEY = 'trainingPrograms';
const CURRENT_VERSION = 1;

const generateId = () => `prog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function useTrainingPrograms() {
  const [data, setData] = useState<TrainingProgramsData>({ version: CURRENT_VERSION, programs: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Load data from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setData(parsed);
      }
    } catch (error) {
      console.error('Error loading training programs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save helper
  const saveData = useCallback((newData: TrainingProgramsData) => {
    setData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  }, []);

  // Get all programs
  const getPrograms = useCallback(() => {
    return data.programs;
  }, [data.programs]);

  // Get a single program by ID
  const getProgram = useCallback((id: string) => {
    return data.programs.find(p => p.id === id) || null;
  }, [data.programs]);

  // Save or update a program
  const saveProgram = useCallback((program: Partial<TrainingProgram> & { id?: string }): TrainingProgram => {
    const now = new Date().toISOString();
    
    if (program.id) {
      // Update existing program
      const existingIndex = data.programs.findIndex(p => p.id === program.id);
      if (existingIndex >= 0) {
        const updated: TrainingProgram = {
          ...data.programs[existingIndex],
          ...program,
          lastModifiedAt: now,
        };
        const newPrograms = [...data.programs];
        newPrograms[existingIndex] = updated;
        saveData({ ...data, programs: newPrograms });
        return updated;
      }
    }
    
    // Create new program
    const newProgram: TrainingProgram = {
      id: generateId(),
      name: program.name || 'Untitled Program',
      athleteId: program.athleteId || null,
      athleteName: program.athleteName || null,
      primaryGoal: program.primaryGoal || '',
      duration: program.duration || { startDate: '', endDate: '', weeks: 0 },
      createdAt: now,
      lastModifiedAt: now,
      status: program.status || 'draft',
      macrocycleData: program.macrocycleData || null,
      mesocycleData: program.mesocycleData || null,
      trainingDays: program.trainingDays || null,
      exerciseDistribution: program.exerciseDistribution || null,
      parameterValues: program.parameterValues || null,
      dailyIntensityData: program.dailyIntensityData || null,
      daySplitStates: program.daySplitStates || null,
      sessionSections: program.sessionSections || null,
      supersets: program.supersets || null,
    };
    
    saveData({ ...data, programs: [...data.programs, newProgram] });
    return newProgram;
  }, [data, saveData]);

  // Copy a program
  const copyProgram = useCallback((id: string): TrainingProgram | null => {
    const original = data.programs.find(p => p.id === id);
    if (!original) return null;
    
    const now = new Date().toISOString();
    const copy: TrainingProgram = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      createdAt: now,
      lastModifiedAt: now,
      status: 'draft',
    };
    
    saveData({ ...data, programs: [...data.programs, copy] });
    return copy;
  }, [data, saveData]);

  // Delete a program
  const deleteProgram = useCallback((id: string): boolean => {
    const index = data.programs.findIndex(p => p.id === id);
    if (index < 0) return false;
    
    const newPrograms = data.programs.filter(p => p.id !== id);
    saveData({ ...data, programs: newPrograms });
    return true;
  }, [data, saveData]);

  // Load program data into the active session (localStorage keys used by wizard)
  const loadProgramIntoSession = useCallback((id: string): boolean => {
    const program = data.programs.find(p => p.id === id);
    if (!program) return false;
    
    // Clear existing session data first
    const keysToCheck = [
      'macrocycleData',
      'mesocycleData', 
      'trainingDays',
      'exerciseDistribution',
      'parameterValues',
      'dailyIntensityData',
      'daySplitStates',
      'sessionSections',
      'supersets',
      'macrocycleStep',
      'mesocycleStep',
      'microcycleStep'
    ];
    
    keysToCheck.forEach(key => localStorage.removeItem(key));
    
    // Load program data into session
    if (program.macrocycleData) {
      localStorage.setItem('macrocycleData', JSON.stringify(program.macrocycleData));
    }
    if (program.mesocycleData) {
      localStorage.setItem('mesocycleData', JSON.stringify(program.mesocycleData));
    }
    if (program.trainingDays) {
      localStorage.setItem('trainingDays', JSON.stringify(program.trainingDays));
    }
    if (program.exerciseDistribution) {
      localStorage.setItem('exerciseDistribution', JSON.stringify(program.exerciseDistribution));
    }
    if (program.parameterValues) {
      localStorage.setItem('parameterValues', JSON.stringify(program.parameterValues));
    }
    if (program.dailyIntensityData) {
      localStorage.setItem('dailyIntensityData', JSON.stringify(program.dailyIntensityData));
    }
    if (program.daySplitStates) {
      localStorage.setItem('daySplitStates', JSON.stringify(program.daySplitStates));
    }
    if (program.sessionSections) {
      localStorage.setItem('sessionSections', JSON.stringify(program.sessionSections));
    }
    if (program.supersets) {
      localStorage.setItem('supersets', JSON.stringify(program.supersets));
    }
    
    // Store the active program ID for reference
    localStorage.setItem('activeProgramId', id);
    
    return true;
  }, [data.programs]);

  // Collect current session data to save as a program
  const collectSessionData = useCallback((): Partial<TrainingProgram> => {
    const macrocycleDataStr = localStorage.getItem('macrocycleData');
    const mesocycleDataStr = localStorage.getItem('mesocycleData');
    const trainingDaysStr = localStorage.getItem('trainingDays');
    const exerciseDistributionStr = localStorage.getItem('exerciseDistribution');
    const parameterValuesStr = localStorage.getItem('parameterValues');
    const dailyIntensityDataStr = localStorage.getItem('dailyIntensityData');
    const daySplitStatesStr = localStorage.getItem('daySplitStates');
    const sessionSectionsStr = localStorage.getItem('sessionSections');
    const supersetsStr = localStorage.getItem('supersets');
    
    const macrocycleData = macrocycleDataStr ? JSON.parse(macrocycleDataStr) : null;
    const mesocycleData = mesocycleDataStr ? JSON.parse(mesocycleDataStr) : null;
    
    // Extract program metadata from macrocycle data
    let name = 'Untitled Program';
    let athleteId: string | null = null;
    let athleteName: string | null = null;
    let primaryGoal = '';
    let duration = { startDate: '', endDate: '', weeks: 0 };
    
    if (macrocycleData) {
      name = macrocycleData.planName || 'Untitled Program';
      athleteId = macrocycleData.selectedAthleteId || null;
      
      if (macrocycleData.smartGoals && macrocycleData.smartGoals.length > 0) {
        primaryGoal = macrocycleData.smartGoals[0].description || '';
      }
      
      if (macrocycleData.planDuration) {
        const pd = macrocycleData.planDuration;
        duration = {
          startDate: pd.startDate ? new Date(pd.startDate).toISOString() : '',
          endDate: pd.endDate ? new Date(pd.endDate).toISOString() : '',
          weeks: pd.totalWeeks || 0,
        };
      }
    }
    
    return {
      name,
      athleteId,
      athleteName,
      primaryGoal,
      duration,
      macrocycleData,
      mesocycleData,
      trainingDays: trainingDaysStr ? JSON.parse(trainingDaysStr) : null,
      exerciseDistribution: exerciseDistributionStr ? JSON.parse(exerciseDistributionStr) : null,
      parameterValues: parameterValuesStr ? JSON.parse(parameterValuesStr) : null,
      dailyIntensityData: dailyIntensityDataStr ? JSON.parse(dailyIntensityDataStr) : null,
      daySplitStates: daySplitStatesStr ? JSON.parse(daySplitStatesStr) : null,
      sessionSections: sessionSectionsStr ? JSON.parse(sessionSectionsStr) : null,
      supersets: supersetsStr ? JSON.parse(supersetsStr) : null,
    };
  }, []);

  // Save current session as a new program or update existing
  const saveCurrentSession = useCallback((overrideData?: Partial<TrainingProgram>): TrainingProgram => {
    const activeProgramId = localStorage.getItem('activeProgramId');
    const sessionData = collectSessionData();
    
    const programData = {
      ...sessionData,
      ...overrideData,
      id: activeProgramId || undefined,
    };
    
    const saved = saveProgram(programData);
    localStorage.setItem('activeProgramId', saved.id);
    
    return saved;
  }, [collectSessionData, saveProgram]);

  // Clear session and start fresh
  const clearSession = useCallback(() => {
    // Static keys to remove
    const staticKeysToRemove = [
      'macrocycleData',
      'mesocycleData',
      'trainingDays',
      'exerciseDistribution',
      'parameterValues',
      'dailyIntensityData',
      'daySplitStates',
      'sessionSections',
      'supersets',
      'macrocycleStep',
      'mesocycleStep',
      'microcycleStep',
      'activeProgramId'
    ];
    
    staticKeysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Also clear dynamically-keyed session data (workout sections, exercises, etc.)
    const dynamicPrefixes = [
      'workoutSections_',
      'workoutSessions_',
      'sessionIntensities_',
      'sessionNames_',
      'exercises_'
    ];
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && dynamicPrefixes.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }, []);

  // Update program status
  const updateProgramStatus = useCallback((id: string, status: TrainingProgram['status']): boolean => {
    const program = data.programs.find(p => p.id === id);
    if (!program) return false;
    
    saveProgram({ id, status });
    return true;
  }, [data.programs, saveProgram]);

  // Get programs sorted by last modified
  const getRecentPrograms = useCallback((limit?: number) => {
    const sorted = [...data.programs].sort((a, b) => 
      new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }, [data.programs]);

  return {
    programs: data.programs,
    isLoading,
    getPrograms,
    getProgram,
    saveProgram,
    copyProgram,
    deleteProgram,
    loadProgramIntoSession,
    collectSessionData,
    saveCurrentSession,
    clearSession,
    updateProgramStatus,
    getRecentPrograms,
  };
}
