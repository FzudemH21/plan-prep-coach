import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { format, addDays, parseISO, eachDayOfInterval } from 'date-fns';
import { AthleteCalendarAssignment, AssignedMesocycle } from '@/types/athlete';
import { ExerciseDistribution, SessionSection, SupersetMapping } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
import { TrainingDay } from '@/types/daily-intensity';
import { toggleSuperset, cleanupSupersetsOnExerciseDelete } from '@/utils/supersetUtils';
import { useToast } from '@/hooks/use-toast';

interface CopiedSession {
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  sourceDate: string;
  sessionIndex: number;
}

interface CopiedDay {
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  supersets: { [sessionIndex: number]: { [sectionId: string]: { [supersetId: string]: string[] } } };
  sourceDate: string;
  intensity?: IntensityLevel;
  splitState?: number;
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
  
  // Refs for race condition prevention (synchronous guards)
  const loadingAssignmentIdRef = useRef<string | null>(null);
  const loadedAssignmentIdRef = useRef<string | null>(null);
  
  // Copy/paste state
  const [copiedSession, setCopiedSession] = useState<CopiedSession | null>(null);
  const [copiedDay, setCopiedDay] = useState<CopiedDay | null>(null);
  
  // Get selected assignment
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

  // Load assignment for editing
  const loadAssignmentForEditing = useCallback((assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    
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
        setIsInitializing(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, buildTrainingDaysFromAssignment]);

  // Initialize from assignment snapshot
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
  }, [buildTrainingDaysFromAssignment]);

  // Load when assignment changes
  useEffect(() => {
    if (selectedAssignmentId) {
      loadAssignmentForEditing(selectedAssignmentId);
    }
  }, [selectedAssignmentId, loadAssignmentForEditing]);

  // Auto-save edits to localStorage with race condition guard
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
    
    const storageKey = `athlete-assignment-${selectedAssignmentId}`;
    const dataToSave = {
      exerciseDistribution,
      sessionSections,
      supersets,
      parameterValues,
      dailyIntensity: dailyIntensityData,
      trainingDays,
      daySplitStates,
      lastModified: new Date().toISOString(),
    };
    
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
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
    
    setCopiedSession({
      exercises: sessionExercises,
      sections: sessionSectionsForSession,
      sourceDate: dayDate,
      sessionIndex,
    });
    
    toast({ title: "Session copied", description: `${sessionExercises.length} exercise(s) copied` });
  }, [exerciseDistribution, sessionSections, toast]);

  const handlePasteSession = useCallback((targetDate: string) => {
    if (!copiedSession) return;
    
    const targetDayExercises = exerciseDistribution.filter(ex => ex.dayDate === targetDate);
    const maxSessionIndex = targetDayExercises.length > 0
      ? Math.max(...targetDayExercises.map(ex => ex.sessionIndex))
      : -1;
    const newSessionIndex = maxSessionIndex + 1;
    
    setDaySplitStates(prev => {
      const current = prev[targetDate] ?? 1;
      return { ...prev, [targetDate]: Math.max(current, newSessionIndex + 1) };
    });
    
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
    
    const oldToNewExerciseId: Record<string, string> = {};
    const pastedExercises = copiedSession.exercises.map(ex => {
      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      oldToNewExerciseId[ex.id] = newId;
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
    
    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== targetDate) return day;
        const sessionNames = [...(day.sessionNames || [])];
        while (sessionNames.length <= newSessionIndex) {
          sessionNames.push(`Session ${sessionNames.length + 1}`);
        }
        return { ...day, sessions: newSessionIndex + 1, sessionNames };
      })
    );
    
    toast({ title: "Session pasted", description: `${copiedSession.exercises.length} exercise(s) pasted` });
    setCopiedSession(null);
  }, [copiedSession, exerciseDistribution, toast]);

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
    
    if (copiedDay.intensity) {
      setTrainingDays(prev =>
        prev.map(day => day.date === targetDate ? { ...day, intensity: copiedDay.intensity! } : day)
      );
      setDailyIntensityData(prev =>
        prev.map(di => di.date === targetDate ? { ...di, intensity: copiedDay.intensity } : di)
      );
    }
    
    toast({ title: "Day pasted", description: `${copiedDay.exercises.length} exercise(s) pasted` });
    setCopiedDay(null);
  }, [copiedDay, supersets, toast]);

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
