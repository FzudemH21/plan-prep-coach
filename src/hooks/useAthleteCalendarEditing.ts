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
  sessionName?: string;
  sourceSessionIntensity?: IntensityLevel;
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
  // Per-session intensity storage for multi-session days (key: "dayDate-sessionIndex")
  const [sessionIntensities, setSessionIntensities] = useState<Record<string, IntensityLevel>>({});
  // Test/Event days - stored independently of trainingDays so any calendar day can have them
  const [testEventDays, setTestEventDays] = useState<Record<string, { testNames: string[]; eventNames: string[] }>>({});
  
  // Timestamp updated after each successful localStorage write — watchers use this to trigger Supabase sync
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Flag to prevent auto-save during initial load
  const [isInitializing, setIsInitializing] = useState(false);

  // True when the current assignment was loaded via initializeFromAssignment (no localStorage key),
  // meaning it was created on mobile. While this flag is set AND exerciseDistribution is empty,
  // the auto-save must NOT write to localStorage — doing so would cause the auto-sync to fire
  // and overwrite Supabase rows that the mobile assign-flow already wrote correctly.
  // Cleared when exercises are present (coach adds exercises on desktop) or when the assignment
  // is reloaded from a localStorage snapshot.
  const [isMobileCreated, setIsMobileCreated] = useState(false);
  
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

  // Pending save payload - used to flush on unmount before debounce fires
  const pendingSaveRef = useRef<{ payload: object; fingerprint: string; assignmentId: string } | null>(null);
  
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
            isTrainingDay: intensity !== 'off',
            intensity,
            sessions: intensity === 'off' ? 0 : 1,
            sessionNames: intensity === 'off' ? [] : ['Session 1'],
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
    setSessionIntensities({});
    setTestEventDays({});

    // Initialize all daySplitStates to 0 for mobile-created assignments.
    // buildTrainingDaysFromAssignment treats every day in a microcycle as a training
    // day, but the actual program only places sessions on specific days. Starting at 0
    // prevents ghost sessions from showing; liveScheduleMap (Supabase) provides the
    // authoritative session list via the liveEntry override in calendarDays.
    const splitStates: Record<string, number> = {};
    days.forEach(day => {
      splitStates[day.date] = 0;
    });
    setDaySplitStates(splitStates);

    // Build daily intensity
    const intensities = days.map(d => ({ date: d.date, intensity: d.intensity }));
    setDailyIntensityData(intensities);

    // Mark this assignment as mobile-created so the auto-save skips it while exercises are empty.
    setIsMobileCreated(true);

    // Set fingerprint for the initialized state.
    // CRITICAL: must include every key that the auto-save effect includes in savePayload,
    // otherwise the fingerprints differ and the auto-save fires with empty exercises —
    // triggering an auto-sync that clobbers Supabase rows written by the mobile assign-flow.
    const initFingerprint = JSON.stringify({
      exerciseDistribution: [],
      sessionSections: [],
      supersets: {},
      parameterValues: {},
      dailyIntensity: intensities,
      trainingDays: days,
      daySplitStates: splitStates,
      sessionIntensities: {},
      testEventDays: {},
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
      return;
    }
    
    // CRITICAL: Set loading guard SYNCHRONOUSLY before any state updates
    // This prevents auto-save from overwriting data during load
    loadingAssignmentIdRef.current = assignmentId;
    loadedAssignmentIdRef.current = null; // Mark as not yet loaded
    setIsInitializing(true);
    // Reset lastSavedAt so a stale value from a previously-edited assignment in this
    // session cannot re-trigger the auto-sync with the new assignment's empty exercises.
    // Without this, switching from an edited assignment A to a mobile-created assignment B
    // keeps lastSavedAt non-null; any connectionsLoading toggle then fires the auto-sync
    // against B with exerciseDistribution=[] and deletes the Supabase data mobile wrote.
    setLastSavedAt(null);
    
    const storageKey = `athlete-assignment-${assignmentId}`;
    const savedData = localStorage.getItem(storageKey);

    if (savedData) {
      // Assignment loaded from desktop localStorage — not mobile-created
      setIsMobileCreated(false);
      try {
        const parsed = JSON.parse(savedData);
        const storedExercises = parsed.exerciseDistribution || [];
        const storedSections = Array.isArray(parsed.sessionSections) ? parsed.sessionSections : [];
        const storedSupersets = parsed.supersets || {};
        let storedParams = parsed.parameterValues || {};
        const storedDailyIntensity = parsed.dailyIntensity || [];
        const storedDaySplitStates = parsed.daySplitStates || {};
        const storedSessionIntensities = parsed.sessionIntensities || {};
        const storedTestEventDays = parsed.testEventDays || {};

        // Deep-merge the wizard's live parameterValues into the stored snapshot.
        // For each method key present in livePv, livePv wins (removes phantom params from
        // stale template loads). For method keys or microcycles only in the stored snapshot
        // (e.g. microcycle 2 that the wizard hasn't re-configured), the stored data is kept.
        // Validated by matching activeProgramId to the assignment's programId to prevent
        // cross-program contamination (all programs share generic "meso-1"/"meso-2" keys,
        // so mesocycle-ID intersection alone is not a reliable guard).
        try {
          const livePvStr = localStorage.getItem('parameterValues');
          if (livePvStr) {
            const livePv = JSON.parse(livePvStr) as Record<string, unknown>;
            if (livePv && typeof livePv === 'object' && !Array.isArray(livePv)) {
              // Only apply live wizard data when the wizard is showing the SAME program
              // that was assigned. If a different program is active, skip to prevent
              // overwriting the stored snapshot with unrelated param values.
              const activeProgramId = localStorage.getItem('activeProgramId');
              const isSameProgram = activeProgramId && assignment.programId &&
                activeProgramId === assignment.programId;
              if (isSameProgram) {
                const assignmentMesoIds = new Set(
                  (assignment.assignedMesocycles ?? []).map(m => m.id).filter(Boolean)
                );
                const liveKeys = Object.keys(livePv);
                const merged: Record<string, unknown> = { ...(storedParams as Record<string, unknown>) };
                for (const mesoId of liveKeys) {
                  // Skip live meso keys not present in the assignment's mesocycle list
                  if (assignmentMesoIds.size > 0 && !assignmentMesoIds.has(mesoId)) continue;
                  const liveMeso = livePv[mesoId] as Record<string, unknown> | undefined;
                  if (!liveMeso || typeof liveMeso !== 'object') continue;
                  const storedMeso = (merged[mesoId] as Record<string, unknown>) || {};
                  const mergedMeso: Record<string, unknown> = {};
                  const allMcKeys = new Set([
                    ...Object.keys(storedMeso),
                    ...Object.keys(liveMeso),
                  ]);
                  for (const mcKey of allMcKeys) {
                    const liveMc = liveMeso[mcKey] as Record<string, unknown> | undefined;
                    const storedMc = storedMeso[mcKey] as Record<string, unknown> | undefined;
                    if (!liveMc) {
                      // Microcycle not in livePv — keep stored data as-is
                      mergedMeso[mcKey] = storedMc;
                    } else {
                      // livePv wins per-method-key, but stored data fills in missing methods
                      mergedMeso[mcKey] = { ...(storedMc || {}), ...liveMc };
                    }
                  }
                  merged[mesoId] = mergedMeso;
                }
                storedParams = merged;
              }
            }
          }
        } catch {
          // ignore — fall back to stored snapshot
        }

        setExerciseDistribution(storedExercises);
        setSessionSections(storedSections);
        setSupersets(storedSupersets);
        setParameterValues(storedParams);
        setDailyIntensityData(storedDailyIntensity);
        setDaySplitStates(storedDaySplitStates);
        setSessionIntensities(storedSessionIntensities);
        setTestEventDays(storedTestEventDays);

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
          sessionIntensities: storedSessionIntensities,
          testEventDays: storedTestEventDays,
        });
        lastSavedStateRef.current = loadedFingerprint;
      } catch (e) {
        console.error('Failed to parse saved assignment data:', e);
        initializeFromAssignment(assignment);
      }
    } else {
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

  // Load when assignment changes; clear state when no assignment (e.g. new athlete with no plan)
  useEffect(() => {
    if (selectedAssignmentId) {
      loadAssignmentForEditing(selectedAssignmentId);
    } else {
      // Athlete has no assignment — clear stale plan data so the previous athlete's
      // sessions don't bleed through when viewing a new or unassigned athlete.
      setExerciseDistribution([]);
      setSessionSections([]);
      setSupersets({});
      setParameterValues({});
      setDailyIntensityData([]);
      setTrainingDays([]);
      setDaySplitStates({});
      setSessionIntensities({});
      setTestEventDays({});
      lastLoadedAssignmentIdRef.current = null;
      loadedAssignmentIdRef.current = null;
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
    // 5. Mobile-created assignment with no exercises yet — do NOT write to localStorage.
    // Writing an empty exerciseDistribution would cause the auto-sync to overwrite Supabase
    // rows that the mobile assign-flow already wrote with the correct session exercises.
    if (isMobileCreated && exerciseDistribution.length === 0) return;

    // Build full save payload for accurate fingerprinting
    const savePayload = {
      exerciseDistribution,
      sessionSections,
      supersets,
      parameterValues,
      dailyIntensity: dailyIntensityData,
      trainingDays,
      daySplitStates,
      sessionIntensities,
      testEventDays,
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

    // Track pending save so flush-on-unmount can save it synchronously
    pendingSaveRef.current = { payload: savePayload, fingerprint: stateFingerprint, assignmentId: selectedAssignmentId };

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
      console.log('[autoSave] saved to localStorage:', storageKey, 'trainingDays.length:', savePayload.trainingDays.length);
      lastSavedStateRef.current = stateFingerprint;
      pendingSaveRef.current = null; // Clear pending after successful save
      setLastSavedAt(new Date().toISOString());
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
    isMobileCreated,
    exerciseDistribution,
    sessionSections,
    supersets,
    parameterValues,
    dailyIntensityData,
    trainingDays,
    daySplitStates,
    sessionIntensities,
    testEventDays,
  ]);

  // Flush-on-unmount: if a debounced save is pending when the component unmounts,
  // save synchronously so data is never lost (e.g. user adds test then navigates away
  // within the 300ms debounce window)
  useEffect(() => {
    return () => {
      const pending = pendingSaveRef.current;
      if (pending) {
        const storageKey = `athlete-assignment-${pending.assignmentId}`;
        localStorage.setItem(storageKey, JSON.stringify({
          ...pending.payload,
          lastModified: new Date().toISOString(),
        }));
        pendingSaveRef.current = null;
      }
    };
  }, []); // empty deps - only runs on unmount

  // === Session Management Handlers ===

  const handleAddSession = useCallback((dayDate: string) => {
    // ?? 0 (not ?? 1): an off-day has daySplitStates = 0, a day outside the
    // plan range has undefined — both should produce exactly 1 session after
    // the first add.  Using ?? 1 would make undefined days start at 2.
    setDaySplitStates(prev => {
      const currentSessions = prev[dayDate] ?? 0;
      return { ...prev, [dayDate]: currentSessions + 1 };
    });

    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== dayDate) return day;
        const sessions = (day.sessions || 0) + 1;
        const sessionNames = [...(day.sessionNames || [])];
        sessionNames.push(`Session ${sessions}`);
        // If the day was 'off', promote it to 'moderate' so the session
        // is visible in the calendar (display logic hides 'off' days with
        // no exercises).
        const intensity = day.intensity === 'off' ? 'moderate' as IntensityLevel : day.intensity;
        return { ...day, sessions, sessionNames, intensity, isTrainingDay: true };
      })
    );

    // Mirror the intensity reset in dailyIntensityData so the display
    // correctly renders the newly-added session for formerly-off days.
    setDailyIntensityData(prev =>
      prev.map(di =>
        di.date === dayDate && di.intensity === 'off'
          ? { ...di, intensity: 'moderate' as IntensityLevel }
          : di
      )
    );

    toast({ title: "Session added" });
  }, [toast]);

  const handleDeleteSession = useCallback((dayDate: string, sessionIndex: number) => {
    const currentSessions = daySplitStates[dayDate] ?? 1;

    let newExercises: ExerciseDistribution[];
    let newSections: SessionSection[];
    let newSupersetsVal: SupersetMapping;
    let newDaySplitStates: Record<string, number>;
    let newTrainingDays: TrainingDay[];
    let newDailyIntensityData: typeof dailyIntensityData;
    let newSessionIntensities: typeof sessionIntensities;

    if (currentSessions <= 1) {
      // Last session — clear the day and set intensity to 'off'
      newExercises = exerciseDistribution.filter(ex => ex.dayDate !== dayDate);
      newSections = sessionSections.filter(s => s.dayDate !== dayDate);
      newSupersetsVal = { ...supersets };
      delete newSupersetsVal[dayDate];
      newDaySplitStates = { ...daySplitStates, [dayDate]: 0 };
      newTrainingDays = trainingDays.map(day =>
        day.date === dayDate
          ? { ...day, sessions: 0, sessionNames: [], intensity: 'off' as IntensityLevel }
          : day
      );
      newDailyIntensityData = dailyIntensityData.map(di =>
        di.date === dayDate ? { ...di, intensity: 'off' } : di
      );
      // Remove all session intensities for the cleared day
      newSessionIntensities = Object.fromEntries(
        Object.entries(sessionIntensities).filter(([k]) => !k.startsWith(`${dayDate}-`))
      ) as typeof sessionIntensities;
    } else {
      // Remove the target session; shift indices of later sessions down by 1
      newExercises = exerciseDistribution
        .filter(ex => !(ex.dayDate === dayDate && ex.sessionIndex === sessionIndex))
        .map(ex =>
          ex.dayDate === dayDate && ex.sessionIndex > sessionIndex
            ? { ...ex, sessionIndex: ex.sessionIndex - 1 }
            : ex
        );
      newSections = sessionSections
        .filter(s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex))
        .map(s =>
          s.dayDate === dayDate && s.sessionIndex > sessionIndex
            ? { ...s, sessionIndex: s.sessionIndex - 1 }
            : s
        );
      newSupersetsVal = supersets;   // supersets not affected for mid-session deletes
      newDaySplitStates = { ...daySplitStates, [dayDate]: currentSessions - 1 };
      // Fix: update the session count and remove the deleted session name
      newTrainingDays = trainingDays.map(day => {
        if (day.date !== dayDate) return day;
        const sessionNames = [...(day.sessionNames ?? [])];
        sessionNames.splice(sessionIndex, 1);
        return { ...day, sessions: currentSessions - 1, sessionNames };
      });
      newDailyIntensityData = dailyIntensityData;
      // Shift session intensities: remove deleted, decrement indices above it
      newSessionIntensities = {} as typeof sessionIntensities;
      for (const [key, val] of Object.entries(sessionIntensities)) {
        if (!key.startsWith(`${dayDate}-`)) {
          (newSessionIntensities as Record<string, typeof val>)[key] = val;
          continue;
        }
        const idx = parseInt(key.slice(dayDate.length + 1));
        if (isNaN(idx) || idx === sessionIndex) continue; // skip deleted
        if (idx > sessionIndex) {
          (newSessionIntensities as Record<string, typeof val>)[`${dayDate}-${idx - 1}`] = val;
        } else {
          (newSessionIntensities as Record<string, typeof val>)[key] = val;
        }
      }
    }

    // Apply React state
    setExerciseDistribution(newExercises);
    setSessionSections(newSections);
    setSupersets(newSupersetsVal);
    setDaySplitStates(newDaySplitStates);
    setTrainingDays(newTrainingDays);
    setDailyIntensityData(newDailyIntensityData);
    setSessionIntensities(newSessionIntensities);

    // IMMEDIATE localStorage write (bypass debounce) — prevents stale data on page refresh
    if (selectedAssignmentId) {
      const storageKey = `athlete-assignment-${selectedAssignmentId}`;
      const savePayload = {
        exerciseDistribution: newExercises,
        sessionSections: newSections,
        supersets: newSupersetsVal,
        parameterValues,
        dailyIntensity: newDailyIntensityData,
        trainingDays: newTrainingDays,
        daySplitStates: newDaySplitStates,
        sessionIntensities: newSessionIntensities,
        testEventDays,
        lastModified: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(savePayload));
      lastSavedStateRef.current = JSON.stringify({
        exerciseDistribution: newExercises,
        sessionSections: newSections,
        supersets: newSupersetsVal,
        parameterValues,
        dailyIntensity: newDailyIntensityData,
        trainingDays: newTrainingDays,
        daySplitStates: newDaySplitStates,
        sessionIntensities: newSessionIntensities,
        testEventDays,
      });
      setLastSavedAt(new Date().toISOString());
    }

    toast({
      title: currentSessions <= 1 ? "Last session deleted" : "Session deleted",
      ...(currentSessions <= 1 ? { description: "Day intensity set to 'off'" } : {}),
    });
  }, [
    daySplitStates, exerciseDistribution, sessionSections, supersets,
    trainingDays, dailyIntensityData, parameterValues, sessionIntensities,
    testEventDays, selectedAssignmentId, toast,
  ]);

  // Move a session from one day to another (for drag-and-drop)
  const handleMoveSession = useCallback((
    sourceDayDate: string,
    sourceSessionIndex: number,
    destDayDate: string
  ) => {
    // Get source exercises for this session
    const sourceExercises = exerciseDistribution.filter(
      ex => ex.dayDate === sourceDayDate && ex.sessionIndex === sourceSessionIndex
    );
    
    // Calculate new session index at destination (add as new session at end)
    const destSessionCount = daySplitStates[destDayDate] || 0;
    const newSessionIndex = destSessionCount;
    
    // Update exercise distribution - move exercises to new day/session
    const newDistribution = exerciseDistribution.map(ex => {
      if (ex.dayDate === sourceDayDate && ex.sessionIndex === sourceSessionIndex) {
        return { ...ex, dayDate: destDayDate, sessionIndex: newSessionIndex };
      }
      // Adjust session indices for remaining sessions on source day
      if (ex.dayDate === sourceDayDate && ex.sessionIndex > sourceSessionIndex) {
        return { ...ex, sessionIndex: ex.sessionIndex - 1 };
      }
      return ex;
    });
    setExerciseDistribution(newDistribution);
    
    // Update session sections - move sections to new day/session
    const newSections = sessionSections.map(section => {
      if (section.dayDate === sourceDayDate && section.sessionIndex === sourceSessionIndex) {
        return { ...section, dayDate: destDayDate, sessionIndex: newSessionIndex };
      }
      // Adjust session indices for remaining sections on source day
      if (section.dayDate === sourceDayDate && section.sessionIndex > sourceSessionIndex) {
        return { ...section, sessionIndex: section.sessionIndex - 1 };
      }
      return section;
    });
    setSessionSections(newSections);
    
    // Update supersets - move supersets to new day/session
    const newSupersets = { ...supersets };
    const sourceSessionSupersets = newSupersets[sourceDayDate]?.[sourceSessionIndex];
    
    // Remove from source
    if (newSupersets[sourceDayDate]) {
      delete newSupersets[sourceDayDate][sourceSessionIndex];
      // Shift remaining session indices
      const shifts: Record<number, any> = {};
      Object.entries(newSupersets[sourceDayDate]).forEach(([idx, value]) => {
        const numIdx = parseInt(idx);
        if (numIdx > sourceSessionIndex) {
          shifts[numIdx - 1] = value;
          delete newSupersets[sourceDayDate][numIdx];
        }
      });
      Object.entries(shifts).forEach(([idx, value]) => {
        newSupersets[sourceDayDate][parseInt(idx)] = value;
      });
    }
    
    // Add to destination
    if (sourceSessionSupersets && Object.keys(sourceSessionSupersets).length > 0) {
      if (!newSupersets[destDayDate]) newSupersets[destDayDate] = {};
      newSupersets[destDayDate][newSessionIndex] = sourceSessionSupersets;
    }
    setSupersets(newSupersets);
    
    // CRITICAL FIX: Move session intensity with the session
    // This preserves the original session's intensity instead of inheriting destination day intensity
    setSessionIntensities(prev => {
      const newIntensities = { ...prev };
      const sourceKey = `${sourceDayDate}-${sourceSessionIndex}`;
      const destKey = `${destDayDate}-${newSessionIndex}`;
      
      // Get the source day's default intensity for fallback
      const sourceDay = trainingDays.find(d => d.date === sourceDayDate);
      const sourceDayIntensity = dailyIntensityData.find(d => d.date === sourceDayDate)?.intensity || 
        sourceDay?.intensity || 
        'moderate';
      
      // Preserve the session's original intensity (or fall back to source day intensity)
      const movedIntensity = newIntensities[sourceKey] || sourceDayIntensity;
      
      // Set on destination
      newIntensities[destKey] = movedIntensity as IntensityLevel;
      
      // Remove from source
      delete newIntensities[sourceKey];
      
      // Shift remaining source day session intensities down
      const sourceCount = daySplitStates[sourceDayDate] || 0;
      for (let i = sourceSessionIndex + 1; i < sourceCount; i++) {
        const oldKey = `${sourceDayDate}-${i}`;
        const newKey = `${sourceDayDate}-${i - 1}`;
        if (newIntensities[oldKey] !== undefined) {
          newIntensities[newKey] = newIntensities[oldKey];
          delete newIntensities[oldKey];
        }
      }
      
      return newIntensities;
    });
    
    // Update daySplitStates
    setDaySplitStates(prev => {
      const newStates = { ...prev };
      
      // Decrement source day count
      if (newStates[sourceDayDate]) {
        newStates[sourceDayDate] = Math.max(0, newStates[sourceDayDate] - 1);
        if (newStates[sourceDayDate] === 0) {
          delete newStates[sourceDayDate];
        }
      }
      
      // Increment destination day count
      newStates[destDayDate] = (newStates[destDayDate] || 0) + 1;
      
      return newStates;
    });
    
    // Update session names in trainingDays
    const sourceDay = trainingDays.find(d => d.date === sourceDayDate);
    const movedSessionName = sourceDay?.sessionNames?.[sourceSessionIndex] || `Session ${sourceSessionIndex + 1}`;
    
    setTrainingDays(prev => {
      const updated = [...prev];
      
      // Update source day - remove the session name
      const sourceIdx = updated.findIndex(d => d.date === sourceDayDate);
      if (sourceIdx >= 0) {
        const newNames = [...(updated[sourceIdx].sessionNames || [])];
        newNames.splice(sourceSessionIndex, 1);
        updated[sourceIdx] = { 
          ...updated[sourceIdx], 
          sessionNames: newNames, 
          sessions: Math.max(0, (updated[sourceIdx].sessions || 1) - 1) 
        };
      }
      
      // Update destination day - add the session name
      const destIdx = updated.findIndex(d => d.date === destDayDate);
      if (destIdx >= 0) {
        const newNames = [...(updated[destIdx].sessionNames || [])];
        newNames.push(movedSessionName);
        updated[destIdx] = { 
          ...updated[destIdx], 
          sessionNames: newNames, 
          sessions: (updated[destIdx].sessions || 0) + 1,
          isTrainingDay: true
        };
      } else {
        // Create new day entry if it doesn't exist
        // Parse with noon local time to avoid UTC midnight → previous-day shift
        const parsedDate = new Date(destDayDate + 'T12:00:00');
        updated.push({
          date: destDayDate,
          dayOfWeek: parsedDate.getDay(),
          dayName: parsedDate.toLocaleDateString('en-US', { weekday: 'long' }),
          mesocycleId: sourceDay?.mesocycleId || '',
          microcycleId: sourceDay?.microcycleId || '',
          isTestDay: false,
          isEventDay: false,
          isTrainingDay: true,
          intensity: sourceDay?.intensity || 'moderate',
          sessions: 1,
          sessionNames: [movedSessionName],
        });
      }
      
      return updated;
    });
    
    toast({ 
      title: "Session moved", 
      description: `Moved to ${new Date(destDayDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    });
  }, [exerciseDistribution, sessionSections, supersets, daySplitStates, trainingDays, dailyIntensityData, sessionIntensities, toast]);

  const handleCopySession = useCallback((dayDate: string, sessionIndex: number) => {
    const sessionExercises = exerciseDistribution.filter(
      ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex
    );
    const sessionSectionsForSession = sessionSections.filter(
      s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
    );
    
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
      sessionName: sourceDay?.sessionNames?.[sessionIndex] || `Session ${sessionIndex + 1}`,
      sourceSessionIntensity: sessionIntensities[`${dayDate}-${sessionIndex}`],
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

    // Restore per-session intensity if the source had one
    if (copiedSession.sourceSessionIntensity) {
      setSessionIntensities(prev => ({
        ...prev,
        [`${targetDate}-${newSessionIndex}`]: copiedSession.sourceSessionIntensity!,
      }));
    }

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
        sessionNames[newSessionIndex] = copiedSession.sessionName || `Session ${newSessionIndex + 1}`;
        updated[existingIdx] = {
          ...existingDay,
          sessions: newSplitState,
          sessionNames,
          isTrainingDay: true,
          intensity, // Apply copied intensity
        };
      } else {
        // Add new day entry with metadata from source session
        const sessionNames = Array.from({ length: newSplitState }, (_, i) => `Session ${i + 1}`);
        sessionNames[newSessionIndex] = copiedSession.sessionName || `Session ${newSessionIndex + 1}`;
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
          sessionNames,
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
    
    // Copy parameterVisibility localStorage key from source to target so visible params are preserved
    try {
      if (copiedSession.sourceMesocycleId) {
        const srcKey = `workoutSessions_${copiedSession.sourceMesocycleId}_${copiedSession.sourceDate}_${copiedSession.sessionIndex}`;
        const storedVis = localStorage.getItem(srcKey);
        if (storedVis) {
          const tgtKey = `workoutSessions_${copiedSession.sourceMesocycleId}_${targetDate}_${newSessionIndex}`;
          localStorage.setItem(tgtKey, storedVis);
        }
      }
    } catch { /* ignore */ }

    toast({ title: "Session pasted", description: `${copiedSession.exercises.length} exercise(s) pasted` });
    setCopiedSession(null);
  }, [copiedSession, exerciseDistribution, daySplitStates, toast]);

  // === Day Management Handlers ===
  
  const handleCopyDay = useCallback((dayDate: string) => {
    const dayExercises = exerciseDistribution.filter(ex => ex.dayDate === dayDate);
    const daySections = sessionSections.filter(s => s.dayDate === dayDate);
    const daySupersets = supersets[dayDate] || {};
    const day = trainingDays.find(d => d.date === dayDate);
    
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
    // Compute new state values for immediate save
    const newExercises = exerciseDistribution.filter(ex => ex.dayDate !== dayDate);
    const newSections = sessionSections.filter(s => s.dayDate !== dayDate);
    const newSupersets = { ...supersets };
    delete newSupersets[dayDate];
    const newDaySplitStates = { ...daySplitStates, [dayDate]: 0 };
    // Also set intensity to 'off' so syncAthleteSchedule and calendarDays
    // both treat the day as a rest day — prevents ghost sessions from re-appearing.
    const newTrainingDays = trainingDays.map(day =>
      day.date === dayDate
        ? { ...day, sessions: 0, sessionNames: [], testNames: [], eventNames: [], isTestDay: false, isEventDay: false, intensity: 'off' as IntensityLevel, isTrainingDay: false }
        : day
    );
    // Clear daily intensity entry for the day so it renders as rest.
    const newDailyIntensityData = dailyIntensityData.map(di =>
      di.date === dayDate ? { ...di, intensity: 'off' as IntensityLevel } : di
    );
    // Clear per-session intensities for the day.
    const newSessionIntensities = Object.fromEntries(
      Object.entries(sessionIntensities).filter(([k]) => !k.startsWith(`${dayDate}-`))
    ) as typeof sessionIntensities;

    // Update React state
    setExerciseDistribution(newExercises);
    setSessionSections(newSections);
    setSupersets(newSupersets);
    setDaySplitStates(newDaySplitStates);
    setTrainingDays(newTrainingDays);
    setDailyIntensityData(newDailyIntensityData);
    setSessionIntensities(newSessionIntensities);

    // IMMEDIATE localStorage write (bypass debounce)
    if (selectedAssignmentId) {
      const storageKey = `athlete-assignment-${selectedAssignmentId}`;
      const savePayload = {
        exerciseDistribution: newExercises,
        sessionSections: newSections,
        supersets: newSupersets,
        parameterValues,
        dailyIntensity: newDailyIntensityData,
        trainingDays: newTrainingDays,
        daySplitStates: newDaySplitStates,
        sessionIntensities: newSessionIntensities,
        testEventDays,
        lastModified: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(savePayload));
      lastSavedStateRef.current = JSON.stringify({
        exerciseDistribution: newExercises,
        sessionSections: newSections,
        supersets: newSupersets,
        parameterValues,
        dailyIntensity: newDailyIntensityData,
        trainingDays: newTrainingDays,
        daySplitStates: newDaySplitStates,
        sessionIntensities: newSessionIntensities,
        testEventDays,
      });
      setLastSavedAt(new Date().toISOString());
    }

  }, [exerciseDistribution, sessionSections, supersets, daySplitStates, trainingDays, dailyIntensityData, parameterValues, sessionIntensities, testEventDays, selectedAssignmentId]);

  // Atomic multi-day clear — avoids the stale-closure bug that happens when
  // handleClearDay is called in a loop (each call reads the same snapshot).
  const handleClearDays = useCallback((dates: string[]) => {
    if (dates.length === 0) return;
    const dateSet = new Set(dates);
    const newExercises = exerciseDistribution.filter(ex => !dateSet.has(ex.dayDate));
    const newSections = sessionSections.filter(s => !dateSet.has(s.dayDate));
    const newSupersets = { ...supersets };
    dates.forEach(d => delete newSupersets[d]);
    const newDaySplitStates = { ...daySplitStates };
    dates.forEach(d => { newDaySplitStates[d] = 0; });
    // Set intensity to 'off' and isTrainingDay to false for all cleared dates
    // so syncAthleteSchedule and calendarDays treat them as rest days.
    const newTrainingDays = trainingDays.map(day =>
      dateSet.has(day.date)
        ? { ...day, sessions: 0, sessionNames: [], testNames: [], eventNames: [], isTestDay: false, isEventDay: false, intensity: 'off' as IntensityLevel, isTrainingDay: false }
        : day
    );
    // Clear daily intensity entries for cleared dates.
    const newDailyIntensityData = dailyIntensityData.map(di =>
      dateSet.has(di.date) ? { ...di, intensity: 'off' as IntensityLevel } : di
    );
    // Clear per-session intensities for cleared dates.
    const newSessionIntensities = Object.fromEntries(
      Object.entries(sessionIntensities).filter(([k]) => !dates.some(d => k.startsWith(`${d}-`)))
    ) as typeof sessionIntensities;
    setExerciseDistribution(newExercises);
    setSessionSections(newSections);
    setSupersets(newSupersets);
    setDaySplitStates(newDaySplitStates);
    setTrainingDays(newTrainingDays);
    setDailyIntensityData(newDailyIntensityData);
    setSessionIntensities(newSessionIntensities);
    if (selectedAssignmentId) {
      const storageKey = `athlete-assignment-${selectedAssignmentId}`;
      const savePayload = {
        exerciseDistribution: newExercises,
        sessionSections: newSections,
        supersets: newSupersets,
        parameterValues,
        dailyIntensity: newDailyIntensityData,
        trainingDays: newTrainingDays,
        daySplitStates: newDaySplitStates,
        sessionIntensities: newSessionIntensities,
        testEventDays,
        lastModified: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(savePayload));
      lastSavedStateRef.current = JSON.stringify({
        exerciseDistribution: newExercises,
        sessionSections: newSections,
        supersets: newSupersets,
        parameterValues,
        dailyIntensity: newDailyIntensityData,
        trainingDays: newTrainingDays,
        daySplitStates: newDaySplitStates,
        sessionIntensities: newSessionIntensities,
        testEventDays,
      });
      setLastSavedAt(new Date().toISOString());
    }
  }, [exerciseDistribution, sessionSections, supersets, daySplitStates, trainingDays, dailyIntensityData, parameterValues, sessionIntensities, testEventDays, selectedAssignmentId]);

  const handlePasteDay = useCallback((targetDate: string) => {
    if (!copiedDay) return;

    // Calculate session offset to append after existing sessions
    const targetDayExercises = exerciseDistribution.filter(ex => ex.dayDate === targetDate);
    const maxExistingSessionIndex = targetDayExercises.length > 0
      ? Math.max(...targetDayExercises.map(ex => ex.sessionIndex))
      : -1;
    const sessionOffset = maxExistingSessionIndex + 1;

    const copiedSplitState = copiedDay.splitState || 1;
    const newTotalSessions = sessionOffset + copiedSplitState;
    const currentSplitState = daySplitStates[targetDate] ?? 0;
    const newSplitState = Math.max(currentSplitState, newTotalSessions);

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
        sessionIndex: ex.sessionIndex + sessionOffset,
        sectionId: ex.sectionId ? sectionIdMapping.get(ex.sectionId) : undefined,
      };
    });

    const pastedSections = copiedDay.sections.map(section => ({
      ...section,
      id: sectionIdMapping.get(section.id)!,
      dayDate: targetDate,
      sessionIndex: section.sessionIndex + sessionOffset,
    }));

    // Merge supersets (don't replace existing)
    const newSupersets = { ...supersets };
    if (!newSupersets[targetDate]) {
      newSupersets[targetDate] = {};
    }

    Object.entries(copiedDay.supersets).forEach(([sessionIdxStr, sessionSupersets]) => {
      const newSessionIdx = parseInt(sessionIdxStr) + sessionOffset;
      newSupersets[targetDate][newSessionIdx] = {};
      Object.entries(sessionSupersets).forEach(([sectionKey, supersetMap]) => {
        const destSectionKey = sectionKey === '__unsectioned__'
          ? '__unsectioned__'
          : (sectionIdMapping.get(sectionKey) || sectionKey);
        newSupersets[targetDate][newSessionIdx][destSectionKey] = {};
        Object.entries(supersetMap).forEach(([supersetId, exerciseIds]) => {
          const mappedIds = exerciseIds.map(id => exerciseIdMapping.get(id)).filter(Boolean) as string[];
          if (mappedIds.length >= 2) {
            newSupersets[targetDate][newSessionIdx][destSectionKey][supersetId] = mappedIds;
          }
        });
      });
    });

    setExerciseDistribution(prev => [...prev, ...pastedExercises]);
    setSessionSections(prev => [...prev, ...pastedSections]);
    setSupersets(newSupersets);
    setDaySplitStates(prev => ({ ...prev, [targetDate]: newSplitState }));

    const targetDateObj = new Date(targetDate);
    const intensity = copiedDay.intensity || ('moderate' as IntensityLevel);

    setTrainingDays(prev => {
      const updated = [...prev];
      const existingIdx = updated.findIndex(d => d.date === targetDate);

      if (existingIdx >= 0) {
        const existingDay = updated[existingIdx];
        const existingNames = existingDay.sessionNames || [];
        const newNames = [...existingNames];
        while (newNames.length < newTotalSessions) {
          newNames.push(`Session ${newNames.length + 1}`);
        }
        updated[existingIdx] = {
          ...existingDay,
          sessions: newSplitState,
          sessionNames: newNames,
          isTrainingDay: true,
        };
      } else {
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
          sessions: newSplitState,
          sessionNames: Array.from({ length: newSplitState }, (_, i) => `Session ${i + 1}`),
        } as TrainingDay);
      }

      return updated.sort((a, b) => a.date.localeCompare(b.date));
    });

    setDailyIntensityData(prev => {
      const existingIdx = prev.findIndex(di => di.date === targetDate);
      if (existingIdx >= 0) {
        return prev; // keep existing intensity
      }
      return [...prev, { date: targetDate, intensity }].sort((a, b) => a.date.localeCompare(b.date));
    });

    toast({ title: "Day pasted", description: `${pastedExercises.length} exercise(s) pasted` });
    setCopiedDay(null);
  }, [copiedDay, supersets, exerciseDistribution, daySplitStates, toast]);

  // === Week Management Handlers ===

  const handleCopyWeek = useCallback((weekStartDate: string) => {
    const [sy, sm, sd] = weekStartDate.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd);
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDates.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
    }

    const weekExercises = exerciseDistribution.filter(ex => weekDates.includes(ex.dayDate));
    const weekSections = sessionSections.filter(s => weekDates.includes(s.dayDate));
    const weekTrainingDays = trainingDays.filter(td => weekDates.includes(td.date));

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
    const [cy, cm, cd] = weekStartDate.split('-').map(Number);
    const startDateVal = new Date(cy, cm - 1, cd);
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDates.push(format(addDays(startDateVal, i), 'yyyy-MM-dd'));
    }
    const weekDateSet = new Set(weekDates);

    // Compute new state values for immediate save
    const newExercises = exerciseDistribution.filter(ex => !weekDateSet.has(ex.dayDate));
    const newSections = sessionSections.filter(s => !weekDateSet.has(s.dayDate));
    const newSupersets = { ...supersets };
    weekDates.forEach(d => delete newSupersets[d]);
    const newDaySplitStates = { ...daySplitStates };
    weekDates.forEach(d => { newDaySplitStates[d] = 0; });
    // Set intensity to 'off' and isTrainingDay to false for all cleared dates.
    const newTrainingDays = trainingDays.map(day =>
      weekDateSet.has(day.date)
        ? { ...day, sessions: 0, sessionNames: [], testNames: [], eventNames: [], isTestDay: false, isEventDay: false, intensity: 'off' as IntensityLevel, isTrainingDay: false }
        : day
    );
    // Clear daily intensity for cleared dates.
    const newDailyIntensityData = dailyIntensityData.map(di =>
      weekDateSet.has(di.date) ? { ...di, intensity: 'off' as IntensityLevel } : di
    );
    // Clear per-session intensities for cleared dates.
    const newSessionIntensities = Object.fromEntries(
      Object.entries(sessionIntensities).filter(([k]) => !weekDates.some(d => k.startsWith(`${d}-`)))
    ) as typeof sessionIntensities;

    // Update React state
    setExerciseDistribution(newExercises);
    setSessionSections(newSections);
    setSupersets(newSupersets);
    setDaySplitStates(newDaySplitStates);
    setTrainingDays(newTrainingDays);
    setDailyIntensityData(newDailyIntensityData);
    setSessionIntensities(newSessionIntensities);

    // IMMEDIATE localStorage write (bypass debounce)
    if (selectedAssignmentId) {
      const storageKey = `athlete-assignment-${selectedAssignmentId}`;
      const savePayload = {
        exerciseDistribution: newExercises,
        sessionSections: newSections,
        supersets: newSupersets,
        parameterValues,
        dailyIntensity: newDailyIntensityData,
        trainingDays: newTrainingDays,
        daySplitStates: newDaySplitStates,
        sessionIntensities: newSessionIntensities,
        testEventDays,
        lastModified: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(savePayload));
      lastSavedStateRef.current = JSON.stringify({
        exerciseDistribution: newExercises,
        sessionSections: newSections,
        supersets: newSupersets,
        parameterValues,
        dailyIntensity: newDailyIntensityData,
        trainingDays: newTrainingDays,
        daySplitStates: newDaySplitStates,
        sessionIntensities: newSessionIntensities,
        testEventDays,
      });
      setLastSavedAt(new Date().toISOString());
    }

    toast({ title: "Week cleared" });
  }, [exerciseDistribution, sessionSections, supersets, daySplitStates, trainingDays, dailyIntensityData, parameterValues, sessionIntensities, testEventDays, selectedAssignmentId, toast]);

  const handlePasteWeek = useCallback((targetWeekStartDate: string) => {
    if (!copiedWeek) return;

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
    console.log('[handleAddTestEvent] called:', { dayDate, type, id, name, isNew, comments });
    setTestEventDays(prev => {
      const existing = prev[dayDate] || { testNames: [], eventNames: [] };
      if (type === 'test') {
        if (existing.testNames.includes(name)) return prev;
        return { ...prev, [dayDate]: { ...existing, testNames: [...existing.testNames, name] } };
      } else {
        if (existing.eventNames.includes(name)) return prev;
        return { ...prev, [dayDate]: { ...existing, eventNames: [...existing.eventNames, name] } };
      }
    });
    console.log('[handleAddTestEvent] testEventDays updated, toast firing');
    toast({ title: `${type === 'test' ? 'Test' : 'Event'} added`, description: name });
  }, [toast]);

  const handleDeleteTestEvent = useCallback((dayDate: string, type: 'test' | 'event', name: string) => {
    setTestEventDays(prev => {
      const existing = prev[dayDate];
      if (!existing) return prev;
      if (type === 'test') {
        const testNames = existing.testNames.filter(t => t !== name);
        if (testNames.length === 0 && existing.eventNames.length === 0) {
          const updated = { ...prev };
          delete updated[dayDate];
          return updated;
        }
        return { ...prev, [dayDate]: { ...existing, testNames } };
      } else {
        const eventNames = existing.eventNames.filter(e => e !== name);
        if (existing.testNames.length === 0 && eventNames.length === 0) {
          const updated = { ...prev };
          delete updated[dayDate];
          return updated;
        }
        return { ...prev, [dayDate]: { ...existing, eventNames } };
      }
    });
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
    // Always update day-level intensity
    setTrainingDays(prev =>
      prev.map(day => day.date === dayDate ? { ...day, intensity } : day)
    );
    setDailyIntensityData(prev =>
      prev.map(di => di.date === dayDate ? { ...di, intensity } : di)
    );
    
    // For single-session days, also sync the per-session intensity
    const sessionCount = daySplitStates[dayDate] ?? 1;
    if (sessionCount === 1) {
      setSessionIntensities(prev => ({
        ...prev,
        [`${dayDate}-0`]: intensity
      }));
    }
    // For multi-session days, session intensities remain INDEPENDENT - do not update them
  }, [daySplitStates]);

  const handleSessionIntensityChange = useCallback((dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
    // Check session count from daySplitStates (source of truth), not trainingDays.sessions
    const sessionCount = daySplitStates[dayDate] ?? 1;
    
    // Store per-session intensity
    setSessionIntensities(prev => ({
      ...prev,
      [`${dayDate}-${sessionIndex}`]: intensity
    }));
    
    // For single session days, also sync session intensity to day intensity
    if (sessionCount === 1) {
      setTrainingDays(prev =>
        prev.map(day => day.date === dayDate ? { ...day, intensity } : day)
      );
      setDailyIntensityData(prev =>
        prev.map(di => di.date === dayDate ? { ...di, intensity } : di)
      );
    }
    // For multi-session days, session intensity is independent
  }, [daySplitStates]);

  // === Ensure sessionIntensities exist for multi-session days ===
  // When a day has 2+ sessions, each session should have its own intensity entry
  // so that changing day intensity doesn't affect them.
  // NOTE: sessionIntensities is intentionally excluded from the dependency array.
  // It is only used as a guard (to skip already-set keys) — including it would
  // cause the effect to re-run on every intensity update, creating an O(n) loop
  // that was the root cause of the "Maximum update depth exceeded" error and
  // the slow calendar loading. The setSessionIntensities updater form is used
  // to read the latest value at update time without it being a dep.
  useEffect(() => {
    setSessionIntensities(prev => {
      const updates: Record<string, IntensityLevel> = {};

      Object.entries(daySplitStates).forEach(([dayDate, sessionCount]) => {
        if (sessionCount > 1) {
          // Find the day's current intensity
          const dayIntensity = dailyIntensityData.find(d => d.date === dayDate)?.intensity
            || trainingDays.find(d => d.date === dayDate)?.intensity
            || ('moderate' as IntensityLevel);

          // Ensure each session has an intensity entry (if missing)
          for (let sessionIdx = 0; sessionIdx < sessionCount; sessionIdx++) {
            const key = `${dayDate}-${sessionIdx}`;
            if (prev[key] === undefined) {
              updates[key] = dayIntensity as IntensityLevel;
            }
          }
        }
      });

      // Return same reference if nothing changed — prevents a spurious re-render
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daySplitStates, dailyIntensityData, trainingDays]);

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

  // Persist the full parameter snapshot for a specific exercise into adhocPlannedParams /
  // adhocVisibleParams on the exercise distribution entry.  The auto-save effect picks up
  // the exerciseDistribution change and triggers the Supabase sync, so the values appear
  // in the athlete app without a full plan re-assignment.
  const handleExerciseParameterSave = useCallback((
    dayDate: string,
    sessionIndex: number,
    exerciseId: string,
    parameters: Record<string, string | number>,
    visibleParamNames: string[],
  ) => {
    setExerciseDistribution(prev => prev.map(ex => {
      if (ex.dayDate !== dayDate || ex.sessionIndex !== sessionIndex || ex.exerciseId !== exerciseId) return ex;
      // Only persist ad-hoc params for toolbox-sourced exercises.
      // Periodization exercises derive planned values from the assignment's parameterValues;
      // overwriting parameterSource would send them through the wrong lookup path on reopen.
      if (ex.parameterSource !== 'toolbox') return ex;
      return {
        ...ex,
        adhocPlannedParams: parameters,
        adhocVisibleParams: visibleParamNames.length > 0 ? visibleParamNames : ex.adhocVisibleParams,
      };
    }));
  }, []);

  // === Calculate Calendar Days for Master Planner ===
  
  const allAssignmentDays = useMemo((): CalendarDay[] => {
    if (!selectedAssignment) return [];
    
    // Collect all dates from all data sources (continuous workout stream model)
    const trainingDayDates = new Set(trainingDays.map(td => td.date));
    const allDates = new Set(trainingDayDates);
    
    // Include dates from exerciseDistribution not in trainingDays
    exerciseDistribution.forEach(ex => allDates.add(ex.dayDate));
    
    // Include dates from daySplitStates not in trainingDays
    Object.keys(daySplitStates).forEach(dateStr => allDates.add(dateStr));
    
    const sortedDates = Array.from(allDates).sort();
    
    return sortedDates.map(dateStr => {
      const trainingDay = trainingDays.find(td => td.date === dateStr);
      const dayExercises = exerciseDistribution.filter(e => e.dayDate === dateStr);
      const hasExplicitSplitState = dateStr in daySplitStates;
      const daySessions = hasExplicitSplitState 
        ? daySplitStates[dateStr] 
        : (dayExercises.length > 0 ? 1 : 0);
      
      const sessions = [];
      for (let sessionIdx = 0; sessionIdx < Math.max(daySessions, 1); sessionIdx++) {
        const sessionExercises = dayExercises.filter(e => e.sessionIndex === sessionIdx);
        sessions.push({
          id: `${dateStr}-${sessionIdx}`,
          sessionIndex: sessionIdx,
          sessionName: trainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`,
          exercises: sessionExercises,
          methods: [...new Set(sessionExercises.map(e => e.methodId))],
          sessionIntensity: trainingDay?.intensity,
        });
      }
      
      // Create synthetic trainingDay for dates outside the original range
      const effectiveTrainingDay: TrainingDay = trainingDay || {
        date: dateStr,
        dayOfWeek: (() => { const [py, pm, pd] = dateStr.split('-').map(Number); return new Date(py, pm - 1, pd).getDay(); })(),
        dayName: (() => { const [py, pm, pd] = dateStr.split('-').map(Number); return format(new Date(py, pm - 1, pd), 'EEEE'); })(),
        mesocycleId: selectedAssignment.assignedMesocycles[0]?.id || '',
        microcycleId: '',
        isTestDay: false,
        isEventDay: false,
        isTrainingDay: daySessions > 0,
        intensity: 'moderate' as IntensityLevel,
        sessions: daySessions,
        sessionNames: [],
      };
      
      return {
        date: (() => { const [py, pm, pd] = dateStr.split('-').map(Number); return new Date(py, pm - 1, pd); })(),
        dateString: dateStr,
        isCurrentMonth: true,
        trainingDay: effectiveTrainingDay,
        sessions: daySessions > 0 ? sessions : [],
        totalExercises: dayExercises.length,
      };
    });
  }, [selectedAssignment, trainingDays, exerciseDistribution, daySplitStates]);

  // Merge program sessions into the current assignment's editing state.
  // Used by the assign-program flow when an assignment already exists.
  const mergeSessionData = useCallback((
    newExercises: ExerciseDistribution[],
    newSections: SessionSection[],
    newSupersets: SupersetMapping,
    newTrainingDays: TrainingDay[],
    newDaySplitStates: Record<string, number>,
    newDailyIntensity: Array<{ date: string; intensity: IntensityLevel | string }>,
    newParameterValues: Record<string, any> = {},
  ) => {
    // Compute session offset per day so new sessions append after existing ones
    const sessionOffsetByDay: Record<string, number> = {};
    const affectedDays = new Set([
      ...newExercises.map(ex => ex.dayDate),
      ...newTrainingDays.map(td => td.date),
    ]);
    affectedDays.forEach(dayDate => {
      const existing = exerciseDistribution.filter(ex => ex.dayDate === dayDate);
      const maxIdx = existing.length > 0 ? Math.max(...existing.map(ex => ex.sessionIndex)) : -1;
      sessionOffsetByDay[dayDate] = maxIdx + 1;
    });

    // Remap IDs and session indices
    const sectionIdMapping = new Map<string, string>();
    newSections.forEach(s => {
      sectionIdMapping.set(s.id, `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    });

    const exerciseIdMapping = new Map<string, string>();
    const remappedExercises = newExercises.map(ex => {
      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      exerciseIdMapping.set(ex.id, newId);
      return {
        ...ex,
        id: newId,
        sessionIndex: ex.sessionIndex + (sessionOffsetByDay[ex.dayDate] ?? 0),
        sectionId: ex.sectionId ? sectionIdMapping.get(ex.sectionId) : undefined,
      };
    });

    const remappedSections = newSections.map(s => ({
      ...s,
      id: sectionIdMapping.get(s.id)!,
      sessionIndex: s.sessionIndex + (sessionOffsetByDay[s.dayDate] ?? 0),
    }));

    setExerciseDistribution(prev => [...prev, ...remappedExercises]);
    setSessionSections(prev => [...prev, ...remappedSections]);

    setSupersets(prev => {
      const merged = { ...prev };
      Object.entries(newSupersets).forEach(([dayDate, daySupersets]) => {
        const offset = sessionOffsetByDay[dayDate] ?? 0;
        if (!merged[dayDate]) merged[dayDate] = {};
        Object.entries(daySupersets).forEach(([sessionIdxStr, sessionSupersets]) => {
          const newSessionIdx = parseInt(sessionIdxStr) + offset;
          if (!merged[dayDate][newSessionIdx]) merged[dayDate][newSessionIdx] = {};
          Object.entries(sessionSupersets).forEach(([sectionKey, supersetMap]) => {
            const destSectionKey = sectionKey === '__unsectioned__'
              ? '__unsectioned__'
              : (sectionIdMapping.get(sectionKey) || sectionKey);
            merged[dayDate][newSessionIdx][destSectionKey] = {};
            Object.entries(supersetMap).forEach(([supersetId, exerciseIds]) => {
              const mappedIds = exerciseIds.map(id => exerciseIdMapping.get(id)).filter(Boolean) as string[];
              if (mappedIds.length >= 2) {
                merged[dayDate][newSessionIdx][destSectionKey][supersetId] = mappedIds;
              }
            });
          });
        });
      });
      return merged;
    });

    setDaySplitStates(prev => {
      const updated = { ...prev };
      Object.entries(newDaySplitStates).forEach(([dayDate, splitCount]) => {
        const offset = sessionOffsetByDay[dayDate] ?? 0;
        const newTotal = offset + splitCount;
        updated[dayDate] = Math.max(updated[dayDate] ?? 0, newTotal);
      });
      return updated;
    });

    setTrainingDays(prev => {
      const updated = [...prev];
      newTrainingDays.forEach(td => {
        const offset = sessionOffsetByDay[td.date] ?? 0;
        const newTotal = offset + (td.sessions ?? 1);
        const existingIdx = updated.findIndex(d => d.date === td.date);
        if (existingIdx >= 0) {
          const existing = updated[existingIdx];
          const existingNames = existing.sessionNames || [];
          const newNames = [...existingNames];
          while (newNames.length < newTotal) {
            newNames.push(`Session ${newNames.length + 1}`);
          }
          updated[existingIdx] = {
            ...existing,
            intensity: td.intensity ?? existing.intensity,
            sessions: Math.max(existing.sessions ?? 0, newTotal),
            sessionNames: newNames,
            isTrainingDay: true,
          };
        } else {
          updated.push({
            ...td,
            sessions: newTotal,
            sessionNames: Array.from({ length: newTotal }, (_, i) => `Session ${i + 1}`),
          } as TrainingDay);
        }
      });
      return updated.sort((a, b) => a.date.localeCompare(b.date));
    });

    setDailyIntensityData(prev => {
      const newByDate = new Map(newDailyIntensity.map(d => [d.date, d]));
      const merged = prev.map(d => newByDate.has(d.date) ? { ...d, ...newByDate.get(d.date) } : d);
      const existingDates = new Set(prev.map(d => d.date));
      const toAdd = newDailyIntensity.filter(d => !existingDates.has(d.date));
      return [...merged, ...toAdd].sort((a, b) => a.date.localeCompare(b.date));
    });

    if (Object.keys(newParameterValues).length > 0) {
      setParameterValues(prev => ({ ...prev, ...newParameterValues }));
    }
  }, [exerciseDistribution]);

  return {
    // State
    lastSavedAt,
    isInitializing,
    isMobileCreated,
    exerciseDistribution,
    sessionSections,
    supersets,
    parameterValues,
    dailyIntensityData,
    trainingDays,
    daySplitStates,
    sessionIntensities,
    testEventDays,
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
    handleMoveSession,
    
    // Day handlers
    handleCopyDay,
    handleClearDay,
    handleClearDays,
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
    handleExerciseParameterSave,
    
    // State setters for direct manipulation
    setExerciseDistribution,
    setSessionSections,
    setSupersets,

    // Assign-program merge helper
    mergeSessionData,
  };
}
