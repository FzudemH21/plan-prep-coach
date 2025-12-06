import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameMonth, parseISO, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { TrainingDay } from '@/types/daily-intensity';
import { ExtendedMesocycle } from '@/features/planner/types';
import { IntensityLevel } from '@/types/training';
import { TrainingDayCell } from './TrainingDayCell';
import { WeekRow } from './WeekRow';
import { WorkoutSessionSheet } from './WorkoutSessionSheet';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';

interface ExerciseDistribution {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
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
  onUpdateEventComment?: (eventId: string, comments: string) => void;
  copiedSection?: { exercises: ExerciseDistribution[]; sections: any[]; sourceSectionId: string; sourceDayDate: string; sourceSessionIndex: number } | null;
  onCopySection?: (sectionId: string) => void;
  onPasteSection?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionUp?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionDown?: (dayDate: string, sessionIndex: number) => void;
  onRenameSession?: (dayDate: string, sessionIndex: number, newName: string) => void;
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

type ViewMode = '1week' | '2week' | '4week';

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
  getIntensityColor,
  intensityLevels,
  parameterValues = {},
  onSaveParameters,
  onUpdateTestComment,
  onUpdateEventComment,
  copiedSection,
  onCopySection,
  onPasteSection,
  onMoveSessionUp,
  onMoveSessionDown,
  onRenameSession,
}: TrainingCalendarViewProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('4week');
  const [currentDate, setCurrentDate] = useState<Date>(currentMesocycle.startDate);
  const [selectedSession, setSelectedSession] = useState<{
    dayDate: string;
    sessionIndex: number;
    exercises: ExerciseDistribution[];
    totalSessions: number;
  } | null>(null);
  const [sessionDataVersion, setSessionDataVersion] = useState(0);

  // Helper function to get microcycle index from date
  const getMicrocycleIndex = (dayDate: string): number => {
    // Find the training day for this date
    const trainingDay = trainingDays.find(td => td.date === dayDate);
    
    if (!trainingDay) {
      console.warn(`[TrainingCalendar] No training day found for date ${dayDate}, defaulting to microcycle 0`);
      return 0;
    }
    
    // Find the index of this microcycle within the current mesocycle
    const microcycleIndex = currentMesocycle.microcycles.findIndex(
      mc => mc.id === trainingDay.microcycleId
    );
    
    if (microcycleIndex === -1) {
      console.warn(`[TrainingCalendar] Microcycle ${trainingDay.microcycleId} not found in mesocycle ${currentMesocycle.id}, defaulting to 0`);
      return 0;
    }
    
    console.log(`[TrainingCalendar] Date ${dayDate} -> Microcycle ID ${trainingDay.microcycleId} -> Index ${microcycleIndex}`);
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

  // Calculate calendar days based on view mode
  const calendarDays = useMemo(() => {
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
        isCurrentMonth: isSameMonth(date, currentDate),
        trainingDay,
        sessions,
        totalExercises: exercises.length,
      };
    });
  }, [currentDate, viewMode, exercisesByDate, trainingDays, sessionDataVersion]);

  // Group days into weeks
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

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
              {/* View Mode Toggle */}
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === '1week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('1week')}
                  className="h-8 px-3"
                >
                  1 Week
                </Button>
                <Button
                  variant={viewMode === '2week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('2week')}
                  className="h-8 px-3"
                >
                  2 Weeks
                </Button>
                <Button
                  variant={viewMode === '4week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('4week')}
                  className="h-8 px-3"
                >
                  4 Weeks
                </Button>
              </div>

              {/* Navigation */}
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
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <Card className="flex-1">
        <CardContent className="p-4">
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
              {weeks.map((week, weekIdx) => (
                <WeekRow
                  key={weekIdx}
                  week={week}
                  weekIdx={weekIdx}
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
                  onUpdateEventComment={onUpdateEventComment}
                  availableTests={availableTests}
                  availableEvents={availableEvents}
                  dailyIntensityData={dailyIntensityData}
                  onIntensityChange={onIntensityChange}
                  getIntensityColor={getIntensityColor}
                  intensityLevels={intensityLevels}
                  onMoveSessionUp={onMoveSessionUp}
                  onMoveSessionDown={onMoveSessionDown}
                />
              ))}
            </div>
          </DragDropContext>
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
          onUpdateEventComment={onUpdateEventComment}
          copiedSession={copiedSession}
          copiedSection={copiedSection}
          onCopySession={onCopySession}
          onCopySection={onCopySection}
          onPasteSection={onPasteSection}
          sessionNameFromState={
            calendarDays.find(d => d.dateString === selectedSession.dayDate)?.trainingDay?.sessionNames?.[selectedSession.sessionIndex]
          }
          onRenameSession={onRenameSession}
        />
      )}
    </div>
  );
}
