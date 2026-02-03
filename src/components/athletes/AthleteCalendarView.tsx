import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameMonth, isWithinInterval, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Trash2, Calendar, LayoutGrid, Columns } from 'lucide-react';
import { Athlete, AthleteCalendarAssignment } from '@/types/athlete';
import { AssignProgramDialog } from './AssignProgramDialog';
import { useTrainingPrograms, TrainingProgram } from '@/hooks/useTrainingPrograms';
import { useAthletes } from '@/hooks/useAthletes';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useAthleteCalendarEditing } from '@/hooks/useAthleteCalendarEditing';
import {
  shiftExerciseDates,
  shiftDailyIntensityDates,
  shiftSessionSectionDates,
  shiftSupersetDates,
  shiftTrainingDaysDates,
  shiftDaySplitStatesDates,
} from '@/utils/dateShifting';
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
import { IntensityLevel } from '@/types/training';
import { cn } from '@/lib/utils';

interface AthleteCalendarViewProps {
  athlete: Athlete;
}

type ViewMode = '1week' | '2week' | '4week' | 'master';

// Intensity color helper matching the training calendar
const getIntensityColor = (intensity: IntensityLevel | string): string => {
  const colors: Record<string, string> = {
    "off": "bg-[hsl(var(--intensity-off))] text-black border-2",
    "deload": "bg-[hsl(var(--intensity-deload))] text-white",
    "easy": "bg-[hsl(var(--intensity-easy))] text-white", 
    "easy-moderate": "bg-[hsl(var(--intensity-easy-moderate))] text-white",
    "moderate": "bg-[hsl(var(--intensity-moderate))] text-black",
    "moderate-hard": "bg-[hsl(var(--intensity-moderate-hard))] text-white",
    "hard": "bg-[hsl(var(--intensity-hard))] text-white",
    "extremely-hard": "bg-[hsl(var(--intensity-extremely-hard))] text-white"
  };
  return colors[intensity] || "bg-muted text-muted-foreground";
};

const intensityLevels: IntensityLevel[] = ["off", "deload", "easy", "easy-moderate", "moderate", "moderate-hard", "hard", "extremely-hard"];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function AthleteCalendarView({ athlete }: AthleteCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('4week');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteAssignment, setDeleteAssignment] = useState<AthleteCalendarAssignment | null>(null);
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [selectedSessionInfo, setSelectedSessionInfo] = useState<{
    dayDate: string;
    sessionIndex: number;
    assignmentId: string;
  } | null>(null);
  
  // Master planner state
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1); // 1=Monday
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const { programs, getProgram } = useTrainingPrograms();
  const athleteData = useAthletes();
  const { data: toolboxData } = useToolboxData();

  const assignments = useMemo(() => {
    return athleteData.getAthleteCalendarAssignments(athlete.id);
  }, [athleteData, athlete.id]);
  
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
      
      const storageKey = `athlete-assignment-${assignment.id}`;
      try {
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
          cache[assignment.id] = JSON.parse(savedData);
          hasNewData = true;
        }
      } catch (e) {
        // Ignore parse errors
      }
    });
    
    // Only update if we found new data
    if (hasNewData || Object.keys(cache).length !== Object.keys(assignmentDataCache).length) {
      setAssignmentDataCache(cache);
    }
  }, [assignments]); // intentionally exclude assignmentDataCache to prevent infinite loop

  // Initialize selected assignment when assignments change
  useEffect(() => {
    if (assignments.length > 0 && !selectedAssignmentId) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  // Use the editing hook for master planner functionality
  const editing = useAthleteCalendarEditing(selectedAssignmentId, assignments);

  // Build mesocycle from assignment for MasterPlannerGrid
  const currentMesocycleFromAssignment = useMemo(() => {
    if (!editing.selectedAssignment) return undefined;
    
    const meso = editing.selectedAssignment.assignedMesocycles[0];
    if (!meso) return undefined;
    
    return {
      id: meso.id,
      name: meso.name,
      weeks: meso.weeks,
      sessionsPerWeek: meso.sessionsPerWeek,
      sessionLength: meso.sessionLength,
      startDate: new Date(meso.startDate),
      endDate: new Date(meso.endDate),
      duration: meso.duration,
      intensity: meso.intensity as any,
      microcycles: meso.microcycles.map(m => ({
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

  // Calculate calendar days based on view mode (for calendar view)
  // IMPORTANT: For the currently selected assignment, read from live editing state
  // to ensure immediate visual feedback after paste/copy operations
  const calendarDays = useMemo((): AthleteCalendarDay[] => {
    if (viewMode === 'master') return [];
    
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    let end: Date;

    switch (viewMode) {
      case '1week':
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
        break;
      case '2week':
        end = endOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
        break;
      case '4week':
      default:
        end = endOfWeek(addWeeks(currentDate, 3), { weekStartsOn: 1 });
        break;
    }

    const days = eachDayOfInterval({ start, end });

    return days.map(date => {
      const dateString = format(date, 'yyyy-MM-dd');

      // Extract session data for this specific day
      const sessions: AthleteCalendarSession[] = [];
      let testNames: string[] = [];
      let eventNames: string[] = [];
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
        
        // FIX: Proper check for live data - don't use isTrainingDay alone since cleared days still exist
        // A day has live content if: exercises exist OR splitState > 0 OR has tests/events
        const hasLiveExercises = liveExercises.length > 0;
        const hasLiveSessions = liveSplitState !== undefined && liveSplitState > 0;
        const hasTestsOrEvents = (liveTrainingDay?.testNames?.length ?? 0) > 0 || (liveTrainingDay?.eventNames?.length ?? 0) > 0;
        const hasLiveData = hasLiveExercises || hasLiveSessions || hasTestsOrEvents;
        
        if (hasLiveData) {
          usedLiveEditingState = true;
          const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);
          assignmentId = selectedAssignmentId;
          programName = selectedAssignment?.programName;
          
          // Get day intensity from live dailyIntensity data, fall back to trainingDays intensity
          let dayIntensity: IntensityLevel = liveTrainingDay?.intensity || 'moderate';
          const liveDayIntensity = editing.dailyIntensityData.find(
            (d: any) => d.date === dateString
          );
          if (liveDayIntensity?.intensity) {
            dayIntensity = liveDayIntensity.intensity as IntensityLevel;
          }
          
          // Collect test/event names from live data
          if (liveTrainingDay?.testNames?.length > 0) {
            testNames = [...testNames, ...liveTrainingDay.testNames];
          }
          if (liveTrainingDay?.eventNames?.length > 0) {
            eventNames = [...eventNames, ...liveTrainingDay.eventNames];
          }
          
          // FIX: Use actual splitState value - 0 means no sessions (cleared day)
          // Only render sessions if we have exercises OR splitState > 0
          const numSessions = liveSplitState ?? 0;
          if (numSessions > 0 || hasLiveExercises) {
            const sessionCount = numSessions > 0 ? numSessions : 1;
            for (let sessionIdx = 0; sessionIdx < sessionCount; sessionIdx++) {
              const sessionId = `${selectedAssignmentId}-${dateString}-${sessionIdx}`;
              const sessionName = liveTrainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`;
              const exerciseCount = liveExercises.filter(
                (ex: any) => ex.sessionIndex === sessionIdx
              ).length;
              
              sessions.push({
                id: sessionId,
                sessionIndex: sessionIdx,
                sessionName,
                exerciseCount,
                intensity: dayIntensity,
                assignmentId: selectedAssignmentId,
              });
            }
          }
        }
      }

      // If not using live editing state, fall back to assignment range filtering
      if (!usedLiveEditingState) {
        // Find assignments that overlap with this date
        const dayAssignments = assignments.filter(assignment => {
          const assignmentStart = new Date(assignment.startDate);
          const assignmentEnd = new Date(assignment.endDate);
          return isWithinInterval(date, { start: assignmentStart, end: assignmentEnd });
        });

        dayAssignments.forEach(assignment => {
          assignmentId = assignment.id;
          programName = assignment.programName;

          // For the selected assignment being edited, use LIVE editing state
          const isEditingAssignment = assignment.id === selectedAssignmentId;
          
          if (isEditingAssignment) {
            // Use live editing state for immediate updates
            const liveExercises = editing.exerciseDistribution.filter(
              (ex: any) => ex.dayDate === dateString
            );
            const liveSplitState = editing.daySplitStates[dateString];
            const liveTrainingDay = editing.trainingDays.find((td: any) => td.date === dateString);
            
            // Get day intensity from live dailyIntensity data, fall back to trainingDays intensity
            let dayIntensity: IntensityLevel = liveTrainingDay?.intensity || 'moderate';
            const liveDayIntensity = editing.dailyIntensityData.find(
              (d: any) => d.date === dateString
            );
            if (liveDayIntensity?.intensity) {
              dayIntensity = liveDayIntensity.intensity as IntensityLevel;
            }
            
            // Collect test/event names from live data
            if (liveTrainingDay?.testNames?.length > 0) {
              testNames = [...testNames, ...liveTrainingDay.testNames];
            }
            if (liveTrainingDay?.eventNames?.length > 0) {
              eventNames = [...eventNames, ...liveTrainingDay.eventNames];
            }
            
            // FIX: Proper check for training day - exercises OR splitState > 0
            const hasExercises = liveExercises.length > 0;
            const numSessions = liveSplitState ?? 0;
            const isTrainingDay = hasExercises || numSessions > 0;
            
            if (isTrainingDay) {
              const sessionCount = numSessions > 0 ? numSessions : 1;
              for (let sessionIdx = 0; sessionIdx < sessionCount; sessionIdx++) {
                const sessionId = `${assignment.id}-${dateString}-${sessionIdx}`;
                const sessionName = liveTrainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`;
                const exerciseCount = liveExercises.filter(
                  (ex: any) => ex.sessionIndex === sessionIdx
                ).length;
                
                sessions.push({
                  id: sessionId,
                  sessionIndex: sessionIdx,
                  sessionName,
                  exerciseCount,
                  intensity: dayIntensity,
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
            
            if (trainingDay?.testNames?.length > 0) {
              testNames = [...testNames, ...trainingDay.testNames];
            }
            if (trainingDay?.eventNames?.length > 0) {
              eventNames = [...eventNames, ...trainingDay.eventNames];
            }
            
            const hasExercises = cachedData?.exerciseDistribution?.some((ex: any) => ex.dayDate === dateString);
            const isTrainingDay = hasExercises || trainingDay?.isTrainingDay;
            
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

      return {
        date,
        dateString,
        isCurrentMonth: isSameMonth(date, currentDate),
        sessions,
        testNames: testNames.length > 0 ? testNames : undefined,
        eventNames: eventNames.length > 0 ? eventNames : undefined,
        assignmentId,
        programName,
      };
    });
  }, [currentDate, viewMode, assignments, assignmentDataCache, selectedAssignmentId, editing.exerciseDistribution, editing.daySplitStates, editing.trainingDays, editing.dailyIntensityData]);

  // Group days into weeks
  const weeks = useMemo(() => {
    const result: AthleteCalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // Calculate date range display
  const dateRangeDisplay = useMemo(() => {
    if (viewMode === 'master' && editing.selectedAssignment) {
      return `${format(new Date(editing.selectedAssignment.startDate), 'MMM d')} - ${format(new Date(editing.selectedAssignment.endDate), 'MMM d, yyyy')}`;
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
    console.log('[handleSessionClick] Clicked:', { dayDate, sessionIndex, assignmentId });
    
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

  const handleAssignProgram = useCallback((assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>) => {
    // Create the assignment and get the new ID
    const newAssignment = athleteData.createCalendarAssignment(athlete.id, assignment);
    
    // Copy program workout data with shifted dates
    if (newAssignment && assignment.programId) {
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
        console.log('[handleAssignProgram] Program found:', {
          id: program.id,
          name: program.name,
          exerciseCount: program.exerciseDistribution?.length || 0,
          hasSessionSections: !!program.sessionSections,
          hasDailyIntensity: !!program.dailyIntensityData?.length,
        });
        
        // Compute a robust originalStartDate from the earliest valid date in program data
        // Order of precedence: trainingDays > exerciseDistribution > dailyIntensityData > duration.startDate
        let originalStartDate: Date | null = null;
        
        // Try trainingDays first
        if (program.trainingDays && Array.isArray(program.trainingDays) && program.trainingDays.length > 0) {
          const validDates = program.trainingDays
            .map((d: any) => new Date(d.date))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (validDates.length > 0) {
            originalStartDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          }
        }
        
        // Try exerciseDistribution
        if (!originalStartDate && program.exerciseDistribution && program.exerciseDistribution.length > 0) {
          const validDates = program.exerciseDistribution
            .map((ex: any) => new Date(ex.dayDate))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (validDates.length > 0) {
            originalStartDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          }
        }
        
        // Try dailyIntensityData
        if (!originalStartDate && program.dailyIntensityData && program.dailyIntensityData.length > 0) {
          const validDates = program.dailyIntensityData
            .map((di: any) => new Date(di.date))
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
          // Cleanup the created assignment - silently fail and remove broken assignment
          athleteData.deleteCalendarAssignment(newAssignment.id);
          return;
        }
        
        // Normalize both dates to UTC midnight for accurate day-based shifting
        // This prevents timezone-related off-by-one errors
        const normalizedOriginalStart = new Date(Date.UTC(
          originalStartDate.getFullYear(),
          originalStartDate.getMonth(),
          originalStartDate.getDate()
        ));
        
        const assignmentDate = new Date(assignment.startDate);
        const normalizedNewStart = new Date(Date.UTC(
          assignmentDate.getFullYear(),
          assignmentDate.getMonth(),
          assignmentDate.getDate()
        ));
        
        try {
          // Shift all program data to match the new start date using normalized dates
          const shiftedExercises = program.exerciseDistribution 
            ? shiftExerciseDates(program.exerciseDistribution, normalizedOriginalStart, normalizedNewStart)
            : [];
            
          const shiftedDailyIntensity = program.dailyIntensityData
            ? shiftDailyIntensityDates(program.dailyIntensityData, normalizedOriginalStart, normalizedNewStart)
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
            
          const shiftedDaySplitStates = program.daySplitStates
            ? shiftDaySplitStatesDates(program.daySplitStates, normalizedOriginalStart, normalizedNewStart)
            : {};
          
          // Save shifted data to localStorage
          const storageKey = `athlete-assignment-${newAssignment.id}`;
          const dataToSave = {
            exerciseDistribution: shiftedExercises,
            sessionSections: shiftedSections,
            supersets: shiftedSupersets,
            parameterValues: program.parameterValues || {},
            dailyIntensity: shiftedDailyIntensity,
            trainingDays: shiftedTrainingDays,
            daySplitStates: shiftedDaySplitStates,
            copiedFromProgram: program.id,
            copiedAt: new Date().toISOString(),
          };
          
          console.log('[handleAssignProgram] Saving assignment data:', {
            storageKey,
            exerciseCount: shiftedExercises.length,
            sectionsCount: Array.isArray(shiftedSections) ? shiftedSections.length : Object.keys(shiftedSections).length,
            dailyIntensityCount: shiftedDailyIntensity.length,
            originalStartDate: normalizedOriginalStart.toISOString(),
            newStartDate: normalizedNewStart.toISOString(),
            dayOffset: Math.round((normalizedNewStart.getTime() - normalizedOriginalStart.getTime()) / (1000 * 60 * 60 * 24)),
          });
          
          localStorage.setItem(storageKey, JSON.stringify(dataToSave));
          
          // Update cache immediately
          setAssignmentDataCache(prev => ({
            ...prev,
            [newAssignment.id]: dataToSave,
          }));
        } catch (shiftError) {
          console.error('[handleAssignProgram] Error shifting dates:', shiftError);
          // Cleanup the created assignment on error
          athleteData.deleteCalendarAssignment(newAssignment.id);
          return;
        }
      } else {
        console.warn('[handleAssignProgram] Program not found:', assignment.programId);
      }
    }
    
    setShowAssignDialog(false);
    setSelectedDate(null);
  }, [athlete.id, athleteData, getProgram]);

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
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title with Calendar Icon */}
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-base font-semibold">Athlete Calendar</span>
              <span className="text-sm text-muted-foreground ml-2">
                {dateRangeDisplay}
              </span>
            </div>

            {/* Center/Right: Controls */}
            <div className="flex items-center gap-3">
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

              {/* Master Planner specific controls */}
              {isMasterMode && (
                <>
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
                  {/* View Mode Selector */}
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    {(['1week', '2week', '4week'] as const).map((mode) => (
                      <Button
                        key={mode}
                        variant={viewMode === mode ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode(mode)}
                        className="h-7 px-3 text-xs"
                      >
                        {mode === '1week' ? '1W' : mode === '2week' ? '2W' : '4W'}
                      </Button>
                    ))}
                  </div>

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
            </div>
          </div>
        </CardHeader>

        <CardContent>
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
                getIntensityColor={getIntensityColor}
                dailyIntensityData={editing.dailyIntensityData}
                parameterValues={editing.parameterValues}
                currentMesocycle={currentMesocycleFromAssignment}
                trainingDays={editing.trainingDays}
                toolboxData={toolboxData}
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
                intensityLevels={intensityLevels}
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
                onClearDay={editing.handleClearDay}
                onPasteDay={editing.handlePasteDay}
                copiedDay={editing.copiedDay}
                onAddSession={editing.handleAddSession}
                allExerciseDistribution={editing.exerciseDistribution}
                onExerciseChange={editing.handleExerciseChange}
              />
            )
          ) : (
            // Calendar View
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 mb-4">
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
              <div className="space-y-6">
                {weeks.map((week, idx) => (
                  <AthleteCalendarWeekRow
                    key={`week-${idx}`}
                    week={week}
                    weekIdx={idx}
                    onSessionClick={handleSessionClick}
                    onDayClick={handleDayClick}
                    onAddSession={handleAddSession}
                    onDeleteAssignment={handleDeleteAssignmentById}
                    getIntensityColor={getIntensityColor}
                    // Week operations
                    copiedWeek={editing.copiedWeek}
                    onCopyWeek={editing.handleCopyWeek}
                    onClearWeek={editing.handleClearWeek}
                    onPasteWeek={editing.handlePasteWeek}
                    // Day operations
                    copiedDay={editing.copiedDay}
                    onCopyDay={editing.handleCopyDay}
                    onClearDay={editing.handleClearDay}
                    onPasteDay={editing.handlePasteDay}
                    // Session operations
                    copiedSession={editing.copiedSession}
                    onCopySession={editing.handleCopySession}
                    onDeleteSession={editing.handleDeleteSession}
                    onPasteSession={editing.handlePasteSession}
                    // Test/Event operations
                    onAddTestEvent={editing.handleAddTestEvent}
                    onDeleteTestEvent={editing.handleDeleteTestEvent}
                    availableTests={[]}
                    availableEvents={[]}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>


      {/* Assign Program Dialog */}
      <AssignProgramDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        programs={programs}
        selectedDate={selectedDate || new Date()}
        onAssign={handleAssignProgram}
        athleteId={athlete.id}
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
      {selectedSessionInfo && selectedSessionInfo.dayDate && selectedSessionInfo.assignmentId && (
        <WorkoutSessionSheet
          isOpen={sessionSheetOpen}
          onClose={() => {
            setSessionSheetOpen(false);
            setSelectedSessionInfo(null);
          }}
          dayDate={selectedSessionInfo.dayDate}
          sessionIndex={selectedSessionInfo.sessionIndex}
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
              const meso = editing.selectedAssignment?.assignedMesocycles.find(m => m.id === trainingDay.mesocycleId);
              if (meso) {
                const idx = meso.microcycles.findIndex(mic => mic.id === trainingDay.microcycleId);
                if (idx >= 0) return idx;
              }
            }
            return 0;
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
          onIntensityChange={editing.handleDayIntensityChange}
          onSessionIntensityChange={editing.handleSessionIntensityChange}
          getIntensityColor={getIntensityColor}
          intensityLevels={intensityLevels}
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
        />
      )}
    </div>
  );
}
