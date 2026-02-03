import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { format, addDays, parseISO, eachDayOfInterval, differenceInDays } from 'date-fns';
import { AthleteCalendarAssignment, AssignedMesocycle } from '@/types/athlete';
import { ExerciseDistribution, SessionSection, SupersetMapping } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
import { TrainingDay } from '@/types/daily-intensity';
import { toggleSuperset, cleanupSupersetsOnExerciseDelete } from '@/utils/supersetUtils';
import { useToast } from '@/hooks/use-toast';

interface CopiedSession {
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  supersets: { [sectionId: string]: { [supersetId: string]: string[] } }; // Added for session paste
  sourceDate: string;
  sessionIndex: number;
  // Metadata for creating complete days when pasting outside range
  sourceMesocycleId?: string;
  sourceMicrocycleId?: string;
  sourceIntensity?: IntensityLevel;
}

interface CopiedDay {
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  supersets: { [sessionIndex: number]: { [sectionId: string]: { [supersetId: string]: string[] } } };
  sourceDate: string;
  intensity?: IntensityLevel;
  splitState?: number;
  testNames?: string[];
  eventNames?: string[];
  // Metadata for creating complete days when pasting outside range
  sourceMesocycleId?: string;
  sourceMicrocycleId?: string;
}

interface CopiedWeek {
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  supersets: SupersetMapping;
  sessionStructure: Record<string, number[]>; // dayDate -> sessionIndices
  weekStartDate: string;
  trainingDays: TrainingDay[];
}

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  trainingDay?: TrainingDay;
  sessions: {
    id: string;
    sessionIndex: number;
    sessionName: string;
    exercises: ExerciseDistribution[];
    methods: string[];
    sessionIntensity?: IntensityLevel;
  }[];
  totalExercises: number;
}

export function useAthleteCalendarEditing(selectedAssignmentId: string | null, assignments: AthleteCalendarAssignment[]) {
  const { toast } = useToast();
  
  // Editing state
  const [exerciseDistribution, setExerciseDistribution] = useState<ExerciseDistribution[]>([]);
  const [sessionSections, setSessionSections] = useState<SessionSection[]>([]);
  const [supersets, setSupersets] = useState<SupersetMapping>({});
  const [parameterValues, setParameterValues] = useState<Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>>({});
  const [dailyIntensityData, setDailyIntensityData] = useState<any[]>([]);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [daySplitStates, setDaySplitStates] = useState<Record<string, number>>({});
  
  // Flag to prevent auto-save during initial load
  const [isInitializing, setIsInitializing] = useState(false);
  
  // === CRITICAL REFS FOR STABILITY ===
  // These refs prevent the "flicker then disappear" bug caused by reload loops
  
  // Stable reference to assignments - prevents loadAssignmentForEditing from being recreated on every render
  const assignmentsRef = useRef(assignments);
  useEffect(() => { assignmentsRef.current = assignments; }, [assignments]);
  
  // Synchronous loading guard - prevents auto-save during load
  const loadingAssignmentIdRef = useRef<string | null>(null);
  
  // Tracks the last successfully loaded assignment - prevents re-loading the same assignment
  const lastLoadedAssignmentIdRef = useRef<string | null>(null);
  const loadedAssignmentIdRef = useRef<string | null>(null);
  
  // Robust auto-save fingerprint - full content comparison, not just counts
  const lastSavedStateRef = useRef<string>('');
  
  // Debounce timer for auto-save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Copy/paste state
  const [copiedSession, setCopiedSession] = useState<CopiedSession | null>(null);
  const [copiedDay, setCopiedDay] = useState<CopiedDay | null>(null);
  const [copiedWeek, setCopiedWeek] = useState<CopiedWeek | null>(null);
  
  // Get selected assignment - use ref for stability in callbacks
  const selectedAssignment = useMemo(() => 
    assignments.find(a => a.id === selectedAssignmentId),
    [assignments, selectedAssignmentId]
  );

  // Build training days from assignment
  const buildTrainingDaysFromAssignment = useCallback((assignment: AthleteCalendarAssignment, storedDailyIntensity?: any[]): TrainingDay[] => {
    const days: TrainingDay[] = [];
    
    // Create a lookup map for stored daily intensity
    const intensityLookup = new Map<string, IntensityLevel>();
    if (storedDailyIntensity && storedDailyIntensity.length > 0) {
      storedDailyIntensity.forEach(di => {
        if (di.date && di.intensity) {
          intensityLookup.set(di.date, di.intensity as IntensityLevel);
        }
      });
    }
    
    assignment.assignedMesocycles.forEach((meso) => {
      const mesoStart = new Date(meso.startDate);
      const mesoEnd = new Date(meso.endDate);
      const allDays = eachDayOfInterval({ start: mesoStart, end: mesoEnd });
      
      let microOffset = 0;
      meso.microcycles.forEach((micro) => {
        for (let i = 0; i < micro.duration; i++) {
          const dayDate = allDays[microOffset + i];
          if (!dayDate) continue;
          
          const dateString = format(dayDate, 'yyyy-MM-dd');
          
          // Use stored day intensity if available, otherwise fall back to meso/micro intensity
          const storedIntensity = intensityLookup.get(dateString);
          const intensity: IntensityLevel = storedIntensity || (meso.intensity || micro.intensity || 'moderate') as IntensityLevel;
          
          days.push({
            date: dateString,
            dayOfWeek: dayDate.getDay(),
            dayName: format(dayDate, 'EEEE'),
            mesocycleId: meso.id,
            microcycleId: micro.id,
            isTestDay: false,
            isEventDay: false,
            isTrainingDay: true,
            intensity,
            sessions: 1,
            sessionNames: ['Session 1'],
          });
        }
        microOffset += micro.duration;
      });
    });
    
    return days;
  }, []);

  // Initialize from assignment snapshot - MUST be defined before loadAssignmentForEditing
  const initializeFromAssignment = useCallback((assignment: AthleteCalendarAssignment) => {
    const days = buildTrainingDaysFromAssignment(assignment);
    setTrainingDays(days);
    setExerciseDistribution([]);
    setSessionSections([]);
    setSupersets({});
    setParameterValues({});
    
    // Build initial daySplitStates (1 session per training day)
    const splitStates: Record<string, number> = {};
    days.forEach(day => {
      splitStates[day.date] = day.intensity === 'off' ? 0 : 1;
    });
    setDaySplitStates(splitStates);
    
    // Build daily intensity
    const intensities = days.map(d => ({ date: d.date, intensity: d.intensity }));
    setDailyIntensityData(intensities);
    
    // Set fingerprint for the initialized state
    const initFingerprint = JSON.stringify({
      exerciseDistribution: [],
      sessionSections: [],
      supersets: {},
      parameterValues: {},
      dailyIntensity: intensities,
      trainingDays: days,
      daySplitStates: splitStates,
    });
    lastSavedStateRef.current = initFingerprint;
  }, [buildTrainingDaysFromAssignment]);

  // Load assignment for editing - uses assignmentsRef to prevent recreation on every render
  const loadAssignmentForEditing = useCallback((assignmentId: string) => {
    // Use ref instead of closure to prevent callback recreation
    const assignment = assignmentsRef.current.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    // CRITICAL: Prevent re-loading the same assignment (main fix for flicker/disappear)
    if (lastLoadedAssignmentIdRef.current === assignmentId) {
      console.log('[loadAssignmentForEditing] Already loaded, skipping:', assignmentId);
      return;
    }
    
    // CRITICAL: Set loading guard SYNCHRONOUSLY before any state updates
    // This prevents auto-save from overwriting data during load
    loadingAssignmentIdRef.current = assignmentId;
    loadedAssignmentIdRef.current = null; // Mark as not yet loaded
    setIsInitializing(true);
    
    const storageKey = `athlete-assignment-${assignmentId}`;
    const savedData = localStorage.getItem(storageKey);
    
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        const storedExercises = parsed.exerciseDistribution || [];
        const storedSections = Array.isArray(parsed.sessionSections) ? parsed.sessionSections : [];
        const storedSupersets = parsed.supersets || {};
        const storedParams = parsed.parameterValues || {};
        const storedDailyIntensity = parsed.dailyIntensity || [];
        const storedDaySplitStates = parsed.daySplitStates || {};
        
        setExerciseDistribution(storedExercises);
        setSessionSections(storedSections);
        setSupersets(storedSupersets);
        setParameterValues(storedParams);
        setDailyIntensityData(storedDailyIntensity);
        setDaySplitStates(storedDaySplitStates);
        
        // Build training days using stored intensity data
        const days = parsed.trainingDays?.length > 0 
          ? parsed.trainingDays 
          : buildTrainingDaysFromAssignment(assignment, storedDailyIntensity);
        setTrainingDays(days);
        
        // Set the fingerprint to match loaded data so we don't immediately re-save
        const loadedFingerprint = JSON.stringify({
          exerciseDistribution: storedExercises,
          sessionSections: storedSections,
          supersets: storedSupersets,
          parameterValues: storedParams,
          dailyIntensity: storedDailyIntensity,
          trainingDays: days,
          daySplitStates: storedDaySplitStates,
        });
        lastSavedStateRef.current = loadedFingerprint;
        
        console.log('[loadAssignmentForEditing] Loaded data:', {
          exercises: storedExercises.length,
          sections: storedSections.length,
          dailyIntensity: storedDailyIntensity.length,
        });
      } catch (e) {
        console.error('Failed to parse saved assignment data:', e);
        initializeFromAssignment(assignment);
      }
    } else {
      console.log('[loadAssignmentForEditing] No saved data found, initializing from assignment');
      initializeFromAssignment(assignment);
    }
    
    // Mark loading complete after state updates are scheduled
    // Use queueMicrotask to ensure state updates are committed first
    queueMicrotask(() => {
      if (loadingAssignmentIdRef.current === assignmentId) {
        loadingAssignmentIdRef.current = null;
        loadedAssignmentIdRef.current = assignmentId;
        lastLoadedAssignmentIdRef.current = assignmentId; // Prevent future re-loads
        setIsInitializing(false);
      }
    });
  }, [buildTrainingDaysFromAssignment, initializeFromAssignment]);

  // Load when assignment changes
  useEffect(() => {
    if (selectedAssignmentId) {
      loadAssignmentForEditing(selectedAssignmentId);
    }
  }, [selectedAssignmentId, loadAssignmentForEditing]);

  // Auto-save edits to localStorage with ROBUST fingerprinting and debounce
  useEffect(() => {
    // CRITICAL: Multiple guards to prevent overwriting data during load
    // 1. No assignment selected
    if (!selectedAssignmentId) return;
    // 2. Currently initializing (state flag)
    if (isInitializing) return;
    // 3. Currently loading this assignment (synchronous ref guard)
    if (loadingAssignmentIdRef.current !== null) return;
    // 4. This assignment hasn't been successfully loaded yet
    if (loadedAssignmentIdRef.current !== selectedAssignmentId) return;
    
    // Build full save payload for accurate fingerprinting
    const savePayload = {
      exerciseDistribution,
      sessionSections,
      supersets,
      parameterValues,
      dailyIntensity: dailyIntensityData,
      trainingDays,
      daySplitStates,
    };
    
    // ROBUST FINGERPRINT: Full content comparison (not just counts)
    // This catches ALL changes including parameter values, intensities, and metadata
    const stateFingerprint = JSON.stringify(savePayload);
    
    if (stateFingerprint === lastSavedStateRef.current) {
      return; // Skip save if state hasn't changed at all
    }
    
    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // DEBOUNCE: Wait 300ms before saving to prevent rapid-fire writes
    saveTimeoutRef.current = setTimeout(() => {
      // Re-check guards in case something changed during debounce
      if (loadingAssignmentIdRef.current !== null) return;
      if (loadedAssignmentIdRef.current !== selectedAssignmentId) return;
      
      const storageKey = `athlete-assignment-${selectedAssignmentId}`;
      const dataToSave = {
        ...savePayload,
        lastModified: new Date().toISOString(),
      };
      
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      lastSavedStateRef.current = stateFingerprint;
      console.log('[Auto-save] Saved assignment data');
    }, 300);
    
    // Cleanup timeout on unmount or deps change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    selectedAssignmentId,
    isInitializing,
    exerciseDistribution,
    sessionSections,
    supersets,
    parameterValues,
    dailyIntensityData,
    trainingDays,
    daySplitStates,
  ]);

  // === Session Management Handlers ===
  
  const handleAddSession = useCallback((dayDate: string) => {
    setDaySplitStates(prev => {
      const currentSessions = prev[dayDate] ?? 1;
      return { ...prev, [dayDate]: currentSessions + 1 };
    });
    
    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== dayDate) return day;
        const sessions = (day.sessions || 0) + 1;
        const sessionNames = [...(day.sessionNames || [])];
        sessionNames.push(`Session ${sessions}`);
        return { ...day, sessions, sessionNames };
      })
    );
    
    toast({ title: "Session added" });
  }, [toast]);

  const handleDeleteSession = useCallback((dayDate: string, sessionIndex: number) => {
    const currentSessions = daySplitStates[dayDate] ?? 1;
    
    if (currentSessions <= 1) {
      // Last session - set to off
      setExerciseDistribution(prev => prev.filter(ex => ex.dayDate !== dayDate));
      setSessionSections(prev => prev.filter(s => s.dayDate !== dayDate));
      setSupersets(prev => {
        const newSupersets = { ...prev };
        delete newSupersets[dayDate];
        return newSupersets;
      });
      setDaySplitStates(prev => ({ ...prev, [dayDate]: 0 }));
      setTrainingDays(prev =>
        prev.map(day => day.date === dayDate ? { ...day, sessions: 0, sessionNames: [], intensity: 'off' as IntensityLevel } : day)
      );
      setDailyIntensityData(prev =>
        prev.map(di => di.date === dayDate ? { ...di, intensity: 'off' } : di)
      );
      toast({ title: "Last session deleted", description: "Day intensity set to 'off'" });
      return;
    }
    
    // Delete exercises and shift
    setExerciseDistribution(prev =>
      prev.filter(ex => !(ex.dayDate === dayDate && ex.sessionIndex === sessionIndex))
        .map(ex => ex.dayDate === dayDate && ex.sessionIndex > sessionIndex
          ? { ...ex, sessionIndex: ex.sessionIndex - 1 }
          : ex)
    );
    
    setSessionSections(prev =>
      prev.filter(s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex))
        .map(s => s.dayDate === dayDate && s.sessionIndex > sessionIndex
          ? { ...s, sessionIndex: s.sessionIndex - 1 }
          : s)
    );
    
    setDaySplitStates(prev => ({ ...prev, [dayDate]: currentSessions - 1 }));
    toast({ title: "Session deleted" });
  }, [daySplitStates, toast]);

  const handleCopySession = useCallback((dayDate: string, sessionIndex: number) => {
    const sessionExercises = exerciseDistribution.filter(
      ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex
    );
    const sessionSectionsForSession = sessionSections.filter(
      s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
    );
    
    if (sessionExercises.length === 0) {
      toast({ title: "Cannot copy", description: "This session has no exercises", variant: "destructive" });
      return;
    }
    
    // Get supersets for this session
    const sessionSupersets = supersets[dayDate]?.[sessionIndex] || {};
    
    // Get metadata from source day for creating complete days when pasting outside range
    const sourceDay = trainingDays.find(d => d.date === dayDate);
    const dayIntensity = dailyIntensityData.find(d => d.date === dayDate);
    
    setCopiedSession({
      exercises: sessionExercises,
      sections: sessionSectionsForSession,
      supersets: sessionSupersets,
      sourceDate: dayDate,
      sessionIndex,
      sourceMesocycleId: sourceDay?.mesocycleId,
      sourceMicrocycleId: sourceDay?.microcycleId,
      sourceIntensity: dayIntensity?.intensity || sourceDay?.intensity,
    });
    
    toast({ title: "Session copied", description: `${sessionExercises.length} exercise(s) copied` });
  }, [exerciseDistribution, sessionSections, supersets, trainingDays, dailyIntensityData, toast]);

  const handlePasteSession = useCallback((targetDate: string) => {
    if (!copiedSession) return;
    
    const targetDayExercises = exerciseDistribution.filter(ex => ex.dayDate === targetDate);
    const maxSessionIndex = targetDayExercises.length > 0
      ? Math.max(...targetDayExercises.map(ex => ex.sessionIndex))
      : -1;
    const newSessionIndex = maxSessionIndex + 1;
    
    // Calculate initial splitState for target day
    const currentSplitState = daySplitStates[targetDate] ?? 0;
    const newSplitState = Math.max(currentSplitState, newSessionIndex + 1);
    
    setDaySplitStates(prev => ({ ...prev, [targetDate]: newSplitState }));
    
    const sectionIdMapping = new Map<string, string>();
    copiedSession.sections.forEach(section => {
      sectionIdMapping.set(section.id, `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    });
    
    const pastedSections = copiedSession.sections.map(section => ({
      ...section,
      id: sectionIdMapping.get(section.id)!,
      dayDate: targetDate,
      sessionIndex: newSessionIndex,
    }));
    
    const exerciseIdMapping = new Map<string, string>();
    const pastedExercises = copiedSession.exercises.map(ex => {
      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      exerciseIdMapping.set(ex.id, newId);
      return {
        ...ex,
        id: newId,
        dayDate: targetDate,
        sessionIndex: newSessionIndex,
        sectionId: ex.sectionId ? sectionIdMapping.get(ex.sectionId) : undefined,
      };
    });
    
    setExerciseDistribution(prev => [...prev, ...pastedExercises]);
    setSessionSections(prev => [...prev, ...pastedSections]);
    
    // Remap and copy supersets for the pasted session
    setSupersets(prev => {
      const newSupersets = { ...prev };
      if (Object.keys(copiedSession.supersets).length > 0) {
        if (!newSupersets[targetDate]) {
          newSupersets[targetDate] = {};
        }
        newSupersets[targetDate][newSessionIndex] = {};
        
        Object.entries(copiedSession.supersets).forEach(([sectionKey, supersetMap]) => {
          const destSectionKey = sectionKey === '__unsectioned__'
            ? '__unsectioned__'
            : (sectionIdMapping.get(sectionKey) || sectionKey);
          newSupersets[targetDate][newSessionIndex][destSectionKey] = {};
          
          Object.entries(supersetMap).forEach(([supersetId, exerciseIds]) => {
            const mappedIds = exerciseIds.map(id => exerciseIdMapping.get(id)).filter(Boolean) as string[];
            if (mappedIds.length >= 2) {
              newSupersets[targetDate][newSessionIndex][destSectionKey][supersetId] = mappedIds;
            }
          });
        });
      }
      return newSupersets;
    });
    
    // FIX: Use merge logic to ensure target day exists (for pasting outside range)
    const targetDateObj = new Date(targetDate);
    const intensity = copiedSession.sourceIntensity || ('moderate' as IntensityLevel);
    
    setTrainingDays(prev => {
      const updated = [...prev];
      const existingIdx = updated.findIndex(d => d.date === targetDate);
      
      if (existingIdx >= 0) {
        // Update existing day
        const existingDay = updated[existingIdx];
        const sessionNames = [...(existingDay.sessionNames || [])];
        while (sessionNames.length <= newSessionIndex) {
          sessionNames.push(`Session ${sessionNames.length + 1}`);
        }
        updated[existingIdx] = {
          ...existingDay,
          sessions: newSplitState,
          sessionNames,
          isTrainingDay: true,
          intensity, // Apply copied intensity
        };
      } else {
        // Add new day entry with metadata from source session
        updated.push({
          date: targetDate,
          dayOfWeek: targetDateObj.getDay(),
          dayName: format(targetDateObj, 'EEEE'),
          mesocycleId: copiedSession.sourceMesocycleId || '',
          microcycleId: copiedSession.sourceMicrocycleId || '',
          isTrainingDay: true,
          isTestDay: false,
          isEventDay: false,
          intensity,
          sessions: newSplitState,
          sessionNames: Array.from({ length: newSplitState }, (_, i) => `Session ${i + 1}`),
        } as TrainingDay);
      }
      
      return updated.sort((a, b) => a.date.localeCompare(b.date));
    });
    
    // Update dailyIntensityData with copied intensity
    setDailyIntensityData(prev => {
      const updated = [...prev];
      const existingIdx = updated.findIndex(di => di.date === targetDate);
      if (existingIdx >= 0) {
        // Update existing entry with copied intensity
        updated[existingIdx] = { ...updated[existingIdx], intensity };
        return updated;
      }
      return [...updated, { date: targetDate, intensity }].sort((a, b) => a.date.localeCompare(b.date));
    });
    
    toast({ title: "Session pasted", description: `${copiedSession.exercises.length} exercise(s) pasted` });
    setCopiedSession(null);
  }, [copiedSession, exerciseDistribution, daySplitStates, toast]);

  // === Day Management Handlers ===
  
  const handleCopyDay = useCallback((dayDate: string) => {
    const dayExercises = exerciseDistribution.filter(ex => ex.dayDate === dayDate);
    const daySections = sessionSections.filter(s => s.dayDate === dayDate);
    const daySupersets = supersets[dayDate] || {};
    const day = trainingDays.find(d => d.date === dayDate);
    
    if (dayExercises.length === 0) {
      toast({ title: "Cannot copy", description: "This day has no exercises", variant: "destructive" });
      return;
    }
    
    setCopiedDay({
      exercises: dayExercises,
      sections: daySections,
      supersets: daySupersets,
      sourceDate: dayDate,
      intensity: day?.intensity,
      splitState: daySplitStates[dayDate],
      testNames: day?.testNames,
      eventNames: day?.eventNames,
      // Metadata for creating complete days when pasting outside range
      sourceMesocycleId: day?.mesocycleId,
      sourceMicrocycleId: day?.microcycleId,
    });
    
    toast({ title: "Day copied", description: `${dayExercises.length} exercise(s) copied` });
  }, [exerciseDistribution, sessionSections, supersets, trainingDays, daySplitStates, toast]);

  const handleClearDay = useCallback((dayDate: string) => {
    setExerciseDistribution(prev => prev.filter(ex => ex.dayDate !== dayDate));
    setSessionSections(prev => prev.filter(s => s.dayDate !== dayDate));
    setSupersets(prev => {
      const newSupersets = { ...prev };
      delete newSupersets[dayDate];
      return newSupersets;
    });
    setDaySplitStates(prev => ({ ...prev, [dayDate]: 0 }));
    setTrainingDays(prev =>
      prev.map(day => day.date === dayDate ? { ...day, sessions: 0, sessionNames: [] } : day)
    );
    
    toast({ title: "Day cleared" });
  }, [toast]);

  const handlePasteDay = useCallback((targetDate: string) => {
    if (!copiedDay) return;
    
    console.log('[handlePasteDay] Starting paste:', {
      sourceDate: copiedDay.sourceDate,
      targetDate,
      exerciseCount: copiedDay.exercises.length,
    });
    
    // Clear target day first (overwrite behavior)
    setExerciseDistribution(prev => prev.filter(ex => ex.dayDate !== targetDate));
    setSessionSections(prev => prev.filter(s => s.dayDate !== targetDate));
    
    const sectionIdMapping = new Map<string, string>();
    copiedDay.sections.forEach(section => {
      sectionIdMapping.set(section.id, `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    });
    
    const exerciseIdMapping = new Map<string, string>();
    const pastedExercises = copiedDay.exercises.map(ex => {
      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      exerciseIdMapping.set(ex.id, newId);
      return {
        ...ex,
        id: newId,
        dayDate: targetDate,
        sectionId: ex.sectionId ? sectionIdMapping.get(ex.sectionId) : undefined,
      };
    });
    
    const pastedSections = copiedDay.sections.map(section => ({
      ...section,
      id: sectionIdMapping.get(section.id)!,
      dayDate: targetDate,
    }));
    
    // Remap supersets
    const newSupersets = { ...supersets };
    delete newSupersets[targetDate];
    
    if (Object.keys(copiedDay.supersets).length > 0) {
      newSupersets[targetDate] = {};
      Object.entries(copiedDay.supersets).forEach(([sessionIdx, sessionSupersets]) => {
        newSupersets[targetDate][parseInt(sessionIdx)] = {};
        Object.entries(sessionSupersets).forEach(([sectionKey, supersetMap]) => {
          const destSectionKey = sectionKey === '__unsectioned__'
            ? '__unsectioned__'
            : (sectionIdMapping.get(sectionKey) || sectionKey);
          newSupersets[targetDate][parseInt(sessionIdx)][destSectionKey] = {};
          Object.entries(supersetMap).forEach(([supersetId, exerciseIds]) => {
            const mappedIds = exerciseIds.map(id => exerciseIdMapping.get(id)).filter(Boolean) as string[];
            if (mappedIds.length >= 2) {
              newSupersets[targetDate][parseInt(sessionIdx)][destSectionKey][supersetId] = mappedIds;
            }
          });
        });
      });
    }
    
    setExerciseDistribution(prev => [...prev, ...pastedExercises]);
    setSessionSections(prev => [...prev, ...pastedSections]);
    setSupersets(newSupersets);
    setDaySplitStates(prev => ({ ...prev, [targetDate]: copiedDay.splitState || 1 }));
    
    // FIX: Use merge logic instead of map to ensure target day exists
    const targetDateObj = new Date(targetDate);
    const intensity = copiedDay.intensity || ('moderate' as IntensityLevel);
    
    setTrainingDays(prev => {
      const updated = [...prev];
      const existingIdx = updated.findIndex(d => d.date === targetDate);
      
      if (existingIdx >= 0) {
        // Update existing day
        updated[existingIdx] = {
          ...updated[existingIdx],
          intensity,
          sessions: copiedDay.splitState || 1,
          sessionNames: Array.from({ length: copiedDay.splitState || 1 }, (_, i) => `Session ${i + 1}`),
          isTrainingDay: true,
        };
      } else {
        // Add new day entry with metadata from source day
        updated.push({
          date: targetDate,
          dayOfWeek: targetDateObj.getDay(),
          dayName: format(targetDateObj, 'EEEE'),
          mesocycleId: copiedDay.sourceMesocycleId || '',
          microcycleId: copiedDay.sourceMicrocycleId || '',
          isTrainingDay: true,
          isTestDay: false,
          isEventDay: false,
          intensity,
          sessions: copiedDay.splitState || 1,
          sessionNames: Array.from({ length: copiedDay.splitState || 1 }, (_, i) => `Session ${i + 1}`),
        } as TrainingDay);
      }
      
      // Sort by date
      return updated.sort((a, b) => a.date.localeCompare(b.date));
    });
    
    setDailyIntensityData(prev => {
      const existingIdx = prev.findIndex(di => di.date === targetDate);
      if (existingIdx >= 0) {
        const newData = [...prev];
        newData[existingIdx] = { ...newData[existingIdx], intensity };
        return newData;
      } else {
        return [...prev, { date: targetDate, intensity }].sort((a, b) => a.date.localeCompare(b.date));
      }
    });
    
    console.log('[handlePasteDay] Paste complete:', {
      pastedExercises: pastedExercises.length,
      pastedSections: pastedSections.length,
    });
    
    toast({ title: "Day pasted", description: `${pastedExercises.length} exercise(s) pasted` });
    setCopiedDay(null);
  }, [copiedDay, supersets, toast]);

  // === Week Management Handlers ===

  const handleCopyWeek = useCallback((weekStartDate: string) => {
    const startDate = new Date(weekStartDate);
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDates.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
    }

    const weekExercises = exerciseDistribution.filter(ex => weekDates.includes(ex.dayDate));
    const weekSections = sessionSections.filter(s => weekDates.includes(s.dayDate));
    const weekTrainingDays = trainingDays.filter(td => weekDates.includes(td.date));

    if (weekExercises.length === 0) {
      toast({ title: "Cannot copy", description: "This week has no exercises", variant: "destructive" });
      return;
    }

    // Build session structure: which days have which session indices
    const sessionStructure: Record<string, number[]> = {};
    weekDates.forEach(dayDate => {
      const dayExercises = weekExercises.filter(ex => ex.dayDate === dayDate);
      const sessionIndices = [...new Set(dayExercises.map(ex => ex.sessionIndex))].sort((a, b) => a - b);
      if (sessionIndices.length > 0) {
        sessionStructure[dayDate] = sessionIndices;
      }
    });

    // Copy supersets for this week
    const weekSupersets: SupersetMapping = {};
    weekDates.forEach(dayDate => {
      if (supersets[dayDate]) {
        weekSupersets[dayDate] = supersets[dayDate];
      }
    });

    setCopiedWeek({
      exercises: weekExercises,
      sections: weekSections,
      supersets: weekSupersets,
      sessionStructure,
      weekStartDate,
      trainingDays: weekTrainingDays,
    });

    toast({ title: "Week copied", description: `${weekExercises.length} exercise(s) copied` });
  }, [exerciseDistribution, sessionSections, supersets, trainingDays, toast]);

  const handleClearWeek = useCallback((weekStartDate: string) => {
    const startDate = new Date(weekStartDate);
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDates.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
    }

    setExerciseDistribution(prev => prev.filter(ex => !weekDates.includes(ex.dayDate)));
    setSessionSections(prev => prev.filter(s => !weekDates.includes(s.dayDate)));
    setSupersets(prev => {
      const newSupersets = { ...prev };
      weekDates.forEach(d => delete newSupersets[d]);
      return newSupersets;
    });
    setDaySplitStates(prev => {
      const newStates = { ...prev };
      weekDates.forEach(d => { newStates[d] = 0; });
      return newStates;
    });
    setTrainingDays(prev =>
      prev.map(day => weekDates.includes(day.date) 
        ? { ...day, sessions: 0, sessionNames: [] } 
        : day
      )
    );

    toast({ title: "Week cleared" });
  }, [toast]);

  const handlePasteWeek = useCallback((targetWeekStartDate: string) => {
    if (!copiedWeek) return;

    console.log('[handlePasteWeek] Starting paste:', {
      sourceWeek: copiedWeek.weekStartDate,
      targetWeek: targetWeekStartDate,
      exerciseCount: copiedWeek.exercises.length,
      sectionCount: copiedWeek.sections.length,
    });

    const sourceStart = new Date(copiedWeek.weekStartDate);
    const targetStart = new Date(targetWeekStartDate);
    const dayOffset = differenceInDays(targetStart, sourceStart);

    // Calculate new section IDs
    const sectionIdMapping = new Map<string, string>();
    copiedWeek.sections.forEach(section => {
      sectionIdMapping.set(section.id, `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    });

    // Calculate new exercise IDs
    const exerciseIdMapping = new Map<string, string>();
    copiedWeek.exercises.forEach(ex => {
      exerciseIdMapping.set(ex.id, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    });

    // For each source day, calculate target day and session offset
    const pastedExercises: ExerciseDistribution[] = [];
    const pastedSections: SessionSection[] = [];
    const newDaySplitUpdates: Record<string, number> = {};
    const newTrainingDayUpdates: Record<string, Partial<TrainingDay>> = {};

    Object.entries(copiedWeek.sessionStructure).forEach(([sourceDayDate, sessionIndices]) => {
      const sourceDate = new Date(sourceDayDate);
      const targetDate = addDays(sourceDate, dayOffset);
      const targetDayDate = format(targetDate, 'yyyy-MM-dd');

      // Calculate session offset based on existing sessions on target day
      const existingSessionsOnTarget = exerciseDistribution.filter(ex => ex.dayDate === targetDayDate);
      const maxExistingSessionIndex = existingSessionsOnTarget.length > 0
        ? Math.max(...existingSessionsOnTarget.map(ex => ex.sessionIndex))
        : -1;
      const sessionOffset = maxExistingSessionIndex + 1;

      // Map old session indices to new ones
      const sessionIndexMapping = new Map<number, number>();
      sessionIndices.forEach((oldIdx, i) => {
        sessionIndexMapping.set(oldIdx, sessionOffset + i);
      });

      // Copy sections for this day
      copiedWeek.sections
        .filter(s => s.dayDate === sourceDayDate)
        .forEach(section => {
          const newSessionIndex = sessionIndexMapping.get(section.sessionIndex) ?? section.sessionIndex;
          pastedSections.push({
            ...section,
            id: sectionIdMapping.get(section.id)!,
            dayDate: targetDayDate,
            sessionIndex: newSessionIndex,
          });
        });

      // Copy exercises for this day
      copiedWeek.exercises
        .filter(ex => ex.dayDate === sourceDayDate)
        .forEach(ex => {
          const newSessionIndex = sessionIndexMapping.get(ex.sessionIndex) ?? ex.sessionIndex;
          pastedExercises.push({
            ...ex,
            id: exerciseIdMapping.get(ex.id)!,
            dayDate: targetDayDate,
            sessionIndex: newSessionIndex,
            sectionId: ex.sectionId ? sectionIdMapping.get(ex.sectionId) : undefined,
          });
        });

      // Track updates needed
      const newMaxSession = sessionOffset + sessionIndices.length;
      const currentSplit = daySplitStates[targetDayDate] ?? 0;
      newDaySplitUpdates[targetDayDate] = Math.max(currentSplit, newMaxSession);

      // Build training day update - include full day structure for new days
      // FIX: Copy intensity from source training day, not target
      const existingDay = trainingDays.find(d => d.date === targetDayDate);
      const sourceTrainingDay = copiedWeek.trainingDays.find(td => td.date === sourceDayDate);
      const copiedIntensity = sourceTrainingDay?.intensity || ('moderate' as IntensityLevel);
      
      const existingNames = existingDay?.sessionNames || [];
      const newNames = [...existingNames];
      for (let i = existingNames.length; i < newMaxSession; i++) {
        newNames.push(`Session ${i + 1}`);
      }
      
      newTrainingDayUpdates[targetDayDate] = {
        date: targetDayDate,
        dayOfWeek: targetDate.getDay(),
        dayName: format(targetDate, 'EEEE'),
        isTrainingDay: true,
        intensity: copiedIntensity, // Use intensity from source day
        sessions: Math.max(currentSplit, newMaxSession),
        sessionNames: newNames,
      };
    });

    console.log('[handlePasteWeek] Updates prepared:', {
      pastedExercises: pastedExercises.length,
      pastedSections: pastedSections.length,
      daySplitUpdates: Object.keys(newDaySplitUpdates),
      trainingDayUpdates: Object.keys(newTrainingDayUpdates),
    });

    // Apply updates
    setExerciseDistribution(prev => [...prev, ...pastedExercises]);
    setSessionSections(prev => [...prev, ...pastedSections]);
    setDaySplitStates(prev => ({ ...prev, ...newDaySplitUpdates }));
    
    // FIX: Use merge logic instead of map to add missing days
    setTrainingDays(prev => {
      const updated = [...prev];
      Object.entries(newTrainingDayUpdates).forEach(([date, update]) => {
        const existingIdx = updated.findIndex(d => d.date === date);
        if (existingIdx >= 0) {
          // Update existing day
          updated[existingIdx] = { ...updated[existingIdx], ...update };
        } else {
          // Add new day entry
          updated.push({
            date,
            dayOfWeek: update.dayOfWeek ?? new Date(date).getDay(),
            dayName: update.dayName ?? format(new Date(date), 'EEEE'),
            isTrainingDay: true,
            intensity: update.intensity ?? ('moderate' as IntensityLevel),
            sessions: update.sessions ?? 1,
            sessionNames: update.sessionNames ?? ['Session 1'],
          } as TrainingDay);
        }
      });
      // Sort by date
      return updated.sort((a, b) => a.date.localeCompare(b.date));
    });

    // Remap supersets
    const newSupersets = { ...supersets };
    Object.entries(copiedWeek.supersets).forEach(([sourceDayDate, daySupersets]) => {
      const sourceDate = new Date(sourceDayDate);
      const targetDate = addDays(sourceDate, dayOffset);
      const targetDayDate = format(targetDate, 'yyyy-MM-dd');

      // Get session offset for this day
      const existingSessionsOnTarget = exerciseDistribution.filter(ex => ex.dayDate === targetDayDate);
      const maxExistingSessionIndex = existingSessionsOnTarget.length > 0
        ? Math.max(...existingSessionsOnTarget.map(ex => ex.sessionIndex))
        : -1;
      const sessionOffset = maxExistingSessionIndex + 1;

      if (!newSupersets[targetDayDate]) {
        newSupersets[targetDayDate] = {};
      }

      Object.entries(daySupersets).forEach(([sessionIdxStr, sessionSupersets]) => {
        const oldSessionIdx = parseInt(sessionIdxStr);
        const newSessionIdx = sessionOffset + oldSessionIdx;

        if (!newSupersets[targetDayDate][newSessionIdx]) {
          newSupersets[targetDayDate][newSessionIdx] = {};
        }

        Object.entries(sessionSupersets).forEach(([sectionKey, supersetMap]) => {
          const destSectionKey = sectionKey === '__unsectioned__'
            ? '__unsectioned__'
            : (sectionIdMapping.get(sectionKey) || sectionKey);

          if (!newSupersets[targetDayDate][newSessionIdx][destSectionKey]) {
            newSupersets[targetDayDate][newSessionIdx][destSectionKey] = {};
          }

          Object.entries(supersetMap).forEach(([supersetId, exerciseIds]) => {
            const mappedIds = exerciseIds.map(id => exerciseIdMapping.get(id)).filter(Boolean) as string[];
            if (mappedIds.length >= 2) {
              newSupersets[targetDayDate][newSessionIdx][destSectionKey][supersetId] = mappedIds;
            }
          });
        });
      });
    });

    setSupersets(newSupersets);
    
    // FIX: Also update dailyIntensityData to sync intensity values
    setDailyIntensityData(prev => {
      const updated = [...prev];
      Object.entries(newTrainingDayUpdates).forEach(([date, dayUpdate]) => {
        const existingIdx = updated.findIndex(di => di.date === date);
        if (existingIdx >= 0) {
          updated[existingIdx] = { ...updated[existingIdx], intensity: dayUpdate.intensity };
        } else {
          updated.push({ date, intensity: dayUpdate.intensity });
        }
      });
      return updated.sort((a, b) => a.date.localeCompare(b.date));
    });

    toast({ title: "Week pasted", description: `${pastedExercises.length} exercise(s) pasted as new sessions` });
    setCopiedWeek(null);
  }, [copiedWeek, exerciseDistribution, supersets, daySplitStates, trainingDays, toast]);

  // === Test/Event Management Handlers ===

  const handleAddTestEvent = useCallback((
    dayDate: string,
    type: 'test' | 'event',
    id: string,
    name: string,
    isNew: boolean,
    comments?: string
  ) => {
    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== dayDate) return day;
        if (type === 'test') {
          const testNames = [...(day.testNames || [])];
          if (!testNames.includes(name)) {
            testNames.push(name);
          }
          return { ...day, testNames, isTestDay: true };
        } else {
          const eventNames = [...(day.eventNames || [])];
          if (!eventNames.includes(name)) {
            eventNames.push(name);
          }
          return { ...day, eventNames, isEventDay: true };
        }
      })
    );
    toast({ title: `${type === 'test' ? 'Test' : 'Event'} added`, description: name });
  }, [toast]);

  const handleDeleteTestEvent = useCallback((dayDate: string, type: 'test' | 'event', name: string) => {
    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== dayDate) return day;
        if (type === 'test') {
          const testNames = (day.testNames || []).filter(t => t !== name);
          return { ...day, testNames, isTestDay: testNames.length > 0 };
        } else {
          const eventNames = (day.eventNames || []).filter(e => e !== name);
          return { ...day, eventNames, isEventDay: eventNames.length > 0 };
        }
      })
    );
    toast({ title: `${type === 'test' ? 'Test' : 'Event'} removed` });
  }, [toast]);

  // === Section Management Handlers ===
  
  const handleAddSectionToSession = useCallback((dayDate: string, sessionIndex: number) => {
    const existingSections = sessionSections.filter(
      s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
    );
    const newSectionNumber = existingSections.length + 1;
    
    const newSection: SessionSection = {
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dayDate,
      sessionIndex,
      name: `Section ${newSectionNumber}`,
      order: newSectionNumber,
    };
    
    setSessionSections(prev => [...prev, newSection]);
    toast({ title: "Section added" });
  }, [sessionSections, toast]);

  const handleSectionReorder = useCallback((dayDate: string, sessionIndex: number, sectionId: string, direction: 'up' | 'down') => {
    setSessionSections(prev => {
      const sessionSectionsArr = prev
        .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)
        .sort((a, b) => a.order - b.order);
      
      const idx = sessionSectionsArr.findIndex(s => s.id === sectionId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === sessionSectionsArr.length - 1) return prev;
      
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      const tempOrder = sessionSectionsArr[idx].order;
      sessionSectionsArr[idx].order = sessionSectionsArr[swapIdx].order;
      sessionSectionsArr[swapIdx].order = tempOrder;
      
      return prev.map(s => {
        const updated = sessionSectionsArr.find(ss => ss.id === s.id);
        return updated || s;
      });
    });
  }, []);

  const handleSectionDuplicate = useCallback((dayDate: string, sessionIndex: number, sectionId: string) => {
    const section = sessionSections.find(s => s.id === sectionId);
    if (!section) return;
    
    const sectionExercises = exerciseDistribution.filter(ex => ex.sectionId === sectionId);
    const existingSections = sessionSections.filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex);
    
    const newSectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSection: SessionSection = {
      ...section,
      id: newSectionId,
      name: `${section.name} (Copy)`,
      order: existingSections.length + 1,
    };
    
    const newExercises = sectionExercises.map(ex => ({
      ...ex,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sectionId: newSectionId,
    }));
    
    setSessionSections(prev => [...prev, newSection]);
    setExerciseDistribution(prev => [...prev, ...newExercises]);
    toast({ title: "Section duplicated" });
  }, [sessionSections, exerciseDistribution, toast]);

  const handleSectionDelete = useCallback((dayDate: string, sessionIndex: number, sectionId: string) => {
    const sectionExercises = exerciseDistribution.filter(ex => ex.sectionId === sectionId);
    
    // Cleanup supersets for deleted exercises
    let cleanedSupersets = supersets;
    sectionExercises.forEach(ex => {
      cleanedSupersets = cleanupSupersetsOnExerciseDelete(cleanedSupersets, ex.id);
    });
    
    setExerciseDistribution(prev => prev.filter(ex => ex.sectionId !== sectionId));
    setSessionSections(prev => prev.filter(s => s.id !== sectionId));
    setSupersets(cleanedSupersets);
    toast({ title: "Section deleted" });
  }, [exerciseDistribution, supersets, toast]);

  const handleSectionCommentChange = useCallback((sectionId: string, comment: string) => {
    setSessionSections(prev =>
      prev.map(s => s.id === sectionId ? { ...s, comments: comment } : s)
    );
  }, []);

  // === Exercise Management Handlers ===
  
  const handleAddExerciseToSection = useCallback((dayDate: string, sessionIndex: number, sectionId: string) => {
    // This opens the exercise library popup - the actual addition happens via onExerciseChange
    // Return the context needed for the popup
    return { dayDate, sessionIndex, sectionId };
  }, []);

  const handleExerciseReorder = useCallback((dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string, direction: 'up' | 'down') => {
    setExerciseDistribution(prev => {
      const sectionExercises = prev
        .filter(ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex && ex.sectionId === sectionId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
      const idx = sectionExercises.findIndex(ex => ex.id === exerciseId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === sectionExercises.length - 1) return prev;
      
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      const tempOrder = sectionExercises[idx].order;
      sectionExercises[idx].order = sectionExercises[swapIdx].order;
      sectionExercises[swapIdx].order = tempOrder;
      
      return prev.map(ex => {
        const updated = sectionExercises.find(se => se.id === ex.id);
        return updated || ex;
      });
    });
  }, []);

  const handleExerciseDuplicate = useCallback((dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => {
    const exercise = exerciseDistribution.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    const sectionExercises = exerciseDistribution.filter(
      ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex && ex.sectionId === sectionId
    );
    
    const newExercise: ExerciseDistribution = {
      ...exercise,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      order: sectionExercises.length,
    };
    
    setExerciseDistribution(prev => [...prev, newExercise]);
    toast({ title: "Exercise duplicated" });
  }, [exerciseDistribution, toast]);

  const handleExerciseDelete = useCallback((dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => {
    const cleanedSupersets = cleanupSupersetsOnExerciseDelete(supersets, exerciseId);
    
    setExerciseDistribution(prev => prev.filter(ex => ex.id !== exerciseId));
    setSupersets(cleanedSupersets);
    toast({ title: "Exercise deleted" });
  }, [supersets, toast]);

  const handleExerciseNotesChange = useCallback((exerciseId: string, notes: string) => {
    setExerciseDistribution(prev =>
      prev.map(ex => ex.id === exerciseId ? { ...ex, notes } : ex)
    );
  }, []);

  const handleExerciseEachSideChange = useCallback((exerciseId: string, eachSide: boolean) => {
    setExerciseDistribution(prev =>
      prev.map(ex => ex.id === exerciseId ? { ...ex, eachSide } : ex)
    );
  }, []);

  const handleExerciseAutoCalcChange = useCallback((exerciseId: string, field: 'autoCalculateWeight' | 'autoCalculateTargetHR', value: boolean) => {
    setExerciseDistribution(prev =>
      prev.map(ex => ex.id === exerciseId ? { ...ex, [field]: value } : ex)
    );
  }, []);

  const handleExerciseChange = useCallback((
    dayDate: string,
    sessionIndex: number,
    sectionId: string,
    exerciseId: string,
    newExercise: { exerciseId: string; exerciseName: string; libraryId: string }
  ) => {
    setExerciseDistribution(prev =>
      prev.map(ex => {
        if (ex.id === exerciseId) {
          return {
            ...ex,
            exerciseId: newExercise.exerciseId,
            exerciseName: newExercise.exerciseName,
          };
        }
        return ex;
      })
    );
    toast({ title: "Exercise changed" });
  }, [toast]);

  // === Intensity Management Handlers ===
  
  const handleDayIntensityChange = useCallback((dayDate: string, intensity: IntensityLevel) => {
    setTrainingDays(prev =>
      prev.map(day => day.date === dayDate ? { ...day, intensity } : day)
    );
    setDailyIntensityData(prev =>
      prev.map(di => di.date === dayDate ? { ...di, intensity } : di)
    );
  }, []);

  const handleSessionIntensityChange = useCallback((dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
    // For single session days, also update day intensity
    const day = trainingDays.find(d => d.date === dayDate);
    if (day?.sessions === 1) {
      handleDayIntensityChange(dayDate, intensity);
    }
  }, [trainingDays, handleDayIntensityChange]);

  // === Session Naming Handlers ===
  
  const handleSessionNameChange = useCallback((dayDate: string, sessionIndex: number, newName: string) => {
    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== dayDate) return day;
        const sessionNames = [...(day.sessionNames || [])];
        while (sessionNames.length <= sessionIndex) {
          sessionNames.push(`Session ${sessionNames.length + 1}`);
        }
        sessionNames[sessionIndex] = newName;
        return { ...day, sessionNames };
      })
    );
  }, []);

  const handleSessionCommentChange = useCallback((dayDate: string, sessionIndex: number, comment: string) => {
    // Store in localStorage for this assignment
    if (selectedAssignmentId) {
      const key = `athlete-session-comment-${selectedAssignmentId}-${dayDate}-${sessionIndex}`;
      localStorage.setItem(key, comment);
    }
  }, [selectedAssignmentId]);

  // === Superset Management ===
  
  const handleToggleSuperset = useCallback((dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string, sectionId?: string) => {
    const result = toggleSuperset(supersets, dayDate, sessionIndex, exerciseId1, exerciseId2, sectionId);
    setSupersets(result.newSupersets);
    toast({ title: result.message });
  }, [supersets, toast]);

  // === Parameter Handlers ===
  
  const handleParameterChange = useCallback((
    dayDate: string,
    sessionIndex: number,
    methodId: string,
    categoryName: string,
    parameterName: string,
    value: string | number
  ) => {
    // Store parameter values - simplified for athlete calendar
    setParameterValues(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      const key = `${dayDate}_${sessionIndex}`;
      if (!updated[key]) updated[key] = {};
      if (!updated[key][methodId]) updated[key][methodId] = {};
      updated[key][methodId][parameterName] = value;
      return updated;
    });
  }, []);

  // === Calculate Calendar Days for Master Planner ===
  
  const allAssignmentDays = useMemo((): CalendarDay[] => {
    if (!selectedAssignment) return [];
    
    return trainingDays.map(trainingDay => {
      const dateStr = trainingDay.date;
      const dayExercises = exerciseDistribution.filter(e => e.dayDate === dateStr);
      const daySessions = daySplitStates[dateStr] || (trainingDay.intensity === 'off' ? 0 : 1);
      
      const sessions = [];
      for (let sessionIdx = 0; sessionIdx < Math.max(daySessions, 1); sessionIdx++) {
        const sessionExercises = dayExercises.filter(e => e.sessionIndex === sessionIdx);
        sessions.push({
          id: `${dateStr}-${sessionIdx}`,
          sessionIndex: sessionIdx,
          sessionName: trainingDay.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`,
          exercises: sessionExercises,
          methods: [...new Set(sessionExercises.map(e => e.methodId))],
          sessionIntensity: trainingDay.intensity,
        });
      }
      
      return {
        date: new Date(dateStr),
        dateString: dateStr,
        isCurrentMonth: true,
        trainingDay,
        sessions: daySessions > 0 ? sessions : [],
        totalExercises: dayExercises.length,
      };
    });
  }, [selectedAssignment, trainingDays, exerciseDistribution, daySplitStates]);

  return {
    // State
    exerciseDistribution,
    sessionSections,
    supersets,
    parameterValues,
    dailyIntensityData,
    trainingDays,
    daySplitStates,
    copiedSession,
    copiedDay,
    copiedWeek,
    selectedAssignment,
    allAssignmentDays,
    
    // Session handlers
    handleAddSession,
    handleDeleteSession,
    handleCopySession,
    handlePasteSession,
    
    // Day handlers
    handleCopyDay,
    handleClearDay,
    handlePasteDay,
    
    // Week handlers
    handleCopyWeek,
    handleClearWeek,
    handlePasteWeek,
    
    // Test/Event handlers
    handleAddTestEvent,
    handleDeleteTestEvent,
    
    // Section handlers
    handleAddSectionToSession,
    handleSectionReorder,
    handleSectionDuplicate,
    handleSectionDelete,
    handleSectionCommentChange,
    
    // Exercise handlers
    handleAddExerciseToSection,
    handleExerciseReorder,
    handleExerciseDuplicate,
    handleExerciseDelete,
    handleExerciseNotesChange,
    handleExerciseEachSideChange,
    handleExerciseAutoCalcChange,
    handleExerciseChange,
    
    // Intensity handlers
    handleDayIntensityChange,
    handleSessionIntensityChange,
    
    // Session naming handlers
    handleSessionNameChange,
    handleSessionCommentChange,
    
    // Superset handlers
    handleToggleSuperset,
    
    // Parameter handlers
    handleParameterChange,
    
    // State setters for direct manipulation
    setExerciseDistribution,
    setSessionSections,
    setSupersets,
  };
}
