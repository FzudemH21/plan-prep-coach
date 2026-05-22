import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, Columns } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameMonth, parseISO, isSameDay, addDays, differenceInDays } from 'date-fns';
import { useCalendarGrid, groupDaysIntoWeeks } from '@/hooks/useCalendarGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MasterPlannerGrid } from './MasterPlannerGrid';
import { cn } from '@/lib/utils';
import { TrainingDay } from '@/types/daily-intensity';
import { ExtendedMesocycle } from '@/features/planner/types';
import { IntensityLevel } from '@/types/training';
import { TrainingDayCell } from './TrainingDayCell';
import { WeekRow } from './WeekRow';
import { WorkoutSessionSheet } from './WorkoutSessionSheet';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useToolboxData } from '@/hooks/useToolboxData';
import { ExerciseDistribution as CanonicalExerciseDistribution, SessionSection, SupersetMapping, ExerciseSelection } from '@/types/microcycle-planning';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { MethodSelectionDialog } from './MethodSelectionDialog';
import { ExerciseDetailDialog } from '@/components/shared/ExerciseDetailDialog';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import { toggleSuperset, cleanupSupersetsOnExerciseDelete } from '@/utils/supersetUtils';
import { AthletePerformanceParameter } from '@/types/athlete';
import { FocusedSessionContext } from '@/components/wizard/WizardAIAssistant';

// Local interface for internal use - compatible with WeekRow, TrainingDayCell etc.
interface ExerciseDistribution {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
  order?: number;
  sectionId?: string;
  supersetId?: string;
  notes?: string;
  eachSide?: boolean;
}

interface TrainingCalendarViewProps {
  exerciseDistribution: ExerciseDistribution[];
  trainingDays: TrainingDay[];
  currentMesocycle: ExtendedMesocycle;
  mesocycles: ExtendedMesocycle[];
  onSessionDragEnd?: (result: DropResult) => void;
  onDeleteSession?: (dayDate: string, sessionIndex: number) => void;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  copiedSession?: { exercises: ExerciseDistribution[]; sections?: any[]; sourceDate: string; sessionIndex: number } | null;
  onCopyWeek?: (weekStartDate: string) => void;
  onClearWeek?: (weekStartDate: string) => void;
  onPasteWeek?: (weekStartDate: string) => void;
  copiedWeek?: { exercises: ExerciseDistribution[]; weekStartDate: string } | null;
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event', testEventId: string, testEventName: string, isNew: boolean, comments?: string) => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event', name: string) => void;
  copiedDay?: { exercises: ExerciseDistribution[]; sourceDate: string; intensity?: IntensityLevel; testNames?: string[]; eventNames?: string[]; splitState?: number } | null;
  availableTests?: any[];
  availableEvents?: any[];
  dailyIntensityData?: any[];
  onIntensityChange?: (date: string, intensity: IntensityLevel) => void;
  onSessionIntensityChange?: (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => void;
  getIntensityColor?: (intensity: IntensityLevel) => string;
  intensityLevels?: IntensityLevel[];
  parameterValues?: Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>;
  onSaveParameters?: (
    mesocycleId: string,
    microcycleIndex: number,
    methodId: string,
    sessionIndex: number,
    exerciseId: string,
    parameters: Record<string, string | number>
  ) => void;
  onUpdateTestComment?: (testId: string, comments: string) => void;
  onUpdateTestValues?: (testId: string, updates: { preTestValue?: number; goalValue?: number; comments?: string }) => void;
  onUpdateEventComment?: (eventId: string, comments: string) => void;
  copiedSection?: { exercises: ExerciseDistribution[]; sections: any[]; sourceSectionId: string; sourceDayDate: string; sourceSessionIndex: number } | null;
  onCopySection?: (sectionId: string) => void;
  onPasteSection?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionUp?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionDown?: (dayDate: string, sessionIndex: number) => void;
  onRenameSession?: (dayDate: string, sessionIndex: number, newName: string) => void;
  // Props for sections and supersets from Step 1
  sessionSections?: SessionSection[];
  supersets?: SupersetMapping;
  onSectionsChange?: (sections: SessionSection[]) => void;
  onSupersetsChange?: (supersets: SupersetMapping) => void;
  // Sync exercise distribution changes back to Step 1
  onDistributionChange?: (distribution: ExerciseDistribution[]) => void;
  // Add session functionality
  onAddSession?: (dayDate: string) => void;
  // Day split states for creating empty sessions
  daySplitStates?: Record<string, number>;
  // Athlete context for baseline value auto-fill
  selectedAthleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
  // Callback to open the AI assistant from within the session dialog
  onOpenAIAssistant?: (ctx: FocusedSessionContext) => void;
  // Increment to force a full rebuild of exercise parameters from updated parameterValues
  forceParamRefresh?: number;
}

export interface CalendarDay {
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

type ViewMode = '1week' | '2week' | '4week' | 'master';

export function TrainingCalendarView({
  exerciseDistribution,
  trainingDays,
  currentMesocycle,
  mesocycles,
  onSessionDragEnd,
  onDeleteSession,
  onCopySession,
  onPasteSession,
  copiedSession,
  onCopyWeek,
  onClearWeek,
  onPasteWeek,
  copiedWeek,
  onCopyDay,
  onClearDay,
  onAddTestEvent,
  onDeleteTestEvent,
  copiedDay,
  availableTests,
  availableEvents,
  dailyIntensityData,
  onIntensityChange,
  onSessionIntensityChange,
  getIntensityColor,
  intensityLevels,
  parameterValues = {},
  onSaveParameters,
  onUpdateTestComment,
  onUpdateTestValues,
  onUpdateEventComment,
  copiedSection,
  onCopySection,
  onPasteSection,
  onMoveSessionUp,
  onMoveSessionDown,
  onRenameSession,
  sessionSections,
  supersets,
  onSectionsChange,
  onSupersetsChange,
  onDistributionChange,
  onAddSession,
  daySplitStates,
  selectedAthleteId,
  athletePerformanceParameters,
  onOpenAIAssistant,
  forceParamRefresh,
}: TrainingCalendarViewProps) {
  const { toast } = useToast();
  const { data: toolboxData } = useToolboxData();
  const { libraries, updateExerciseInLibrary } = useCustomLibraries();
  const [viewMode, setViewMode] = useState<ViewMode>('4week');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1); // 1=Monday
  const [masterWeeksToDisplay, setMasterWeeksToDisplay] = useState(4);
  const [currentDate, setCurrentDate] = useState<Date>(currentMesocycle.startDate);
  const [selectedSession, setSelectedSession] = useState<{
    dayDate: string;
    sessionIndex: number;
    exercises: ExerciseDistribution[];
    totalSessions: number;
  } | null>(null);
  const [sessionDataVersion, setSessionDataVersion] = useState(0);
  // Track which mesocycle is being viewed in Master Planner mode
  const [viewedMesocycleId, setViewedMesocycleId] = useState<string>(currentMesocycle.id);
  const dayOfWeekNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // State for adding exercises from Master Planner
  const [isLibraryPopupOpen, setIsLibraryPopupOpen] = useState(false);
  const [isMethodSelectionOpen, setIsMethodSelectionOpen] = useState(false);
  const [selectedExercisesForMethod, setSelectedExercisesForMethod] = useState<ExerciseSelection[]>([]);
  const [addExerciseContext, setAddExerciseContext] = useState<{
    dayDate: string;
    sessionIndex: number;
    sectionId: string;
  } | null>(null);

  // State for exercise detail dialog (Master Planner)
  const [detailExercise, setDetailExercise] = useState<ExerciseDistribution | null>(null);

  // Exercise detail dialog handlers for Master Planner
  const handleOpenExerciseDetail = (exercise: ExerciseDistribution) => {
    setDetailExercise(exercise);
  };

  const handleSaveExerciseToLibrary = (updatedData: {
    name: string;
    videoUrl: string;
    description: string;
    data: Record<string, any>;
  }) => {
    if (!detailExercise) return;
    
    // Find which library contains this exercise
    for (const lib of libraries) {
      const exercise = lib.exercises.find(e => e.id === detailExercise.exerciseId);
      if (exercise) {
        // Find the name column (usually the first column)
        const nameColumn = lib.columns.find(c => c.name.toLowerCase() === 'name' || c.name.toLowerCase() === 'exercise name') || lib.columns[0];
        
        updateExerciseInLibrary(lib.id, detailExercise.exerciseId, {
          videoUrl: updatedData.videoUrl || undefined,
          description: updatedData.description || undefined,
          data: {
            ...updatedData.data,
            ...(nameColumn ? { [nameColumn.id]: updatedData.name } : {})
          }
        });
        toast({
          title: "Exercise updated",
          description: `${updatedData.name} has been updated in the library`,
        });
        break;
      }
    }
    // Dialog handles its own close/view-mode transition
  };

  // Get the currently viewed mesocycle (for Master Planner view)
  const viewedMesocycle = useMemo(() => {
    return mesocycles.find(m => m.id === viewedMesocycleId) || currentMesocycle;
  }, [mesocycles, viewedMesocycleId, currentMesocycle]);

  // Helper function to get microcycle index from date
  const getMicrocycleIndex = (dayDate: string): number => {
    // Find the training day for this date
    const trainingDay = trainingDays.find(td => td.date === dayDate);
    
    if (!trainingDay) {
      return 0;
    }

    // Find the index of this microcycle within the current mesocycle
    const microcycleIndex = currentMesocycle.microcycles.findIndex(
      mc => mc.id === trainingDay.microcycleId
    );

    if (microcycleIndex === -1) {
      return 0;
    }

    return microcycleIndex;
  };

  // Group exercises by date
  const exercisesByDate = useMemo(() => {
    const grouped: Record<string, ExerciseDistribution[]> = {};
    exerciseDistribution.forEach(ex => {
      if (!grouped[ex.dayDate]) {
        grouped[ex.dayDate] = [];
      }
      grouped[ex.dayDate].push(ex);
    });
    return grouped;
  }, [exerciseDistribution]);

  // Shared calendar grid date range calculation
  const { dateRange: calendarDateRange } = useCalendarGrid(currentDate, viewMode);

  // Calculate calendar days based on view mode
  const calendarDays = useMemo(() => {
    const days = calendarDateRange;

    return days.map(date => {
      const dateString = format(date, 'yyyy-MM-dd');
      const exercises = exercisesByDate[dateString] || [];
      const trainingDay = trainingDays.find(td => td.date === dateString);

      // Group exercises by session
      const sessionMap: Record<number, ExerciseDistribution[]> = {};
      exercises.forEach(ex => {
        if (!sessionMap[ex.sessionIndex]) {
          sessionMap[ex.sessionIndex] = [];
        }
        sessionMap[ex.sessionIndex].push(ex);
      });

      // Also create empty sessions from daySplitStates
      const sessionCount = daySplitStates?.[dateString] ?? 0;
      for (let i = 0; i < sessionCount; i++) {
        if (!sessionMap[i]) {
          sessionMap[i] = [];
        }
      }

      const sessions = Object.entries(sessionMap)
        .map(([idx, exs]) => {
          // Generate stable ID from sorted exercise IDs
          const ids = exs
            .map(e => (e as any).id ?? `${e.exerciseId}-${e.methodId ?? ''}`)
            .sort()
            .join('|');
          const sessionId = `${dateString}__${ids || `empty-${idx}`}`;
          
          // Get custom session name from trainingDay.sessionNames (synced with Step 1)
          let sessionName = trainingDay?.sessionNames?.[parseInt(idx)] || `Session ${parseInt(idx) + 1}`;
          
          // Load session intensity from localStorage
          const intensityKey = `sessionIntensity_${currentMesocycle.id}_${dateString}_${idx}`;
          const storedIntensity = localStorage.getItem(intensityKey);
          const dayIntensity = trainingDay ? (dailyIntensityData?.find(di => di.date === dateString)?.intensity || 'moderate') : 'moderate';
          const sessionIntensity = storedIntensity || dayIntensity;
          
          return {
            id: sessionId,
            sessionIndex: parseInt(idx),
            sessionName,
            exercises: exs,
            methods: [...new Set(exs.map(e => e.methodId))],
            sessionIntensity: sessionIntensity as IntensityLevel,
          };
        })
        .sort((a, b) => a.sessionIndex - b.sessionIndex);

      return {
        date,
        dateString,
        // Days that belong to the training plan (have a trainingDay) are always
        // rendered at full opacity, regardless of which calendar month is shown.
        isCurrentMonth: isSameMonth(date, currentDate) || !!trainingDays.find(td => td.date === dateString),
        trainingDay,
        sessions,
        totalExercises: exercises.length,
      };
    });
  }, [calendarDateRange, currentDate, exercisesByDate, trainingDays, sessionDataVersion, daySplitStates]);

  // Group days into weeks
  const weeks = useMemo(() => groupDaysIntoWeeks(calendarDays), [calendarDays]);

  // Calculate all days across ALL mesocycles for Master Planner view
  // (mirrors AthleteCalendarView which spans the full assignment, not just one mesocycle)
  const allMesocycleDays = useMemo((): CalendarDay[] => {
    if (viewMode !== 'master') return [];

    const allMesos = mesocycles.length > 0 ? mesocycles : [viewedMesocycle];
    const toDate = (d: Date | string) => d instanceof Date ? d : new Date(d);
    const start = allMesos.reduce((earliest, m) => {
      const s = toDate(m.startDate);
      return s < earliest ? s : earliest;
    }, toDate(allMesos[0].startDate));
    const end = allMesos.reduce((latest, m) => {
      const e = toDate(m.endDate);
      return e > latest ? e : latest;
    }, toDate(allMesos[0].endDate));
    const days = eachDayOfInterval({ start, end });

    return days.map(date => {
      const dateString = format(date, 'yyyy-MM-dd');
      const exercises = exercisesByDate[dateString] || [];
      const trainingDay = trainingDays.find(td => td.date === dateString);

      // Group exercises by session
      const sessionMap: Record<number, ExerciseDistribution[]> = {};
      exercises.forEach(ex => {
        if (!sessionMap[ex.sessionIndex]) {
          sessionMap[ex.sessionIndex] = [];
        }
        sessionMap[ex.sessionIndex].push(ex);
      });

      // Also create empty sessions from daySplitStates
      const sessionCount = daySplitStates?.[dateString] ?? 0;
      for (let i = 0; i < sessionCount; i++) {
        if (!sessionMap[i]) {
          sessionMap[i] = [];
        }
      }

      const sessions = Object.entries(sessionMap)
        .map(([idx, exs]) => {
          const ids = exs
            .map(e => (e as any).id ?? `${e.exerciseId}-${e.methodId ?? ''}`)
            .sort()
            .join('|');
          const sessionId = `${dateString}__${ids || `empty-${idx}`}`;
          
          let sessionName = trainingDay?.sessionNames?.[parseInt(idx)] || `Session ${parseInt(idx) + 1}`;
          
          const intensityKey = `sessionIntensity_${viewedMesocycle.id}_${dateString}_${idx}`;
          const storedIntensity = localStorage.getItem(intensityKey);
          const dayIntensity = trainingDay ? (dailyIntensityData?.find(di => di.date === dateString)?.intensity || 'moderate') : 'moderate';
          const sessionIntensity = storedIntensity || dayIntensity;
          
          return {
            id: sessionId,
            sessionIndex: parseInt(idx),
            sessionName,
            exercises: exs,
            methods: [...new Set(exs.map(e => e.methodId))],
            sessionIntensity: sessionIntensity as IntensityLevel,
          };
        })
        .sort((a, b) => a.sessionIndex - b.sessionIndex);

      return {
        date,
        dateString,
        isCurrentMonth: true,
        trainingDay,
        sessions,
        totalExercises: exercises.length,
      };
    });
  }, [viewMode, mesocycles, viewedMesocycle, exercisesByDate, trainingDays, dailyIntensityData, daySplitStates]);

  const handlePrevious = () => {
    setCurrentDate(prev => subWeeks(prev, 1));
  };

  const handleNext = () => {
    setCurrentDate(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    const today = new Date();
    
    // Always jump to today, even if outside mesocycle range
    setCurrentDate(today);
    
    // Show a toast if today is outside the mesocycle
    if (today < currentMesocycle.startDate || today > currentMesocycle.endDate) {
      toast({
        title: "Today is outside current mesocycle",
        description: `${currentMesocycle.name} runs from ${format(currentMesocycle.startDate, 'MMM d')} to ${format(currentMesocycle.endDate, 'MMM d, yyyy')}`,
      });
    }
  };

  // Calculate date range display
  const dateRangeDisplay = useMemo(() => {
    if (calendarDays.length === 0) return '';
    const firstDay = calendarDays[0].date;
    const lastDay = calendarDays[calendarDays.length - 1].date;
    return `${format(firstDay, 'MMM d')} - ${format(lastDay, 'MMM d, yyyy')}`;
  }, [calendarDays]);

  // Get microcycle index for the add exercise context
  const addExerciseMicrocycleIndex = useMemo(() => {
    if (!addExerciseContext) return 0;
    const trainingDay = trainingDays.find(td => td.date === addExerciseContext.dayDate);
    if (!trainingDay) return 0;
    const idx = viewedMesocycle.microcycles.findIndex(mc => mc.id === trainingDay.microcycleId);
    return idx >= 0 ? idx : 0;
  }, [addExerciseContext, trainingDays, viewedMesocycle.microcycles]);

  // Compute available methods for the add exercise flow (same logic as WorkoutSessionSheet)
  const availableMethodsForAdd = useMemo(() => {
    if (!addExerciseContext || !parameterValues) return [];
    const { sessionIndex } = addExerciseContext;
    const methodsForSession = parameterValues[viewedMesocycle.id]?.[addExerciseMicrocycleIndex];
    if (!methodsForSession) return [];
    
    return Object.keys(methodsForSession).flatMap(methodKey => {
      const sessionData = methodsForSession[methodKey];
      if (!sessionData[sessionIndex] || Object.keys(sessionData[sessionIndex]).length === 0) {
        return [];
      }
      const [methodId, categoryName] = methodKey.includes('::') 
        ? methodKey.split('::') 
        : [methodKey, undefined];
      return [{ id: methodKey, methodId, categoryName: categoryName || undefined }];
    });
  }, [addExerciseContext, parameterValues, viewedMesocycle.id, addExerciseMicrocycleIndex]);

  // Handler for exercises selected from library popup
  const handleExercisesSelectedFromLibrary = (exercises: ExerciseSelection[]) => {
    if (!addExerciseContext) return;
    setSelectedExercisesForMethod(exercises);
    setIsLibraryPopupOpen(false);
    setIsMethodSelectionOpen(true);
  };

  // Handler for method selected after exercises
  const handleMethodSelectedForExercises = (methodId: string, categoryName?: string) => {
    if (!addExerciseContext || !onDistributionChange) return;
    const { dayDate, sessionIndex, sectionId } = addExerciseContext;
    
    // Get existing exercises in this section to determine order
    const sectionExercises = exerciseDistribution.filter(
      e => e.dayDate === dayDate && e.sessionIndex === sessionIndex && e.sectionId === sectionId
    );
    
    // Create new distribution entries
    const newEntries: ExerciseDistribution[] = selectedExercisesForMethod.map((ex, index) => ({
      id: `${ex.exerciseId}-${Date.now()}-${index}`,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      methodId,
      categoryName: categoryName || '',
      subCategory: ex.subCategory,
      dayDate,
      sessionIndex,
      order: sectionExercises.length + index,
      sectionId,
    }));
    
    // Update exerciseDistribution via onDistributionChange
    onDistributionChange([...exerciseDistribution, ...newEntries]);
    
    // Clean up state
    setIsMethodSelectionOpen(false);
    setSelectedExercisesForMethod([]);
    setAddExerciseContext(null);
    
    toast({ 
      title: "Exercise(s) added", 
      description: `Added ${newEntries.length} exercise(s) to the section.`
    });
  };

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Training Calendar
            </CardTitle>
          </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Main View Toggle: Calendar vs Master Planner */}
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode !== 'master' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('4week')}
                  className="h-8 px-3 gap-1.5"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Calendar
                </Button>
                <Button
                  variant={viewMode === 'master' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('master')}
                  className="h-8 px-3 gap-1.5"
                >
                  <Columns className="h-4 w-4" />
                  Master Planner
                </Button>
              </div>

              {/* Week view toggle - only show in Master Planner mode */}
              {viewMode === 'master' && (
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
              )}

              {/* Mesocycle selector - only show in Master Planner mode when multiple mesocycles exist */}
              {viewMode === 'master' && mesocycles.length > 1 && (
                <Select
                  value={viewedMesocycleId}
                  onValueChange={(id) => setViewedMesocycleId(id)}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue placeholder="Select Mesocycle" />
                  </SelectTrigger>
                  <SelectContent className="z-[200] bg-background border">
                    {mesocycles.map((meso, idx) => (
                      <SelectItem key={meso.id} value={meso.id}>
                        {meso.name || `Mesocycle ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Day selector - only show in Master Planner mode */}
              {viewMode === 'master' && (
                <Select
                  value={selectedDayOfWeek.toString()}
                  onValueChange={(v) => setSelectedDayOfWeek(parseInt(v))}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue placeholder="Select Day" />
                  </SelectTrigger>
                  <SelectContent className="z-[200] bg-background border">
                    {dayOfWeekNames.map((day, idx) => (
                      <SelectItem key={idx} value={(idx + 1).toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Navigation - only show in Calendar mode */}
              {viewMode !== 'master' && (
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToday}
                    className="h-8 px-3"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid or Master Planner */}
      <Card className="flex-1">
        <CardContent className="p-4">
          {viewMode === 'master' ? (
            /* Master Planner View */
            <MasterPlannerGrid
              calendarDays={allMesocycleDays}
              selectedDayOfWeek={selectedDayOfWeek}
              onSessionClick={(dayDate, sessionIndex, exercises) => {
                const dayExercises = exerciseDistribution.filter(ex => ex.dayDate === dayDate);
                const uniqueSessionIndices = new Set(dayExercises.map(ex => ex.sessionIndex));
                const totalSessions = uniqueSessionIndices.size;
                
                setSelectedSession({
                  dayDate,
                  sessionIndex,
                  exercises,
                  totalSessions
                });
              }}
              onAddSession={onAddSession}
              getIntensityColor={getIntensityColor}
              dailyIntensityData={dailyIntensityData}
              parameterValues={parameterValues}
              currentMesocycle={viewedMesocycle}
              trainingDays={trainingDays}
              toolboxData={toolboxData}
              weeksToDisplay={masterWeeksToDisplay}
              onWeeksToDisplayChange={setMasterWeeksToDisplay}
              onParameterChange={onSaveParameters ? (dayDate, sessionIndex, methodId, categoryName, paramName, value) => {
                const trainingDay = trainingDays.find(td => td.date === dayDate);
                const microcycleId = trainingDay?.microcycleId;
                const microcycleIndex = viewedMesocycle.microcycles?.findIndex(m => m.id === microcycleId) ?? 0;
                const fullMethodKey = categoryName ? `${methodId}::${categoryName}` : methodId;
                onSaveParameters(viewedMesocycle.id, microcycleIndex, fullMethodKey, sessionIndex, '', { [paramName]: value });
              } : undefined}
              sessionSections={sessionSections}
              supersets={supersets}
              onSessionNameChange={onRenameSession}
              onSessionCommentChange={(dayDate, sessionIndex, comment) => {
                // Save session comment to localStorage
                const key = `workoutSessions_${viewedMesocycle.id}_${dayDate}_${sessionIndex}`;
                try {
                  const existing = localStorage.getItem(key);
                  const parsed = existing ? JSON.parse(existing) : {};
                  parsed.comments = comment;
                  localStorage.setItem(key, JSON.stringify(parsed));
                } catch {}
              }}
              onSectionCommentChange={(sectionId, comment) => {
                // Update section comment via onSectionsChange
                if (sessionSections && onSectionsChange) {
                  const updated = sessionSections.map(s => 
                    s.id === sectionId ? { ...s, comments: comment } : s
                  );
                  onSectionsChange(updated);
                }
              }}
              onExerciseNotesChange={(exerciseId, notes) => {
                // Sync exercise notes to parent's exerciseDistribution
                if (onDistributionChange) {
                  const updated = exerciseDistribution.map(ex =>
                    (ex.id === exerciseId || ex.exerciseId === exerciseId) ? { ...ex, notes } : ex
                  );
                  onDistributionChange(updated);
                }
              }}
              onExerciseEachSideChange={(exerciseId, eachSide) => {
                // Sync eachSide toggle to parent's exerciseDistribution
                if (onDistributionChange) {
                  const updated = exerciseDistribution.map(ex =>
                    (ex.id === exerciseId || ex.exerciseId === exerciseId) ? { ...ex, eachSide } : ex
                  );
                  onDistributionChange(updated);
                }
              }}
              onExerciseAutoCalcChange={(exerciseId, field, value) => {
                // Sync auto-calculate toggle to parent's exerciseDistribution
                if (onDistributionChange) {
                  const updated = exerciseDistribution.map(ex =>
                    (ex.id === exerciseId || ex.exerciseId === exerciseId) ? { ...ex, [field]: value } : ex
                  );
                  onDistributionChange(updated);
                }
              }}
              // Phase 4: Pass intensity editing props
              onDayIntensityChange={onIntensityChange}
              onSessionIntensityChange={onSessionIntensityChange}
              intensityLevels={intensityLevels}
              // Phase 5: Pass section and exercise reordering props
              onSectionReorder={(dayDate, sessionIndex, sectionId, direction) => {
                if (!sessionSections || !onSectionsChange) return;
                
                // Get sections for this specific session, sorted by order
                const sessionSpecificSections = sessionSections
                  .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)
                  .sort((a, b) => a.order - b.order);
                
                // Find current section index
                const currentIndex = sessionSpecificSections.findIndex(s => s.id === sectionId);
                if (currentIndex < 0) return;
                
                // Calculate new index
                const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
                if (newIndex < 0 || newIndex >= sessionSpecificSections.length) return;
                
                // Swap sections
                const reordered = [...sessionSpecificSections];
                [reordered[currentIndex], reordered[newIndex]] = [reordered[newIndex], reordered[currentIndex]];
                
                // Reassign order values
                const reorderedWithOrder = reordered.map((s, idx) => ({ ...s, order: idx }));
                
                // Update sessionSections state (keep other sessions' sections unchanged)
                const otherSections = sessionSections.filter(
                  s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
                );
                onSectionsChange([...otherSections, ...reorderedWithOrder]);
                
                toast({ title: "Section reordered" });
              }}
              onExerciseReorder={(dayDate, sessionIndex, sectionId, exerciseId, direction) => {
                if (!onDistributionChange) return;
                
                // Get exercises for this specific section, sorted by order
                const sectionExercises = exerciseDistribution
                  .filter(e => e.dayDate === dayDate && e.sessionIndex === sessionIndex && e.sectionId === sectionId)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                
                // Find current exercise index
                const currentIndex = sectionExercises.findIndex(e => e.exerciseId === exerciseId || e.id === exerciseId);
                if (currentIndex < 0) return;
                
                // Calculate new index
                const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
                if (newIndex < 0 || newIndex >= sectionExercises.length) return;
                
                // Swap exercises
                const reordered = [...sectionExercises];
                [reordered[currentIndex], reordered[newIndex]] = [reordered[newIndex], reordered[currentIndex]];
                
                // Reassign order values
                const reorderedWithOrder = reordered.map((e, idx) => ({ ...e, order: idx }));
                
                // Update exerciseDistribution state (keep other exercises unchanged)
                const otherExercises = exerciseDistribution.filter(
                  e => !(e.dayDate === dayDate && e.sessionIndex === sessionIndex && e.sectionId === sectionId)
                );
                onDistributionChange([...otherExercises, ...reorderedWithOrder]);
                
                toast({ title: "Exercise reordered" });
              }}
              // Phase 6: Add section and exercise buttons
              onAddSectionToSession={(dayDate, sessionIndex) => {
                if (!onSectionsChange) return;
                
                // Get existing sections for this session
                const existingSections = (sessionSections || [])
                  .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex);
                
                // Calculate next section number
                const nextSectionNum = existingSections.length + 1;
                
                // Create new section
                const newSection: SessionSection = {
                  id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  name: `Section ${nextSectionNum}`,
                  dayDate,
                  sessionIndex,
                  order: existingSections.length,
                };
                
                // Add to sessionSections
                onSectionsChange([...(sessionSections || []), newSection]);
                
                toast({ title: "Section added" });
              }}
              onAddExerciseToSection={(dayDate, sessionIndex, sectionId) => {
                // Store context and open the exercise library popup directly
                setAddExerciseContext({ dayDate, sessionIndex, sectionId });
                setIsLibraryPopupOpen(true);
              }}
              onExerciseDuplicate={(dayDate, sessionIndex, sectionId, exerciseId) => {
                if (!onDistributionChange) return;
                
                // Find the exercise to duplicate
                const exerciseToDuplicate = exerciseDistribution.find(
                  e => (e.id === exerciseId || e.exerciseId === exerciseId) && 
                       e.dayDate === dayDate && 
                       e.sessionIndex === sessionIndex &&
                       (sectionId === '' || e.sectionId === sectionId)
                );
                
                if (!exerciseToDuplicate) return;
                
                // Find exercises in same section to determine order
                const sectionExercises = exerciseDistribution.filter(
                  e => e.dayDate === dayDate && 
                       e.sessionIndex === sessionIndex && 
                       e.sectionId === exerciseToDuplicate.sectionId
                );
                
                // Create duplicate with new ID, placed right after original
                const newExercise = {
                  ...exerciseToDuplicate,
                  id: `${exerciseToDuplicate.exerciseId}-${Date.now()}-dup`,
                  order: (exerciseToDuplicate.order ?? sectionExercises.length - 1) + 1,
                };
                
                // Update order of exercises after the duplicated one
                const updatedDistribution = exerciseDistribution.map(e => {
                  if (e.dayDate === dayDate && 
                      e.sessionIndex === sessionIndex && 
                      e.sectionId === exerciseToDuplicate.sectionId &&
                      (e.order ?? 0) > (exerciseToDuplicate.order ?? 0)) {
                    return { ...e, order: (e.order ?? 0) + 1 };
                  }
                  return e;
                });
                
                onDistributionChange([...updatedDistribution, newExercise]);
                toast({ title: "Exercise duplicated" });
              }}
              onExerciseDelete={(dayDate, sessionIndex, sectionId, exerciseId) => {
                if (!onDistributionChange) return;
                
                // Remove the exercise
                const updatedDistribution = exerciseDistribution.filter(
                  e => !((e.id === exerciseId || e.exerciseId === exerciseId) && 
                         e.dayDate === dayDate && 
                         e.sessionIndex === sessionIndex &&
                         (sectionId === '' || e.sectionId === sectionId))
                );
                
                // Clean up supersets - remove deleted exercise from all superset groups
                const cleanedSupersets = cleanupSupersetsOnExerciseDelete(supersets, exerciseId);
                onSupersetsChange?.(cleanedSupersets);
                
                onDistributionChange(updatedDistribution);
                toast({ title: "Exercise deleted" });
              }}
              onToggleSuperset={(dayDate, sessionIndex, exerciseId1, exerciseId2, sectionId) => {
                const result = toggleSuperset(supersets, dayDate, sessionIndex, exerciseId1, exerciseId2, sectionId);
                onSupersetsChange?.(result.newSupersets);
                toast({ title: result.action === 'unlinked' ? 'Exercises unlinked' : 'Exercises linked', description: result.message });
              }}
              onSectionDelete={(dayDate, sessionIndex, sectionId) => {
                if (!sessionSections || !onSectionsChange) return;
                
                // Get exercises to delete for superset cleanup
                const exercisesToDelete = exerciseDistribution.filter(
                  e => e.dayDate === dayDate && e.sessionIndex === sessionIndex && e.sectionId === sectionId
                );
                
                // Remove exercises belonging to this section
                if (onDistributionChange) {
                  const updatedDistribution = exerciseDistribution.filter(
                    e => !(e.dayDate === dayDate && e.sessionIndex === sessionIndex && e.sectionId === sectionId)
                  );
                  onDistributionChange(updatedDistribution);
                }
                
                // Clean up supersets for deleted exercises
                if (onSupersetsChange) {
                  let cleanedSupersets = { ...supersets };
                  exercisesToDelete.forEach(ex => {
                    cleanedSupersets = cleanupSupersetsOnExerciseDelete(cleanedSupersets, ex.id || ex.exerciseId);
                  });
                  onSupersetsChange(cleanedSupersets);
                }
                
                // Remove the section and reorder remaining sections
                const otherSections = sessionSections.filter(
                  s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
                );
                const sessionSpecificSections = sessionSections
                  .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex && s.id !== sectionId)
                  .sort((a, b) => a.order - b.order)
                  .map((s, idx) => ({ ...s, order: idx }));
                
                onSectionsChange([...otherSections, ...sessionSpecificSections]);
                toast({ title: "Section deleted" });
              }}
              onSectionDuplicate={(dayDate, sessionIndex, sectionId) => {
                if (!sessionSections || !onSectionsChange) return;
                
                // Find the section to duplicate
                const sectionToDuplicate = sessionSections.find(s => s.id === sectionId);
                if (!sectionToDuplicate) return;
                
                const timestamp = Date.now();
                const newSectionId = `section-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
                
                // Get existing sections for this session to calculate order
                const sessionSpecificSections = sessionSections
                  .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)
                  .sort((a, b) => a.order - b.order);
                
                const originalIndex = sessionSpecificSections.findIndex(s => s.id === sectionId);
                
                // Create duplicated section
                const newSection = {
                  id: newSectionId,
                  name: `${sectionToDuplicate.name} (Copy)`,
                  dayDate,
                  sessionIndex,
                  order: originalIndex + 1,
                  comments: sectionToDuplicate.comments,
                };
                
                // Reorder sections after the duplicated one
                const reorderedSections = sessionSpecificSections.map((s, idx) => {
                  if (idx > originalIndex) {
                    return { ...s, order: s.order + 1 };
                  }
                  return s;
                });
                
                // Get other sessions' sections
                const otherSections = sessionSections.filter(
                  s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
                );
                
                onSectionsChange([...otherSections, ...reorderedSections, newSection]);
                
                // Duplicate exercises in this section
                if (onDistributionChange) {
                  const sectionExercises = exerciseDistribution.filter(
                    e => e.dayDate === dayDate && e.sessionIndex === sessionIndex && e.sectionId === sectionId
                  );
                  
                  const duplicatedExercises = sectionExercises.map((ex, idx) => ({
                    ...ex,
                    id: `${ex.exerciseId}-${timestamp}-dup-${idx}`,
                    sectionId: newSectionId,
                  }));
                  
                  onDistributionChange([...exerciseDistribution, ...duplicatedExercises]);
                }
                
                toast({ 
                  title: "Section duplicated",
                  description: `"${sectionToDuplicate.name}" copied with ${
                    exerciseDistribution.filter(e => e.sectionId === sectionId).length
                  } exercise(s)`
                });
              }}
              onCopySession={onCopySession}
              onDeleteSession={onDeleteSession}
              onPasteSession={onPasteSession}
              copiedSession={copiedSession}
              onCopyDay={onCopyDay}
              onClearDay={onClearDay}
              onPasteDay={(dayDate) => {
                // Trigger paste day - onPasteSession handles both session and day paste
                if (copiedDay) {
                  onPasteSession?.(dayDate);
                }
              }}
              copiedDay={copiedDay}
              onAddTestEvent={onAddTestEvent}
              onDeleteTestEvent={onDeleteTestEvent}
              onUpdateTestComment={onUpdateTestComment}
              onUpdateTestValues={onUpdateTestValues}
              onUpdateEventComment={onUpdateEventComment}
              availableTests={availableTests}
              availableEvents={availableEvents}
              allExerciseDistribution={exerciseDistribution}
              onOpenExerciseDetail={handleOpenExerciseDetail}
              onExerciseChange={(dayDate, sessionIndex, sectionId, exerciseId, newExercise) => {
                if (!onDistributionChange) return;
                
                // Update exerciseDistribution - preserve all other fields, just change exercise ID and name
                const updatedDistribution = exerciseDistribution.map(ex =>
                  (ex.id === exerciseId || ex.exerciseId === exerciseId) && 
                  ex.dayDate === dayDate && 
                  ex.sessionIndex === sessionIndex &&
                  (sectionId === '' || ex.sectionId === sectionId)
                    ? { ...ex, exerciseId: newExercise.exerciseId, exerciseName: newExercise.exerciseName }
                    : ex
                );
                onDistributionChange(updatedDistribution);
                
                toast({ title: "Exercise changed", description: `Changed to ${newExercise.exerciseName}` });
              }}
              selectedAthleteId={selectedAthleteId}
              athletePerformanceParameters={athletePerformanceParameters}
            />
          ) : (
            /* Calendar View */
            <DragDropContext onDragEnd={(result) => onSessionDragEnd?.(result)}>
              <div className="space-y-2">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {dayHeaders.map(day => (
                    <div
                      key={day}
                      className="text-center text-sm font-semibold text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Weeks */}
                {weeks.map((week, weekIdx) => {
                  // Compute microcycle label via date-math against mesocycle start.
                  // Walk through microcycles accumulating days; the first week-day that
                  // falls inside the mesocycle range determines which microcycle label to show.
                  const mesoStart = currentMesocycle.startDate instanceof Date
                    ? currentMesocycle.startDate
                    : new Date(currentMesocycle.startDate);
                  const mesoEnd = currentMesocycle.endDate instanceof Date
                    ? currentMesocycle.endDate
                    : new Date(currentMesocycle.endDate);

                  let microcycleLabel: string | undefined;
                  outer: for (const day of week) {
                    const d = day.date;
                    if (d < mesoStart || d > mesoEnd) continue;
                    let accumulated = 0;
                    for (const mc of currentMesocycle.microcycles) {
                      const mcStart = addDays(mesoStart, accumulated);
                      const mcEnd = addDays(mesoStart, accumulated + mc.duration - 1);
                      if (d >= mcStart && d <= mcEnd) {
                        microcycleLabel = mc.name;
                        break outer;
                      }
                      accumulated += mc.duration;
                    }
                  }

                  return (
                  <WeekRow
                    key={weekIdx}
                    week={week}
                    weekIdx={weekIdx}
                    microcycleLabel={microcycleLabel}
                    copiedWeek={copiedWeek}
                    copiedSession={copiedSession}
                    copiedDay={copiedDay}
                    onCopyWeek={onCopyWeek}
                    onClearWeek={onClearWeek}
                    onPasteWeek={onPasteWeek}
                    onSessionClick={(dayDate, sessionIndex, exercises) => {
                      // Count total sessions for this day
                      const dayExercises = exerciseDistribution.filter(ex => ex.dayDate === dayDate);
                      const uniqueSessionIndices = new Set(dayExercises.map(ex => ex.sessionIndex));
                      const totalSessions = uniqueSessionIndices.size;
                      
                      setSelectedSession({
                        dayDate,
                        sessionIndex,
                        exercises,
                        totalSessions
                      });
                    }}
                    onDeleteSession={onDeleteSession}
                    onCopySession={onCopySession}
                    onPasteSession={onPasteSession}
                    onCopyDay={onCopyDay}
                    onClearDay={onClearDay}
                    onAddTestEvent={onAddTestEvent}
                    onDeleteTestEvent={onDeleteTestEvent}
                    onUpdateTestComment={onUpdateTestComment}
                    onUpdateTestValues={onUpdateTestValues}
                    onUpdateEventComment={onUpdateEventComment}
                    availableTests={availableTests}
                    availableEvents={availableEvents}
                    dailyIntensityData={dailyIntensityData}
                    onIntensityChange={onIntensityChange}
                    getIntensityColor={getIntensityColor}
                    intensityLevels={intensityLevels}
                    onMoveSessionUp={onMoveSessionUp}
                    onMoveSessionDown={onMoveSessionDown}
                    onAddSession={onAddSession}
                    selectedAthleteId={selectedAthleteId}
                    athletePerformanceParameters={athletePerformanceParameters}
                  />
                  );
                })}
              </div>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      {/* Workout Session Sheet */}
      {selectedSession && (
        <WorkoutSessionSheet
          isOpen={!!selectedSession}
          onClose={() => {
            setSelectedSession(null);
            setSessionDataVersion(v => v + 1);
          }}
          dayDate={selectedSession.dayDate}
          sessionIndex={selectedSession.sessionIndex}
          exercises={selectedSession.exercises}
          mesocycleId={currentMesocycle.id}
          microcycleIndex={getMicrocycleIndex(selectedSession.dayDate)}
          parameterValues={parameterValues}
          onSaveParameters={onSaveParameters || (() => {})}
          dailyIntensityData={dailyIntensityData}
          onIntensityChange={onIntensityChange}
          onSessionIntensityChange={onSessionIntensityChange}
          getIntensityColor={getIntensityColor}
          intensityLevels={intensityLevels}
          totalSessionsOnDay={selectedSession.totalSessions}
          trainingDay={
            calendarDays.find(d => d.dateString === selectedSession.dayDate)?.trainingDay
          }
          availableTests={availableTests}
          availableEvents={availableEvents}
          onAddTestEvent={onAddTestEvent}
          onDeleteTestEvent={onDeleteTestEvent}
          onUpdateTestComment={onUpdateTestComment}
          onUpdateTestValues={onUpdateTestValues}
          onUpdateEventComment={onUpdateEventComment}
          copiedSession={copiedSession}
          copiedSection={copiedSection}
          onCopySession={onCopySession}
          onCopySection={onCopySection}
          onPasteSection={onPasteSection}
          sessionSections={sessionSections}
          supersets={supersets}
          onSectionsChange={onSectionsChange}
          onSupersetsChange={onSupersetsChange}
          sessionNameFromState={
            calendarDays.find(d => d.dateString === selectedSession.dayDate)?.trainingDay?.sessionNames?.[selectedSession.sessionIndex]
          }
          onRenameSession={onRenameSession}
          toolboxData={toolboxData}
          allExerciseDistribution={exerciseDistribution}
          onDistributionChange={onDistributionChange}
          microcycleDates={(() => {
            const trainingDay = trainingDays.find(td => td.date === selectedSession.dayDate);
            if (!trainingDay?.microcycleId) return [];
            return trainingDays
              .filter(td => td.microcycleId === trainingDay.microcycleId)
              .map(td => td.date);
          })()}
          selectedAthleteId={selectedAthleteId}
          athletePerformanceParameters={athletePerformanceParameters}
          onOpenAIAssistant={onOpenAIAssistant}
          forceParamRefresh={forceParamRefresh}
        />
      )}

      {/* Exercise Library Popup for Master Planner "Add Exercise" */}
      <ExerciseLibraryPopup
        isOpen={isLibraryPopupOpen}
        onClose={() => {
          setIsLibraryPopupOpen(false);
          setAddExerciseContext(null);
        }}
        onSelectExercises={handleExercisesSelectedFromLibrary}
        selectedExerciseIds={[]}
        onExerciseCreated={(exercise) => {
          // When a new exercise is created in the popup, directly add it to the selection flow
          setSelectedExercisesForMethod([exercise]);
          setIsLibraryPopupOpen(false);
          setIsMethodSelectionOpen(true);
        }}
      />

      {/* Method Selection Dialog for Master Planner "Add Exercise" */}
      <MethodSelectionDialog
        isOpen={isMethodSelectionOpen}
        onClose={() => {
          setIsMethodSelectionOpen(false);
          setSelectedExercisesForMethod([]);
          setAddExerciseContext(null);
        }}
        onMethodSelected={handleMethodSelectedForExercises}
        availableMethods={availableMethodsForAdd}
        mesocycleId={viewedMesocycle.id}
        microcycleIndex={addExerciseMicrocycleIndex}
        sessionIndex={addExerciseContext?.sessionIndex || 0}
      />

      {/* Exercise Detail Dialog for Master Planner */}
      {detailExercise && (
        <ExerciseDetailDialog
          isOpen={!!detailExercise}
          onClose={() => setDetailExercise(null)}
          exerciseId={detailExercise.exerciseId}
          exerciseName={detailExercise.exerciseName}
          mode="edit"
          onSave={handleSaveExerciseToLibrary}
        />
      )}
    </div>
  );
}
