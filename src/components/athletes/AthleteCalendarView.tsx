import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameMonth, isWithinInterval } from 'date-fns';
import { parseDateStr } from '@/utils/dateUtils';
import { useCalendarGrid, groupDaysIntoWeeks } from '@/hooks/useCalendarGrid';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Trash2, Calendar, LayoutGrid, Columns, ClipboardList, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Athlete, AthleteCalendarAssignment } from '@/types/athlete';
import { AssignProgramDialog } from './AssignProgramDialog';
import { PlanReviewDialog } from './PlanReviewDialog';
import { useTrainingPrograms, TrainingProgram } from '@/hooks/useTrainingPrograms';
import { useAthletes } from '@/hooks/useAthletes';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useAthleteCalendarEditing } from '@/hooks/useAthleteCalendarEditing';
import { useCalendarEvents, CalendarEvent } from '@/hooks/useCalendarEvents';
import {
  shiftExerciseDates,
  shiftDailyIntensityDates,
  shiftSessionSectionDates,
  shiftSupersetDates,
  shiftTrainingDaysDates,
  shiftDaySplitStatesDates,
} from '@/utils/dateShifting';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { syncAthleteSchedule } from '@/utils/athleteScheduleSync';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AthleteCalendarWeekRow } from './AthleteCalendarWeekRow';
import { AthleteCalendarDay, AthleteCalendarSession } from './AthleteCalendarDayCell';
import { WorkoutSessionSheet } from '@/components/microcycle-planning/WorkoutSessionSheet';
import { MasterPlannerGrid } from '@/components/microcycle-planning/MasterPlannerGrid';
import { WizardAIAssistant, FocusedSessionContext, ApplySuggestion } from '@/components/wizard/WizardAIAssistant';
import { useRAGRetrieval } from '@/hooks/useRAGRetrieval';
import { useCoachMemory } from '@/hooks/useCoachMemory';
import { useGlobalAIContext } from '@/hooks/useGlobalAIContext';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useAthleteAIContext } from '@/hooks/useAthleteAIContext';
import { IntensityLevel } from '@/types/training';
import { cn } from '@/lib/utils';

interface AthleteCalendarViewProps {
  athlete: Athlete;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function AthleteCalendarView({ athlete }: AthleteCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('4week');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteAssignment, setDeleteAssignment] = useState<AthleteCalendarAssignment | null>(null);
  const [reviewAssignment, setReviewAssignment] = useState<AthleteCalendarAssignment | null>(null);
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [selectedSessionInfo, setSelectedSessionInfo] = useState<{
    dayDate: string;
    sessionIndex: number;
    assignmentId: string;
  } | null>(null);
  
  // Master planner state
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1); // 1=Monday
  const [masterWeeksToDisplay, setMasterWeeksToDisplay] = useState(4);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  
  // Ref-based drag end timestamp for SYNCHRONOUS click suppression
  // State was too slow - React re-render happens AFTER onClick fires
  const lastDragEndRef = useRef<number>(0);
  
  // Global click suppression: swallow the very next click after any drag
  const suppressNextClickRef = useRef(false);
  const suppressNextClickTimeoutRef = useRef<number | null>(null);
  
  // Install global capture-phase click listener to swallow post-drag clicks
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('click', handler, true); // Capture phase
    return () => {
      window.removeEventListener('click', handler, true);
      if (suppressNextClickTimeoutRef.current) {
        clearTimeout(suppressNextClickTimeoutRef.current);
      }
    };
  }, []);

  const { programs, getProgram } = useTrainingPrograms();
  const athleteData = useAthletes();
  const { data: toolboxData } = useToolboxData();
  const { toast } = useToast();
  const { getConnectionForAthlete } = useAthleteConnections();
  const { addEvent: addCalendarEvent, addEvents: addCalendarEvents, deleteEvent: deleteCalendarEvent, getEventsForAthlete, getEventsForDate } = useCalendarEvents();

  // AI assistant state
  const [aiOpenTrigger, setAiOpenTrigger] = useState(0);
  const [focusedSessionCtx, setFocusedSessionCtx] = useState<FocusedSessionContext | undefined>(undefined);

  // AI context hooks
  const { retrieve: ragRetrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');
  const globalAIContext = useGlobalAIContext();
  const { coachMemoryContext } = useCoachMemory();
  const { data: parametersData } = useParametersDataV2();

  const assignments = useMemo(() => {
    return athleteData.getAthleteCalendarAssignments(athlete.id);
  }, [athleteData, athlete.id]);
  
  // RAG retrieval — re-query when athlete changes
  useEffect(() => {
    const sports = [...(athlete.sports ?? []), ...(!athlete.sports && athlete.sport ? [athlete.sport] : [])];
    const query = sports.length > 0
      ? `athlete training ${sports.join(' ')} session design performance monitoring`
      : 'athlete training session design performance monitoring';
    ragRetrieve(query).then(setRagContext);
  }, [ragRetrieve, athlete.id]);

  // Editing hook — must be declared before useAthleteAIContext which references editing.exerciseDistribution
  const editing = useAthleteCalendarEditing(selectedAssignmentId, assignments);

  // Athlete-specific AI context
  const athleteAIContext = useAthleteAIContext({
    athlete,
    performanceParameters: athleteData.athletePerformanceParameters.filter(p => p.athleteId === athlete.id),
    assignments,
    calendarEvents: getEventsForAthlete(athlete.id),
    programs,
    parametersData: parametersData ?? null,
    exerciseDistribution: editing.exerciseDistribution,
  });

  // AI apply handler — intensity changes can be applied directly; session-level
  // actions should be triggered from within the session sheet
  const handleAIApply = useCallback((action: ApplySuggestion) => {
    if (action.type === 'set_day_intensity') {
      editing.handleDayIntensityChange(action.dayDate, action.intensity as IntensityLevel);
    } else if (action.type === 'set_session_intensity') {
      editing.handleSessionIntensityChange(action.dayDate, action.sessionIndex, action.intensity as IntensityLevel);
    } else if (action.type === 'set_exercise_params') {
      // Apply parameter overrides (sets/reps/intensity/etc.) directly from the calendar.
      // handleParameterChange persists to parameterValues so the change is visible
      // when the session sheet opens, enabling bulk changes across many sessions.
      Object.entries(action.params).forEach(([paramName, value]) => {
        editing.handleParameterChange(
          action.dayDate,
          action.sessionIndex,
          action.methodId,
          '',
          paramName,
          value,
        );
      });
    } else if (action.type === 'set_exercise_param_override') {
      // Per-exercise overrides: update parameterOverrides on the specific ExerciseDistribution entry
      editing.setExerciseDistribution(prev =>
        prev.map(ex => {
          const match = action.entries.find(
            e => e.exerciseId === ex.exerciseId && e.dayDate === ex.dayDate && e.sessionIndex === ex.sessionIndex
          );
          if (!match) return ex;
          return { ...ex, parameterOverrides: { ...(ex.parameterOverrides ?? {}), ...match.params } };
        })
      );
      const names = [...new Set(action.entries.map(e => e.exerciseName))];
      const count = action.entries.length;
      toast({ title: `Per-exercise overrides applied`, description: `${names.join(', ')} — ${count} slot${count !== 1 ? 's' : ''} updated` });
    } else {
      toast({
        title: 'Open the session to apply',
        description: 'Click on a session first, then use the AI assistant from within it for this type of change.',
      });
    }
  }, [editing, toast]);

  // Store a map of assignment ID -> stored program data for quick lookups
  const [assignmentDataCache, setAssignmentDataCache] = useState<Record<string, any>>({});
  
  // Load assignment data from localStorage for all assignments
  useEffect(() => {
    if (assignments.length === 0) {
      if (Object.keys(assignmentDataCache).length > 0) {
        setAssignmentDataCache({});
      }
      return;
    }
    
    const cache: Record<string, any> = {};
    let hasNewData = false;

    assignments.forEach(assignment => {
      // Check if already cached
      if (assignmentDataCache[assignment.id]) {
        cache[assignment.id] = assignmentDataCache[assignment.id];
        return;
      }

      // New assignment ID not yet in cache — mark as new regardless of localStorage
      hasNewData = true;

      const storageKey = `athlete-assignment-${assignment.id}`;
      try {
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
          cache[assignment.id] = JSON.parse(savedData);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    console.log('[CACHE-EFFECT] assignments:', assignments.map(a => a.id), '| cache keys:', Object.keys(cache), '| hasNewData:', hasNewData);
    // Only update if we found new data
    if (hasNewData || Object.keys(cache).length !== Object.keys(assignmentDataCache).length) {
      console.log('[CACHE-EFFECT] updating cache');
      setAssignmentDataCache(cache);
    }
  }, [assignments]); // intentionally exclude assignmentDataCache to prevent infinite loop

  // Initialize selected assignment when assignments change
  useEffect(() => {
    if (assignments.length > 0 && !selectedAssignmentId) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  // Wrapper: clear day in editing state AND patch assignmentDataCache so non-selected
  // assignment rendering (cache path) immediately reflects the cleared state.
  const handleClearDay = useCallback((dayDate: string) => {
    editing.handleClearDay(dayDate);
    if (!selectedAssignmentId) return;
    setAssignmentDataCache(prev => {
      const current = prev[selectedAssignmentId];
      if (!current) return prev;
      return {
        ...prev,
        [selectedAssignmentId]: {
          ...current,
          daySplitStates: { ...(current.daySplitStates || {}), [dayDate]: 0 },
          trainingDays: (current.trainingDays || []).map((d: any) =>
            d.date === dayDate
              ? { ...d, sessions: 0, sessionNames: [], testNames: [], eventNames: [], isTestDay: false, isEventDay: false }
              : d
          ),
          exerciseDistribution: (current.exerciseDistribution || []).filter((ex: any) => ex.dayDate !== dayDate),
          sessionSections: (current.sessionSections || []).filter((s: any) => s.dayDate !== dayDate),
        },
      };
    });
  }, [editing.handleClearDay, selectedAssignmentId]);

  // Wrapper: clear week in editing state AND patch assignmentDataCache.
  const handleClearWeek = useCallback((weekStartDate: string) => {
    editing.handleClearWeek(weekStartDate);
    if (!selectedAssignmentId) return;
    const [cy, cm, cd] = weekStartDate.split('-').map(Number);
    const startDateVal = new Date(cy, cm - 1, cd);
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDateVal);
      d.setDate(d.getDate() + i);
      weekDates.push(format(d, 'yyyy-MM-dd'));
    }
    setAssignmentDataCache(prev => {
      const current = prev[selectedAssignmentId];
      if (!current) return prev;
      const clearedSplitStates = { ...(current.daySplitStates || {}) };
      weekDates.forEach(date => { clearedSplitStates[date] = 0; });
      return {
        ...prev,
        [selectedAssignmentId]: {
          ...current,
          daySplitStates: clearedSplitStates,
          trainingDays: (current.trainingDays || []).map((d: any) =>
            weekDates.includes(d.date)
              ? { ...d, sessions: 0, sessionNames: [], testNames: [], eventNames: [], isTestDay: false, isEventDay: false }
              : d
          ),
          exerciseDistribution: (current.exerciseDistribution || []).filter((ex: any) => !weekDates.includes(ex.dayDate)),
          sessionSections: (current.sessionSections || []).filter((s: any) => !weekDates.includes(s.dayDate)),
        },
      };
    });
  }, [editing.handleClearWeek, selectedAssignmentId]);

  // Build mesocycle from assignment for MasterPlannerGrid
  const currentMesocycleFromAssignment = useMemo(() => {
    if (!editing.selectedAssignment) return undefined;
    
    const meso = (editing.selectedAssignment.assignedMesocycles || [])[0];
    if (!meso) return undefined;
    
    return {
      id: meso.id,
      name: meso.name,
      weeks: meso.weeks,
      sessionsPerWeek: meso.sessionsPerWeek,
      sessionLength: meso.sessionLength,
      startDate: parseDateStr(meso.startDate),
      endDate: parseDateStr(meso.endDate),
      duration: meso.duration,
      intensity: meso.intensity as any,
      microcycles: (meso.microcycles || []).map(m => ({
        id: m.id,
        name: m.name,
        duration: m.duration,
        intensity: m.intensity as any,
      })),
      trainingMethods: [],
      trainingQualities: meso.trainingQualities,
      allocatedSubGoals: meso.allocatedSubGoals,
    };
  }, [editing.selectedAssignment]);

  // Shared calendar grid date range calculation
  const { dateRange: calendarDateRange } = useCalendarGrid(currentDate, viewMode);

  // Calculate calendar days based on view mode (for calendar view)
  // IMPORTANT: For the currently selected assignment, read from live editing state
  // to ensure immediate visual feedback after paste/copy operations
  const calendarDays = useMemo((): AthleteCalendarDay[] => {
    if (viewMode === 'master') return [];

    const days = calendarDateRange;

    return days.map(date => {
      const dateString = format(date, 'yyyy-MM-dd');

      // Extract session data for this specific day
      const sessions: AthleteCalendarSession[] = [];
      let assignmentId: string | undefined;
      let programName: string | undefined;
      let usedLiveEditingState = false;

      // CRITICAL FIX: Check live editing state FIRST for the selected assignment
      // This allows pasted content to display even on dates OUTSIDE the original assignment range
      if (selectedAssignmentId) {
        const liveExercises = editing.exerciseDistribution.filter(
          (ex: any) => ex.dayDate === dateString
        );
        const liveSplitState = editing.daySplitStates[dateString];
        const liveTrainingDay = editing.trainingDays.find((td: any) => td.date === dateString);

        const hasLiveExercises = liveExercises.length > 0;
        const hasLiveSessions = liveSplitState !== undefined && liveSplitState > 0;
        // CRITICAL: If liveSplitState is defined (even as 0), the editing hook has authoritative state
        const hasExplicitEditingState = liveSplitState !== undefined || liveTrainingDay !== undefined;
        const hasLiveData = hasLiveExercises || hasLiveSessions;

        if (hasLiveData || hasExplicitEditingState) {
          if (hasExplicitEditingState || hasLiveExercises || hasLiveSessions) {
            usedLiveEditingState = true;
          }
          const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);
          assignmentId = selectedAssignmentId;
          programName = selectedAssignment?.programName;

          // Get day intensity from live dailyIntensity data, fall back to trainingDays intensity
          let dayIntensity: IntensityLevel = liveTrainingDay?.intensity || '5';
          const liveDayIntensity = editing.dailyIntensityData.find(
            (d: any) => d.date === dateString
          );
          if (liveDayIntensity?.intensity) {
            dayIntensity = liveDayIntensity.intensity as IntensityLevel;
          }

          // FIX: Use actual splitState value - 0 means cleared day.
          // Fall back to liveTrainingDay.sessions when daySplitStates hasn't been initialised yet.
          const numSessions = liveSplitState ?? liveTrainingDay?.sessions ?? 0;
          // Suppress ghost sessions: if dailyIntensityData says 'off' and there are no
          // actual exercises, the day is a rest day – regardless of what daySplitStates
          // says (can be corrupted to 1 by the fallback merge path).
          const effectiveNumSessions = dayIntensity === 'off' && !hasLiveExercises ? 0 : numSessions;
          if (effectiveNumSessions > 0 || hasLiveExercises) {
            const sessionCount = effectiveNumSessions > 0 ? effectiveNumSessions : 1;
            for (let sessionIdx = 0; sessionIdx < sessionCount; sessionIdx++) {
              const sessionId = `${selectedAssignmentId}-${dateString}-${sessionIdx}`;
              const sessionName = liveTrainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`;
              const exerciseCount = liveExercises.filter(
                (ex: any) => ex.sessionIndex === sessionIdx
              ).length;

              const perSessionKey = `${dateString}-${sessionIdx}`;
              const sessionIntensity = editing.sessionIntensities?.[perSessionKey] ?? dayIntensity;

              sessions.push({
                id: sessionId,
                sessionIndex: sessionIdx,
                sessionName,
                exerciseCount,
                intensity: sessionIntensity,
                assignmentId: selectedAssignmentId,
              });
            }
          }
        }
      }

      // Always render cached assignments for non-selected assignments.
      // The live editing path above only handles selectedAssignmentId.
      // Skip selectedAssignmentId here only if live editing already handled it —
      // otherwise (usedLiveEditingState=false) it still needs to run through this path.
      {
        const dayAssignments = assignments.filter(assignment => {
          if (assignment.id === selectedAssignmentId && usedLiveEditingState) return false;
          const assignmentStart = parseDateStr(assignment.startDate);
          const assignmentEnd = parseDateStr(assignment.endDate);
          return isWithinInterval(date, { start: assignmentStart, end: assignmentEnd });
        });

        if (dayAssignments.length > 0) console.log('[RENDER-RANGE]', dateString, 'assignments covering date:', dayAssignments.map(a => a.id.slice(-6) + '(' + a.programName + ')'));
        dayAssignments.forEach(assignment => {
          assignmentId = assignment.id;
          programName = assignment.programName;

          const isEditingAssignment = assignment.id === selectedAssignmentId;

          if (isEditingAssignment) {
            // Use live editing state for immediate updates
            const liveExercises = editing.exerciseDistribution.filter(
              (ex: any) => ex.dayDate === dateString
            );
            const liveSplitState = editing.daySplitStates[dateString];
            const liveTrainingDay = editing.trainingDays.find((td: any) => td.date === dateString);

            let dayIntensity: IntensityLevel = liveTrainingDay?.intensity || '5';
            const liveDayIntensity = editing.dailyIntensityData.find(
              (d: any) => d.date === dateString
            );
            if (liveDayIntensity?.intensity) {
              dayIntensity = liveDayIntensity.intensity as IntensityLevel;
            }

            const hasExercises = liveExercises.length > 0;
            const numSessions = liveSplitState ?? liveTrainingDay?.sessions ?? 0;
            const isTrainingDay = hasExercises || numSessions > 0;

            if (isTrainingDay) {
              const sessionCount = numSessions > 0 ? numSessions : 1;
              for (let sessionIdx = 0; sessionIdx < sessionCount; sessionIdx++) {
                const sessionId = `${assignment.id}-${dateString}-${sessionIdx}`;
                const sessionName = liveTrainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`;
                const exerciseCount = liveExercises.filter(
                  (ex: any) => ex.sessionIndex === sessionIdx
                ).length;

                const perSessionKey = `${dateString}-${sessionIdx}`;
                const sessionIntensity = editing.sessionIntensities?.[perSessionKey] ?? dayIntensity;

                sessions.push({
                  id: sessionId,
                  sessionIndex: sessionIdx,
                  sessionName,
                  exerciseCount,
                  intensity: sessionIntensity,
                  assignmentId: assignment.id,
                });
              }
            }
          } else {
            // Use cache for other (non-editing) assignments
            const cachedData = assignmentDataCache[assignment.id];
            const trainingDay = cachedData?.trainingDays?.find((td: any) => td.date === dateString);
            const numSessions = cachedData?.daySplitStates?.[dateString] ?? trainingDay?.sessions ?? 1;

            let dayIntensity: IntensityLevel = 'moderate';
            if (cachedData?.dailyIntensity) {
              const storedDayIntensity = cachedData.dailyIntensity.find(
                (d: any) => d.date === dateString
              );
              if (storedDayIntensity?.intensity) {
                dayIntensity = storedDayIntensity.intensity as IntensityLevel;
              }
            }

            const hasExercises = cachedData?.exerciseDistribution?.some((ex: any) => ex.dayDate === dateString);
            const splitState = cachedData?.daySplitStates?.[dateString];
            const isTrainingDay = hasExercises || trainingDay?.isTrainingDay || (splitState !== undefined && splitState > 0);
            if (dateString <= '2025-12-31') console.log('[RENDER-CACHE]', dateString, 'assignId:', assignment.id.slice(-6), '| cachedData?', !!cachedData, '| splitState:', splitState, '| trainingDay?', !!trainingDay, '| hasExercises:', hasExercises, '| isTrainingDay:', isTrainingDay);

            if (isTrainingDay) {
              for (let sessionIdx = 0; sessionIdx < numSessions; sessionIdx++) {
                const sessionId = `${assignment.id}-${dateString}-${sessionIdx}`;
                const sessionName = trainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`;
                let exerciseCount = 0;
                if (cachedData?.exerciseDistribution) {
                  exerciseCount = cachedData.exerciseDistribution.filter(
                    (ex: any) => ex.dayDate === dateString && ex.sessionIndex === sessionIdx
                  ).length;
                }

                let sessionIntensity = dayIntensity;
                if (trainingDay?.mesocycleId && cachedData?.parameterValues) {
                  const sessionIntensityKey = `sessionIntensity_${trainingDay.mesocycleId}_${dateString}_${sessionIdx}`;
                  if (cachedData.parameterValues[sessionIntensityKey]) {
                    sessionIntensity = cachedData.parameterValues[sessionIntensityKey] as IntensityLevel;
                  }
                }

                sessions.push({
                  id: sessionId,
                  sessionIndex: sessionIdx,
                  sessionName,
                  exerciseCount,
                  intensity: sessionIntensity,
                  assignmentId: assignment.id,
                });
              }
            }
          }
        });
      }

      // Compute day-level intensity for the overview square
      // This is SEPARATE from session intensities for multi-session days
      let dayIntensityForSquare: IntensityLevel = 'moderate';
      if (selectedAssignmentId) {
        const liveDayIntensity = editing.dailyIntensityData.find(
          (d: any) => d.date === dateString
        );
        const liveTrainingDay = editing.trainingDays.find((td: any) => td.date === dateString);
        if (liveDayIntensity?.intensity) {
          dayIntensityForSquare = liveDayIntensity.intensity as IntensityLevel;
        } else if (liveTrainingDay?.intensity) {
          dayIntensityForSquare = liveTrainingDay.intensity;
        }
      }

      return {
        date,
        dateString,
        isCurrentMonth: isSameMonth(date, currentDate),
        sessions,
        assignmentId,
        programName,
        intensity: dayIntensityForSquare,
        calendarEvents: getEventsForDate(athlete.id, dateString),
      };
    });
  }, [calendarDateRange, viewMode, assignments, assignmentDataCache, selectedAssignmentId, editing.exerciseDistribution, editing.daySplitStates, editing.trainingDays, editing.dailyIntensityData, editing.sessionIntensities, getEventsForDate, athlete.id]);

  // Group days into weeks
  const weeks = useMemo(() => groupDaysIntoWeeks(calendarDays), [calendarDays]);

  // Calculate date range display
  const dateRangeDisplay = useMemo(() => {
    if (viewMode === 'master' && editing.selectedAssignment) {
      return `${format(parseDateStr(editing.selectedAssignment.startDate), 'MMM d')} - ${format(parseDateStr(editing.selectedAssignment.endDate), 'MMM d, yyyy')}`;
    }
    if (calendarDays.length === 0) return '';
    const firstDay = calendarDays[0].date;
    const lastDay = calendarDays[calendarDays.length - 1].date;
    return `${format(firstDay, 'MMM d')} - ${format(lastDay, 'MMM d, yyyy')}`;
  }, [calendarDays, viewMode, editing.selectedAssignment]);

  const handlePrevious = () => {
    setCurrentDate(prev => subWeeks(prev, 1));
  };

  const handleNext = () => {
    setCurrentDate(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowAssignDialog(true);
  };

  const handleAddSession = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    setSelectedSessionInfo({
      dayDate: dateString,
      sessionIndex: 0,
      assignmentId: '',
    });
    setSessionSheetOpen(true);
  };

  const handleSessionClick = useCallback((dayDate: string, sessionIndex: number, assignmentId: string) => {
    // FINAL SAFETY NET: Reject clicks within 600ms of last drag end
    if (Date.now() - lastDragEndRef.current < 600) {
      return;
    }

    // Use the provided assignmentId directly (no guessing)
    if (assignmentId) {
      // Set the selected assignment BEFORE opening the sheet
      setSelectedAssignmentId(assignmentId);
    }
    
    setSelectedSessionInfo({
      dayDate,
      sessionIndex,
      assignmentId,
    });
    setSessionSheetOpen(true);
  }, []);

  // Handle drag start - arm click suppression immediately
  const handleSessionDragStart = useCallback(() => {
    suppressNextClickRef.current = true;
  }, []);

  // Handle session drag-and-drop between days
  const handleSessionDragEnd = useCallback((result: DropResult) => {
    // CRITICAL: Set drag end timestamp IMMEDIATELY at the top (synchronous via ref)
    // This ensures onClick handlers see it BEFORE React re-renders
    lastDragEndRef.current = Date.now();
    
    // Arm global click suppression and set auto-reset timeout
    suppressNextClickRef.current = true;
    if (suppressNextClickTimeoutRef.current) {
      clearTimeout(suppressNextClickTimeoutRef.current);
    }
    suppressNextClickTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 800);
    
    if (!result.destination) {
      return;
    }

    const sourceDayDate = result.source.droppableId;
    const destDayDate = result.destination.droppableId;

    // Parse session index from draggableId
    // Format: "assignmentId-YYYY-MM-DD-sessionIndex"
    const draggableId = result.draggableId;
    const parts = draggableId.split('-');
    // Last part is the session index
    const sourceSessionIndex = parseInt(parts[parts.length - 1], 10);

    // Same day - no move needed (could add reordering later)
    if (sourceDayDate === destDayDate) {
      return;
    }
    
    // Validate parsed index
    if (isNaN(sourceSessionIndex)) {
      console.error('[handleSessionDragEnd] Could not parse session index from draggableId:', draggableId);
      return;
    }
    
    // Use the hook's handler for moving sessions (which also toasts)
    editing.handleMoveSession(sourceDayDate, sourceSessionIndex, destDayDate);
  }, [editing]);

  const handleAssignProgram = useCallback(async (assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>) => {
    console.log('[ASSIGN] handleAssignProgram called, programId:', assignment.programId, 'startDate:', assignment.startDate, 'endDate:', assignment.endDate, 'assignedMesocycles:', assignment.assignedMesocycles?.length);

    // When an assignment is already active, merge program sessions into it instead of
    // creating a separate assignment. This keeps all sessions equal regardless of origin.
    const mergeIntoExisting = !!selectedAssignmentId;

    // Create the assignment record only when there is no existing assignment to merge into
    const newAssignment = mergeIntoExisting
      ? null
      : await athleteData.createCalendarAssignment(athlete.id, assignment);
    console.log('[ASSIGN] mergeIntoExisting:', mergeIntoExisting, '| newAssignment:', newAssignment?.id ?? 'none');

    // Process program workout data with shifted dates
    if ((mergeIntoExisting || newAssignment) && assignment.programId) {
      // Read directly from localStorage to ensure we get latest data (bypasses stale React state)
      let program: TrainingProgram | null = null;
      try {
        const stored = localStorage.getItem('trainingPrograms');
        if (stored) {
          const parsed = JSON.parse(stored);
          program = parsed.programs?.find((p: TrainingProgram) => p.id === assignment.programId) || null;
        }
      } catch (e) {
        console.error('[handleAssignProgram] Error reading program from localStorage:', e);
      }
      
      // Fallback to hook's getProgram if localStorage read fails
      if (!program) {
        program = getProgram(assignment.programId);
      }
      
      if (program) {
        // Compute a robust originalStartDate from the earliest valid date in SELECTED mesocycles' data.
        // Filter by selectedMesocycleIds so that assigning only meso 2 anchors the shift to meso 2's
        // own start, not the whole program's start. Without this, sessions land at
        // D2 + meso2_offset_within_program instead of D2.
        // Order of precedence: trainingDays > exerciseDistribution > dailyIntensityData > duration.startDate
        let originalStartDate: Date | null = null;

        const selectedMesoIdsForOrigin = new Set(assignment.selectedMesocycleIds || []);

        // Try trainingDays first (filtered to selected mesocycles when IDs are available)
        if (program.trainingDays && Array.isArray(program.trainingDays) && program.trainingDays.length > 0) {
          const relevantDays = selectedMesoIdsForOrigin.size > 0
            ? program.trainingDays.filter((d: any) => !d.mesocycleId || selectedMesoIdsForOrigin.has(d.mesocycleId))
            : program.trainingDays;
          const source = relevantDays.length > 0 ? relevantDays : program.trainingDays;
          const validDates = source
            .map((d: any) => new Date(d.date + 'T12:00:00'))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (validDates.length > 0) {
            originalStartDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          }
        }

        // Try exerciseDistribution (no mesocycleId on exercises; validDates filter below handles selection)
        if (!originalStartDate && program.exerciseDistribution && program.exerciseDistribution.length > 0) {
          const validDates = program.exerciseDistribution
            .map((ex: any) => new Date(ex.dayDate + 'T12:00:00'))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (validDates.length > 0) {
            originalStartDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          }
        }

        // Try dailyIntensityData (filtered to selected mesocycles when IDs are available)
        if (!originalStartDate && program.dailyIntensityData && program.dailyIntensityData.length > 0) {
          const relevantIntensity = selectedMesoIdsForOrigin.size > 0
            ? program.dailyIntensityData.filter((di: any) => !di.mesocycleId || selectedMesoIdsForOrigin.has(di.mesocycleId))
            : program.dailyIntensityData;
          const source = relevantIntensity.length > 0 ? relevantIntensity : program.dailyIntensityData;
          const validDates = source
            .map((di: any) => new Date(di.date + 'T12:00:00'))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (validDates.length > 0) {
            originalStartDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          }
        }
        
        // Fallback to duration.startDate
        if (!originalStartDate && program.duration?.startDate) {
          const parsed = new Date(program.duration.startDate);
          if (!isNaN(parsed.getTime())) {
            originalStartDate = parsed;
          }
        }
        
        // If still no valid date, show error and cleanup
        if (!originalStartDate) {
          console.error('[handleAssignProgram] Could not determine original start date');
          if (newAssignment) await athleteData.deleteCalendarAssignment(newAssignment.id);
          toast({
            title: "Assignment failed",
            description: "Could not determine the program's start date. Please ensure the program has valid training data.",
            variant: "destructive",
          });
          return;
        }
        
        // Normalize both dates to UTC midnight for accurate day-based shifting
        // This prevents timezone-related off-by-one errors
        const normalizedOriginalStart = new Date(Date.UTC(
          originalStartDate.getFullYear(),
          originalStartDate.getMonth(),
          originalStartDate.getDate()
        ));
        
        const assignmentDate = parseDateStr(assignment.startDate);
        const normalizedNewStart = new Date(Date.UTC(
          assignmentDate.getFullYear(),
          assignmentDate.getMonth(),
          assignmentDate.getDate()
        ));

        const dayOffset = (normalizedNewStart.getTime() - normalizedOriginalStart.getTime()) / 86400000;

        try {
          // Shift all program data to match the new start date using normalized dates
          const shiftedExercises = program.exerciseDistribution 
            ? shiftExerciseDates(program.exerciseDistribution, normalizedOriginalStart, normalizedNewStart)
            : [];
          
          // Get daily intensity data - try program object first, then global localStorage key
          let sourceDailyIntensity = program.dailyIntensityData;
          if (!sourceDailyIntensity || sourceDailyIntensity.length === 0) {
            try {
              const globalIntensity = localStorage.getItem('dailyIntensityData');
              if (globalIntensity) {
                sourceDailyIntensity = JSON.parse(globalIntensity);
              }
            } catch (e) {
              // ignore
            }
          }
            
          const shiftedDailyIntensity = sourceDailyIntensity
            ? shiftDailyIntensityDates(sourceDailyIntensity, normalizedOriginalStart, normalizedNewStart)
            : [];
            
          const shiftedSections = program.sessionSections
            ? Array.isArray(program.sessionSections)
              ? shiftSessionSectionDates(program.sessionSections, normalizedOriginalStart, normalizedNewStart)
              : program.sessionSections
            : [];
            
          const shiftedSupersets = program.supersets
            ? shiftSupersetDates(program.supersets as any, normalizedOriginalStart, normalizedNewStart)
            : {};
            
          const shiftedTrainingDays = program.trainingDays
            ? shiftTrainingDaysDates(program.trainingDays, normalizedOriginalStart, normalizedNewStart)
            : [];
            
          // Derive split states with three-tier fallback:
          // 1. program.daySplitStates (most accurate — includes multi-session days)
          // 2. program.trainingDays (has per-day intensity; off days → 0 sessions)
          // 3. program.dailyIntensityData (per-day intensity from the loading wave)
          const sourceSplitStates: Record<string, number> =
            program.daySplitStates && Object.keys(program.daySplitStates).length > 0
              ? program.daySplitStates
              : (program.trainingDays ?? []).length > 0
                ? (program.trainingDays!).reduce<Record<string, number>>((acc, day) => {
                    acc[day.date] = day.sessions ?? (day.intensity === '0' ? 0 : 1);
                    return acc;
                  }, {})
                : (program.dailyIntensityData ?? []).reduce<Record<string, number>>((acc, di) => {
                    acc[di.date] = di.intensity === '0' ? 0 : 1;
                    return acc;
                  }, {});

          const shiftedDaySplitStates = shiftDaySplitStatesDates(
            sourceSplitStates,
            normalizedOriginalStart,
            normalizedNewStart
          );

          // Build validDates by filtering shiftedTrainingDays by selected
          // mesocycle/microcycle IDs. Training days carry mesocycleId and
          // microcycleId AND are shifted with the same offset as exercises —
          // so their dates are the reliable source of truth for which dates
          // belong to the selected mesos/micros.
          //
          // The previous approach (building validDates from assignedMesocycles
          // startDate/endDate) was wrong because assignedMesocycles dates are
          // recalculated to start from the assignment date, while exercises are
          // shifted relative to the FULL program's earliest date. This caused a
          // date mismatch for partial meso/micro selections.
          const selectedMesoIds = new Set(assignment.selectedMesocycleIds || []);
          const selectedMicroIds = new Set(assignment.selectedMicrocycleIds || []);

          // A training day passes the filter when:
          // - it has a mesocycleId that is in selectedMesoIds, OR it has no
          //   mesocycleId (old data — include unconditionally to stay safe)
          // - same rule for microcycleId
          let filteredTrainingDays = shiftedTrainingDays.filter(td => {
            const mesoOk = !td.mesocycleId || selectedMesoIds.size === 0 || selectedMesoIds.has(td.mesocycleId);
            const microOk = !td.microcycleId || selectedMicroIds.size === 0 || selectedMicroIds.has(td.microcycleId);
            return mesoOk && microOk;
          });

          // ID mismatch guard: if the filter emptied the list but the program has
          // training days, the stored mesocycle IDs don't match the selected ones
          // (e.g. plan re-saved after mesocycle structure was regenerated). Fall
          // back to all shifted training days so the calendar is never blank.
          if (filteredTrainingDays.length === 0 && shiftedTrainingDays.length > 0) {
            console.log('[ASSIGN] Mesocycle ID mismatch — including all shifted training days');
            filteredTrainingDays = shiftedTrainingDays;
          }

          // Build validDates from the filtered training days.
          let validDates = new Set<string>(filteredTrainingDays.map((td: any) => td.date));

          // Fallback for old programs whose training days carry no meso/micro IDs:
          // derive valid dates from the recalculated assignedMesocycles date ranges.
          // This path may be slightly off for partial selections but avoids data loss.
          if (validDates.size === 0 && (assignment.assignedMesocycles || []).length > 0) {
            console.log('[ASSIGN] No training days with meso/micro IDs found — falling back to assignedMesocycles date ranges');
            assignment.assignedMesocycles.forEach(meso => {
              const mesoStart = parseDateStr(meso.startDate);
              const mesoEnd = parseDateStr(meso.endDate);
              eachDayOfInterval({ start: mesoStart, end: mesoEnd }).forEach(day => {
                validDates.add(format(day, 'yyyy-MM-dd'));
              });
            });
          }

          console.log('[ASSIGN] validDates size:', validDates.size, '| filteredTrainingDays:', filteredTrainingDays.length, '| sample dates:', Array.from(validDates).slice(0, 5));

          // Filter all shifted data to validDates.
          // If validDates is still empty, skip filtering (include everything).
          const filteredExercises = validDates.size > 0
            ? shiftedExercises.filter(ex => validDates.has(ex.dayDate))
            : shiftedExercises;
          const filteredSections = validDates.size > 0
            ? shiftedSections.filter(s => validDates.has(s.dayDate))
            : shiftedSections;
          const filteredSupersets = validDates.size > 0
            ? Object.fromEntries(Object.entries(shiftedSupersets).filter(([d]) => validDates.has(d)))
            : shiftedSupersets;
          let filteredDailyIntensity = validDates.size > 0
            ? shiftedDailyIntensity.filter(di => validDates.has(di.date))
            : shiftedDailyIntensity;
          const filteredDaySplitStates = validDates.size > 0
            ? Object.fromEntries(Object.entries(shiftedDaySplitStates).filter(([d]) => validDates.has(d)))
            : shiftedDaySplitStates;

          console.log('[ASSIGN] after filter — exercises:', filteredExercises.length, '| sections:', filteredSections.length, '| daySplitStates keys:', Object.keys(filteredDaySplitStates).length);

          // Fallback: if the program had no daySplitStates or trainingDays stored,
          // build them from the assignment's already-shifted mesocycles so the
          // calendar can always display sessions for a non-selected assignment
          // via the cache rendering path (which relies on these fields).
          let finalDaySplitStates = filteredDaySplitStates;
          let finalTrainingDays = filteredTrainingDays;

          // If training days are still empty but shifted daily intensity data is
          // available, build them from that. This covers plans where only
          // dailyIntensityData was saved (skipped microcycle planning step).
          if (finalTrainingDays.length === 0 && shiftedDailyIntensity.length > 0) {
            finalTrainingDays = shiftedDailyIntensity.map((di: any) => ({
              date: di.date,
              dayOfWeek: new Date(di.date + 'T12:00:00').getDay(),
              dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(di.date + 'T12:00:00').getDay()],
              mesocycleId: di.mesocycleId,
              microcycleId: di.microcycleId,
              isTestDay: false,
              isEventDay: false,
              isTrainingDay: di.intensity !== '0',
              intensity: di.intensity,
              sessions: di.intensity === '0' ? 0 : 1,
              sessionNames: di.intensity === '0' ? [] : ['Session 1'],
            }));
            // Sync split states from this derived training days list
            if (Object.keys(finalDaySplitStates).length === 0) {
              finalDaySplitStates = finalTrainingDays.reduce<Record<string, number>>((acc, td: any) => {
                acc[td.date] = td.sessions;
                return acc;
              }, {});
            }
            console.log('[ASSIGN] built trainingDays + splitStates from dailyIntensityData, days:', finalTrainingDays.length);
          }

          if (Object.keys(finalDaySplitStates).length === 0 && assignment.assignedMesocycles?.length > 0) {
            const splitStates: Record<string, number> = {};
            const trainingDaysList: any[] = [];

            // Build a lookup from shiftedDailyIntensity for per-day overrides
            const dailyIntensityLookup = new Map<string, string>();
            shiftedDailyIntensity.forEach((di: any) => {
              if (di.date && di.intensity) dailyIntensityLookup.set(di.date, di.intensity);
            });

            assignment.assignedMesocycles.forEach(meso => {
              const mesoStart = parseDateStr(meso.startDate);
              const mesoEnd = parseDateStr(meso.endDate);
              const allDays = eachDayOfInterval({ start: mesoStart, end: mesoEnd });
              let microOffset = 0;
              (meso.microcycles || []).forEach(micro => {
                const microIntensity = (micro.intensity || meso.intensity || '5') as string;
                for (let i = 0; i < micro.duration; i++) {
                  const day = allDays[microOffset + i];
                  if (!day) continue;
                  const dateString = format(day, 'yyyy-MM-dd');
                  // Per-day intensity overrides microcycle intensity
                  const intensity = dailyIntensityLookup.get(dateString) || microIntensity;
                  const numSessions = intensity === '0' ? 0 : 1;
                  splitStates[dateString] = numSessions;
                  trainingDaysList.push({
                    date: dateString,
                    dayOfWeek: day.getDay(),
                    dayName: format(day, 'EEEE'),
                    mesocycleId: meso.id,
                    microcycleId: micro.id,
                    isTestDay: false,
                    isEventDay: false,
                    isTrainingDay: intensity !== '0',
                    intensity,
                    sessions: numSessions,
                    sessionNames: numSessions > 0 ? ['Session 1'] : [],
                  });
                }
                microOffset += micro.duration;
              });
            });

            finalDaySplitStates = splitStates;
            if (finalTrainingDays.length === 0) {
              finalTrainingDays = trainingDaysList;
            }
            console.log('[ASSIGN] built daySplitStates from mesocycles, keys:', Object.keys(finalDaySplitStates).length, 'sample:', Object.entries(finalDaySplitStates).slice(0, 3));
          } else {
            console.log('[ASSIGN] daySplitStates from program data, keys:', Object.keys(finalDaySplitStates).length);
          }
          console.log('[ASSIGN] finalTrainingDays.length:', finalTrainingDays.length, 'finalDaySplitStates keys:', Object.keys(finalDaySplitStates).length);

          // SYNC: build filteredDailyIntensity from finalTrainingDays if it came out empty.
          // This covers the common case where program.dailyIntensityData was absent or its
          // dates didn't overlap with validDates (e.g. the plan was saved before step 2).
          if (filteredDailyIntensity.length === 0 && finalTrainingDays.length > 0) {
            filteredDailyIntensity = finalTrainingDays.map((td: any) => ({
              date: td.date,
              intensity: td.intensity,
              mesocycleId: td.mesocycleId,
              microcycleId: td.microcycleId,
            }));
            console.log('[ASSIGN] built filteredDailyIntensity from finalTrainingDays:', filteredDailyIntensity.length);
          }

          // CLAMP: off-intensity days must have 0 sessions.
          // Guard: never zero out a date that was explicitly set to >0 sessions in the
          // program's own daySplitStates — those represent deliberate coach decisions and
          // the dailyIntensityData may be stale (e.g. saved before loading-wave was done).
          const programmedSessionDates = new Set(
            Object.entries(filteredDaySplitStates)
              .filter(([, count]) => (count as number) > 0)
              .map(([date]) => date)
          );
          filteredDailyIntensity.forEach((di: any) => {
            if (di.intensity === '0' && !programmedSessionDates.has(di.date)) {
              finalDaySplitStates[di.date] = 0;
            }
          });
          // Sync finalTrainingDays to match clamped intensity
          finalTrainingDays = finalTrainingDays.map((td: any) => {
            const di = filteredDailyIntensity.find((d: any) => d.date === td.date);
            if (di && di.intensity !== td.intensity) {
              const isOff = di.intensity === '0';
              if (isOff && programmedSessionDates.has(td.date)) return td;
              return {
                ...td,
                intensity: di.intensity,
                sessions: isOff ? 0 : (td.sessions || 1),
                sessionNames: isOff ? [] : (td.sessionNames?.length ? td.sessionNames : ['Session 1']),
                isTrainingDay: !isOff,
              };
            }
            return td;
          });

          // Transfer tests & events to calendarEvents (one entry per scheduled date)
          const transferTestsEvents = async () => {
            try {
              const existingEvents = getEventsForAthlete(athlete.id);
              const existingKey = (type: string, title: string, date: string) =>
                `${type}|${title}|${date}`;
              const existingSet = new Set(
                existingEvents.map(e => existingKey(e.type, e.title, e.date))
              );

              // Collect all events first, then write in a single store update to avoid
              // stale-closure races where sequential addCalendarEvent calls all read the
              // same snapshot and only the last one survives.
              const toAdd: Array<Omit<CalendarEvent, 'id'>> = [];

              (assignment.reviewedSubGoals || []).forEach(sg => {
                sg.scheduledDates.forEach(d => {
                  const date = d.substring(0, 10);
                  if (existingSet.has(existingKey('test', sg.testMethod, date))) return;
                  toAdd.push({
                    type: 'test',
                    title: sg.testMethod,
                    date,
                    parameterId: sg.parameterLinkedId || undefined,
                    targetValue: sg.goalValue ? String(sg.goalValue) : undefined,
                    notes: sg.comments || undefined,
                  });
                });
              });
              (assignment.reviewedEvents || []).forEach(evt => {
                evt.scheduledDates.forEach(d => {
                  const date = d.substring(0, 10);
                  if (existingSet.has(existingKey('event', evt.name, date))) return;
                  toAdd.push({
                    type: 'event',
                    title: evt.name,
                    date,
                    notes: evt.comments || undefined,
                  });
                });
              });

              if (toAdd.length > 0) {
                await addCalendarEvents(athlete.id, toAdd);
              }
            } catch (evtError) {
              console.error('[handleAssignProgram] Error transferring tests/events:', evtError);
            }
          };

          if (mergeIntoExisting) {
            // MERGE PATH: add program sessions into the current active assignment
            console.log('[ASSIGN] merging into existing assignment:', selectedAssignmentId);
            editing.mergeSessionData(
              filteredExercises,
              filteredSections,
              filteredSupersets,
              finalTrainingDays,
              finalDaySplitStates,
              filteredDailyIntensity,
              program.parameterValues || {},
            );
            // Update the assignment's date range so isWithinInterval renders the correct cells
            if (selectedAssignmentId) {
              const existingAssignment = assignments.find(a => a.id === selectedAssignmentId);
              const newStartIso = assignment.startDate;
              const allDates = finalTrainingDays.map((td: any) => td.date).sort();
              const newEndDate = allDates.length > 0
                ? new Date(allDates[allDates.length - 1] + 'T12:00:00').toISOString()
                : assignment.startDate;
              const updatedStart = existingAssignment
                ? (new Date(existingAssignment.startDate) < new Date(newStartIso) ? existingAssignment.startDate : newStartIso)
                : newStartIso;
              const updatedEnd = existingAssignment && existingAssignment.endDate
                ? (new Date(existingAssignment.endDate) > new Date(newEndDate) ? existingAssignment.endDate : newEndDate)
                : newEndDate;
              await athleteData.updateCalendarAssignment(selectedAssignmentId, {
                startDate: updatedStart,
                endDate: updatedEnd,
              });
            }
            // Sync merged data to athlete_schedule
            const mergeConnection = getConnectionForAthlete(athlete.id);
            if (mergeConnection) {
              syncAthleteSchedule(
                mergeConnection.id,
                assignment as AthleteCalendarAssignment,
                finalTrainingDays,
                filteredExercises,
                program.name ?? program.wizardData?.planName ?? 'Training Plan',
              ).catch(e => console.error('[ASSIGN] athlete schedule sync (merge) failed:', e));
            }

            await transferTestsEvents();
          } else if (newAssignment) {
            // CREATE PATH: save to new assignment key and switch to it
            const storageKey = `athlete-assignment-${newAssignment.id}`;
            const dataToSave = {
              exerciseDistribution: filteredExercises,
              sessionSections: filteredSections,
              supersets: filteredSupersets,
              parameterValues: program.parameterValues || {},
              dailyIntensity: filteredDailyIntensity,
              trainingDays: finalTrainingDays,
              daySplitStates: finalDaySplitStates,
              copiedFromProgram: program.id,
              copiedAt: new Date().toISOString(),
            };

            localStorage.setItem(storageKey, JSON.stringify(dataToSave));
            console.log('[ASSIGN] saved to localStorage key:', storageKey, '| daySplitStates keys:', Object.keys(dataToSave.daySplitStates).length, '| trainingDays:', dataToSave.trainingDays.length);

            // Sync to athlete_schedule so the athlete app can read sessions
            const connection = getConnectionForAthlete(athlete.id);
            if (connection) {
              syncAthleteSchedule(
                connection.id,
                newAssignment,
                dataToSave.trainingDays,
                dataToSave.exerciseDistribution,
                program.name ?? program.wizardData?.planName ?? 'Training Plan',
              ).catch(e => console.error('[ASSIGN] athlete schedule sync failed:', e));
            }

            await transferTestsEvents();

            // Update cache immediately
            console.log('[ASSIGN] calling setAssignmentDataCache for:', newAssignment.id);
            setAssignmentDataCache(prev => ({
              ...prev,
              [newAssignment.id]: dataToSave,
            }));

            // Auto-select the new assignment so its editing state loads immediately
            setSelectedAssignmentId(newAssignment.id);
          }
        } catch (shiftError) {
          console.error('[handleAssignProgram] Error shifting dates:', shiftError);
          if (newAssignment) {
            athleteData.deleteCalendarAssignment(newAssignment.id);
          }
          toast({
            title: "Assignment failed",
            description: "An error occurred while processing the program data. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setShowAssignDialog(false);
    setSelectedDate(null);
  }, [athlete.id, athleteData, getProgram, addCalendarEvent, getEventsForAthlete, selectedAssignmentId, editing.mergeSessionData]);

  const handleDeleteAssignment = () => {
    if (deleteAssignment) {
      athleteData.deleteCalendarAssignment(deleteAssignment.id);
      setDeleteAssignment(null);
    }
  };

  const handleDeleteAssignmentById = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment) {
      setDeleteAssignment(assignment);
    }
  };

  const handleViewModeChange = (mode: string) => {
    if (mode) {
      setViewMode(mode as ViewMode);
    }
  };

  const weekDayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const isMasterMode = viewMode === 'master';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          {/* Navigation and Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {/* Left: Title with Calendar Icon */}
            <div className="flex items-center gap-2 min-w-0 shrink">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <span className="text-base font-semibold whitespace-nowrap">Athlete Calendar</span>
              <span className="text-sm text-muted-foreground ml-1 truncate">
                {dateRangeDisplay}
              </span>
            </div>

            {/* Center/Right: Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* View Mode Toggle (Calendar vs Master Planner) */}
              <ToggleGroup type="single" value={isMasterMode ? 'master' : 'calendar'} onValueChange={(v) => {
                if (v === 'master') {
                  setViewMode('master');
                } else if (v === 'calendar') {
                  setViewMode('4week');
                }
              }}>
                <ToggleGroupItem value="calendar" aria-label="Calendar view" className="h-8 px-3 gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="text-xs">Calendar</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="master" aria-label="Master Planner view" className="h-8 px-3 gap-1.5">
                  <Columns className="h-4 w-4" />
                  <span className="text-xs">Master Planner</span>
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Review Plan — visible when selected assignment has ended */}
              {(() => {
                const sel = editing.selectedAssignment;
                if (!sel) return null;
                const ended = parseDateStr(sel.endDate) < new Date();
                if (!ended) return null;
                const hasReview =
                  sel.outcomeRating != null ||
                  sel.outcomeGoalAchievement != null ||
                  sel.outcomeLoadTolerance != null ||
                  (sel.outcomeNotes ?? '').trim().length > 0;
                return (
                  <Button
                    variant={hasReview ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setReviewAssignment(sel)}
                  >
                    <ClipboardList className="h-4 w-4" />
                    {hasReview ? 'Edit Review' : 'Review Plan'}
                  </Button>
                );
              })()}

              {/* Master Planner specific controls */}
              {isMasterMode && (
                <>
                  {/* Weeks-per-view toggle */}
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    {([1, 2, 4] as const).map(w => (
                      <Button
                        key={w}
                        variant={masterWeeksToDisplay === w ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMasterWeeksToDisplay(w)}
                        className="h-7 px-3 text-xs"
                      >
                        {w}W
                      </Button>
                    ))}
                  </div>

                  {/* Day of Week Selector */}
                  <Select 
                    value={selectedDayOfWeek.toString()} 
                    onValueChange={(v) => setSelectedDayOfWeek(parseInt(v))}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue placeholder="Select Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((day, idx) => (
                        <SelectItem key={idx} value={(idx + 1).toString()}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Assignment Selector (if multiple) */}
                  {assignments.length > 1 && (
                    <Select 
                      value={selectedAssignmentId || ''} 
                      onValueChange={setSelectedAssignmentId}
                    >
                      <SelectTrigger className="w-40 h-8">
                        <SelectValue placeholder="Select Program" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignments.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.programName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}

              {/* Calendar view controls */}
              {!isMasterMode && (
                <>
                  {/* Navigation */}
                  <Button variant="outline" size="icon" onClick={handlePrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleToday}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* AI Assistant button */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  setFocusedSessionCtx(undefined);
                  setAiOpenTrigger(prev => prev + 1);
                }}
              >
                <Bot className="h-4 w-4" />
                <span className="text-xs">AI Assistant</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          {isMasterMode ? (
            // Master Planner Grid
            assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <p>No programs assigned yet.</p>
                <p className="text-sm">Assign a program to view the Master Planner.</p>
              </div>
            ) : !editing.selectedAssignment ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Select a program to view
              </div>
            ) : (
              <MasterPlannerGrid
                calendarDays={editing.allAssignmentDays}
                selectedDayOfWeek={selectedDayOfWeek}
                onSessionClick={(dayDate, sessionIndex) => {
                  if (selectedAssignmentId) {
                    setSelectedSessionInfo({
                      dayDate,
                      sessionIndex,
                      assignmentId: selectedAssignmentId,
                    });
                    setSessionSheetOpen(true);
                  }
                }}
                dailyIntensityData={editing.dailyIntensityData}
                parameterValues={editing.parameterValues}
                currentMesocycle={currentMesocycleFromAssignment}
                trainingDays={editing.trainingDays}
                toolboxData={toolboxData}
                weeksToDisplay={masterWeeksToDisplay}
                onWeeksToDisplayChange={setMasterWeeksToDisplay}
                onParameterChange={editing.handleParameterChange}
                sessionSections={editing.sessionSections}
                supersets={editing.supersets}
                onSessionNameChange={editing.handleSessionNameChange}
                onSessionCommentChange={editing.handleSessionCommentChange}
                onSectionCommentChange={editing.handleSectionCommentChange}
                onExerciseNotesChange={editing.handleExerciseNotesChange}
                onExerciseEachSideChange={editing.handleExerciseEachSideChange}
                onExerciseAutoCalcChange={editing.handleExerciseAutoCalcChange}
                onDayIntensityChange={editing.handleDayIntensityChange}
                onSessionIntensityChange={editing.handleSessionIntensityChange}
                onSectionReorder={editing.handleSectionReorder}
                onExerciseReorder={editing.handleExerciseReorder}
                onAddSectionToSession={editing.handleAddSectionToSession}
                onAddExerciseToSection={editing.handleAddExerciseToSection}
                onExerciseDuplicate={editing.handleExerciseDuplicate}
                onExerciseDelete={editing.handleExerciseDelete}
                onToggleSuperset={editing.handleToggleSuperset}
                onSectionDuplicate={editing.handleSectionDuplicate}
                onSectionDelete={editing.handleSectionDelete}
                onCopySession={editing.handleCopySession}
                onDeleteSession={editing.handleDeleteSession}
                onPasteSession={editing.handlePasteSession}
                copiedSession={editing.copiedSession}
                onCopyDay={editing.handleCopyDay}
                onClearDay={handleClearDay}
                onPasteDay={editing.handlePasteDay}
                copiedDay={editing.copiedDay}
                onAddSession={editing.handleAddSession}
                allExerciseDistribution={editing.exerciseDistribution}
                onExerciseChange={editing.handleExerciseChange}
                selectedAthleteId={athlete.id}
                athletePerformanceParameters={athleteData.athletePerformanceParameters.filter(
                  p => p.athleteId === athlete.id
                )}
              />
            )
          ) : (
            // Calendar View
            <div className="min-w-[756px]">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1.5 mb-3">
                {weekDayHeaders.map(day => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Week Rows */}
              <DragDropContext onDragStart={handleSessionDragStart} onDragEnd={handleSessionDragEnd}>
                <div className="space-y-4">
                  {weeks.map((week, idx) => (
                    <AthleteCalendarWeekRow
                      key={`week-${idx}`}
                      week={week}
                      weekIdx={idx}
                      onSessionClick={handleSessionClick}
                      onDayClick={handleDayClick}
                      onAddSession={handleAddSession}
                      onDeleteAssignment={handleDeleteAssignmentById}
                      // Week operations
                      copiedWeek={editing.copiedWeek}
                      onCopyWeek={editing.handleCopyWeek}
                      onClearWeek={handleClearWeek}
                      onPasteWeek={editing.handlePasteWeek}
                      // Day operations
                      copiedDay={editing.copiedDay}
                      onCopyDay={editing.handleCopyDay}
                      onClearDay={handleClearDay}
                      onPasteDay={editing.handlePasteDay}
                      // Session operations
                      copiedSession={editing.copiedSession}
                      onCopySession={editing.handleCopySession}
                      onDeleteSession={editing.handleDeleteSession}
                      onPasteSession={editing.handlePasteSession}
                      // Intensity editing
                      onIntensityChange={editing.handleDayIntensityChange}
                      // Ref-based drag end timestamp for click suppression
                      lastDragEndRef={lastDragEndRef}
                      // Athlete context for baseline auto-fill
                      athleteId={athlete.id}
                      athletePerformanceParameters={athleteData.athletePerformanceParameters.filter(
                        p => p.athleteId === athlete.id
                      )}
                      onAddCalendarEvent={addCalendarEvent}
                      onDeleteCalendarEvent={deleteCalendarEvent}
                    />
                  ))}
                </div>
              </DragDropContext>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Plan Review Dialog */}
      {reviewAssignment && (
        <PlanReviewDialog
          open={!!reviewAssignment}
          onOpenChange={(open) => { if (!open) setReviewAssignment(null); }}
          assignment={reviewAssignment}
          onSave={(updates) => {
            athleteData.updateCalendarAssignment(reviewAssignment.id, updates);
            setReviewAssignment(null);
          }}
        />
      )}

      {/* Assign Program Dialog */}
      <AssignProgramDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        programs={programs}
        selectedDate={selectedDate || new Date()}
        onAssign={handleAssignProgram}
        athleteId={athlete.id}
        athletePerformanceParameters={athleteData.getAthletePerformanceParameters(athlete.id)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAssignment} onOpenChange={() => setDeleteAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteAssignment?.programName}" from the calendar?
              This will not delete the original training program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAssignment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workout Session Sheet for viewing/editing sessions */}
      {selectedSessionInfo && selectedSessionInfo.dayDate && selectedSessionInfo.assignmentId !== undefined && (
        <WorkoutSessionSheet
          isOpen={sessionSheetOpen}
          onClose={() => {
            setSessionSheetOpen(false);
            setSelectedSessionInfo(null);
          }}
          dayDate={selectedSessionInfo.dayDate}
          sessionIndex={selectedSessionInfo.sessionIndex}
          totalSessionsOnDay={editing.daySplitStates[selectedSessionInfo.dayDate] || 1}
          exercises={editing.exerciseDistribution.filter(
            ex => ex.dayDate === selectedSessionInfo.dayDate && ex.sessionIndex === selectedSessionInfo.sessionIndex
          ).map(ex => ({
            ...ex,
            id: ex.id || `${ex.exerciseId}-${ex.dayDate}-${ex.sessionIndex}`,
          }))}
          mesocycleId={(() => {
            // Find the correct mesocycleId from trainingDays for this date
            const trainingDay = editing.trainingDays.find(td => td.date === selectedSessionInfo.dayDate);
            if (trainingDay?.mesocycleId) return trainingDay.mesocycleId;
            // Fallback to first mesocycle
            return editing.selectedAssignment?.assignedMesocycles[0]?.id || '';
          })()}
          microcycleIndex={(() => {
            // Find the correct microcycleIndex from trainingDays for this date
            const trainingDay = editing.trainingDays.find(td => td.date === selectedSessionInfo.dayDate);
            if (trainingDay?.mesocycleId && trainingDay?.microcycleId) {
              const meso = editing.selectedAssignment?.assignedMesocycles?.find(m => m.id === trainingDay.mesocycleId);
              if (meso) {
                const idx = (meso.microcycles || []).findIndex(mic => mic.id === trainingDay.microcycleId);
                if (idx >= 0) return idx;
              }
            }
            return 0;
          })()}
          microcycleDates={(() => {
            // Compute the date range of the microcycle containing this session.
            // WorkoutSessionSheet uses this to calculate the chronological session index
            // (i.e. which occurrence of a method within the microcycle this exercise is),
            // so it can look up the correct periodization-table parameters slot.
            const trainingDay = editing.trainingDays.find(td => td.date === selectedSessionInfo.dayDate);
            if (trainingDay?.mesocycleId && trainingDay?.microcycleId) {
              const meso = editing.selectedAssignment?.assignedMesocycles?.find(m => m.id === trainingDay.mesocycleId);
              if (meso) {
                // Count day-offset of this microcycle within the mesocycle
                let dayOffset = 0;
                let microDuration = 7;
                for (const mc of meso.microcycles || []) {
                  if (mc.id === trainingDay.microcycleId) {
                    microDuration = mc.duration;
                    break;
                  }
                  dayOffset += mc.duration;
                }
                // Build dates using noon-local anchoring to avoid DST off-by-one.
                // meso.startDate may be 'yyyy-MM-dd' or a full ISO string — normalise first.
                const mesoDateStr = meso.startDate.length > 10
                  ? format(parseDateStr(meso.startDate), 'yyyy-MM-dd')
                  : meso.startDate;
                const [my, mm, md] = mesoDateStr.split('-').map(Number);
                const mesoStart = new Date(my, mm - 1, md, 12, 0, 0);
                return Array.from({ length: microDuration }, (_, i) => {
                  const d = new Date(mesoStart.getTime() + (dayOffset + i) * 86400000);
                  return format(d, 'yyyy-MM-dd');
                });
              }
            }
            // Fallback: return all training day dates (covers the whole assignment)
            return editing.trainingDays.map(td => td.date);
          })()}
          parameterValues={editing.parameterValues}
          onSaveParameters={(mesocycleId, microcycleIndex, methodId, sessionIndex, exerciseId, parameters) => {
            // Adapt the WorkoutSessionSheet signature to the editing hook signature
            Object.entries(parameters).forEach(([paramName, value]) => {
              editing.handleParameterChange(
                selectedSessionInfo.dayDate,
                sessionIndex,
                methodId,
                '', // categoryName - not used in this context
                paramName,
                value
              );
            });
          }}
          dailyIntensityData={editing.dailyIntensityData}
          sessionNameFromState={(() => {
            const trainingDay = editing.trainingDays.find(td => td.date === selectedSessionInfo.dayDate);
            return trainingDay?.sessionNames?.[selectedSessionInfo.sessionIndex] || `Session ${selectedSessionInfo.sessionIndex + 1}`;
          })()}
          onRenameSession={editing.handleSessionNameChange}
          onIntensityChange={editing.handleDayIntensityChange}
          onSessionIntensityChange={editing.handleSessionIntensityChange}
          sessionSections={editing.sessionSections}
          supersets={editing.supersets}
          onSectionsChange={(sections) => editing.setSessionSections(sections)}
          onSupersetsChange={(s) => editing.setSupersets(s)}
          toolboxData={toolboxData}
          allExerciseDistribution={editing.exerciseDistribution.map(ex => ({
            ...ex,
            id: ex.id || `${ex.exerciseId}-${ex.dayDate}-${ex.sessionIndex}`,
          }))}
          onDistributionChange={(distribution) => {
            editing.setExerciseDistribution(distribution as any);
          }}
          useExternalIntensityOnly={true}
          isAdHocSession={true}
          onOpenAIAssistant={(ctx: FocusedSessionContext) => {
            setFocusedSessionCtx(ctx);
            setAiOpenTrigger(prev => prev + 1);
          }}
        />
      )}

      {/* AI Assistant — athlete calendar context */}
      <WizardAIAssistant
        stepLabel="Athlete Calendar"
        wizardContext={athleteAIContext}
        globalContext={globalAIContext}
        ragContext={ragContext || undefined}
        coachMemoryContext={coachMemoryContext || undefined}
        focusedSessionContext={focusedSessionCtx}
        forceOpen={aiOpenTrigger}
        assistantRole={`You are reviewing the training calendar and current status for athlete "${athlete.firstName ?? ''} ${athlete.lastName ?? ''}".
Help the coach with: training load management, session design, exercise selection, intensity progression, upcoming test preparation, program structure analysis, and any sports science questions related to this athlete's training.
You can also help with database management (parameters, exercises, toolbox) and program planning.
When the coach opens the AI from within a session card, the "Currently Viewing" section above shows the exact session — use that context to give session-specific advice.`}
        onApplySuggestion={handleAIApply}
      />
    </div>
  );
}
