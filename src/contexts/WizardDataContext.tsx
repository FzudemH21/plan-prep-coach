import React, { createContext, useContext, useState, useCallback } from 'react';

// Normalize a date string to yyyy-MM-dd regardless of whether it's ISO or already short
const normDate = (d: string): string => (d ? d.split('T')[0] : d);

// Deeply normalize all date arrays in macrocycleData to yyyy-MM-dd
function normalizeMacrocycleData(data: any): any {
  if (!data) return data;
  return {
    ...data,
    subGoals: (data.subGoals || []).map((sg: any) => ({
      ...sg,
      testDates: (sg.testDates || []).map(normDate),
    })),
    events: (data.events || []).map((e: any) => ({
      ...e,
      eventDates: (e.eventDates || []).map(normDate),
    })),
    smartGoals: (data.smartGoals || []).map((sg: any) => ({
      ...sg,
      testDates: (sg.testDates || []).map(normDate),
    })),
    athleteExistingTests: (data.athleteExistingTests || []).map((t: any) => ({
      ...t,
      testDates: (t.testDates || []).map(normDate),
    })),
    athleteExistingEvents: (data.athleteExistingEvents || []).map((e: any) => ({
      ...e,
      eventDates: (e.eventDates || []).map(normDate),
    })),
  };
}

// Helper to safely parse localStorage
function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

interface WizardDataContextValue {
  macrocycleData: any;
  setMacrocycleData: (data: any) => void;
  trainingDays: any[]; // TrainingDay[]
  setTrainingDays: (days: any[] | ((prev: any[]) => any[])) => void;
  dailyIntensityData: any[]; // DailyIntensity[]
  setDailyIntensityData: (data: any[] | ((prev: any[]) => any[])) => void;
  mesocycleData: any;
  setMesocycleData: (data: any) => void;
  /** Call when a program is loaded into the session (replaces all wizard state at once) */
  loadWizardSession: () => void;
}

const WizardDataContext = createContext<WizardDataContextValue>({
  macrocycleData: null,
  setMacrocycleData: () => {},
  trainingDays: [],
  setTrainingDays: () => {},
  dailyIntensityData: [],
  setDailyIntensityData: () => {},
  mesocycleData: null,
  setMesocycleData: () => {},
  loadWizardSession: () => {},
});

export function WizardDataProvider({ children }: { children: React.ReactNode }) {
  // Initialize directly from localStorage (lazy initializer runs once)
  const [macrocycleData, _setMacrocycleData] = useState<any>(() =>
    normalizeMacrocycleData(loadFromLS<any>('macrocycleData', null))
  );
  const [trainingDays, _setTrainingDays] = useState<any[]>(() =>
    loadFromLS<any[]>('trainingDays', [])
  );
  const [dailyIntensityData, _setDailyIntensityData] = useState<any[]>(() =>
    loadFromLS<any[]>('dailyIntensityData', [])
  );
  const [mesocycleData, _setMesocycleData] = useState<any>(() =>
    loadFromLS<any>('mesocycleData', null)
  );

  // setMacrocycleData: normalize dates, update state, write to localStorage
  const setMacrocycleData = useCallback((data: any) => {
    const normalized = normalizeMacrocycleData(data);
    _setMacrocycleData(normalized);
    if (normalized != null) {
      localStorage.setItem('macrocycleData', JSON.stringify(normalized));
    }
  }, []);

  // setTrainingDays: supports updater function, writes to localStorage
  const setTrainingDays = useCallback((days: any[] | ((prev: any[]) => any[])) => {
    _setTrainingDays(prev => {
      const next = typeof days === 'function' ? days(prev) : days;
      localStorage.setItem('trainingDays', JSON.stringify(next));
      return next;
    });
  }, []);

  // setDailyIntensityData: supports updater function, writes to localStorage
  const setDailyIntensityData = useCallback((data: any[] | ((prev: any[]) => any[])) => {
    _setDailyIntensityData(prev => {
      const next = typeof data === 'function' ? data(prev) : data;
      if (next.length > 0) localStorage.setItem('dailyIntensityData', JSON.stringify(next));
      return next;
    });
  }, []);

  // setMesocycleData: writes to localStorage
  const setMesocycleData = useCallback((data: any) => {
    _setMesocycleData(data);
    if (data != null) localStorage.setItem('mesocycleData', JSON.stringify(data));
  }, []);

  // loadWizardSession: re-read everything from localStorage (call after loadProgramIntoSession)
  const loadWizardSession = useCallback(() => {
    _setMacrocycleData(normalizeMacrocycleData(loadFromLS<any>('macrocycleData', null)));
    _setTrainingDays(loadFromLS<any[]>('trainingDays', []));
    _setDailyIntensityData(loadFromLS<any[]>('dailyIntensityData', []));
    _setMesocycleData(loadFromLS<any>('mesocycleData', null));
  }, []);

  return (
    <WizardDataContext.Provider value={{
      macrocycleData, setMacrocycleData,
      trainingDays, setTrainingDays,
      dailyIntensityData, setDailyIntensityData,
      mesocycleData, setMesocycleData,
      loadWizardSession,
    }}>
      {children}
    </WizardDataContext.Provider>
  );
}

export function useWizardData() {
  return useContext(WizardDataContext);
}
