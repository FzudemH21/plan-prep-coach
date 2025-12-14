import React, { useMemo } from 'react';
import { getDay } from 'date-fns';
import { MasterPlannerColumn } from './MasterPlannerColumn';
import { IntensityLevel } from '@/types/training';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ExtendedMesocycle } from '@/features/planner/types';
import { ToolboxDatabase } from '@/types/toolbox';
import { SessionSection, SupersetMapping } from '@/types/microcycle-planning';

interface ExerciseDistribution {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
  sectionId?: string;
  notes?: string;
}

interface TrainingDay {
  date: string;
  dayOfWeek: number;
  dayName: string;
  mesocycleId: string;
  microcycleId: string;
  isTestDay: boolean;
  isEventDay: boolean;
  isTrainingDay: boolean;
  testNames?: string[];
  eventNames?: string[];
  sessionNames?: string[];
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

interface MasterPlannerGridProps {
  calendarDays: CalendarDay[];
  selectedDayOfWeek: number; // 1=Monday, 7=Sunday
  onSessionClick?: (dayDate: string, sessionIndex: number, exercises: ExerciseDistribution[]) => void;
  onAddSession?: (dayDate: string) => void;
  getIntensityColor?: (intensity: IntensityLevel) => string;
  dailyIntensityData?: any[];
  parameterValues?: Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>;
  currentMesocycle?: ExtendedMesocycle;
  trainingDays?: TrainingDay[];
  toolboxData?: ToolboxDatabase;
  onParameterChange?: (
    dayDate: string,
    sessionIndex: number,
    methodId: string,
    categoryName: string,
    parameterName: string,
    value: string | number
  ) => void;
  // New props for Phase 1
  sessionSections?: SessionSection[];
  supersets?: SupersetMapping;
  onSessionNameChange?: (dayDate: string, sessionIndex: number, newName: string) => void;
  onSessionCommentChange?: (dayDate: string, sessionIndex: number, comment: string) => void;
  onSectionCommentChange?: (sectionId: string, comment: string) => void;
}

const MAX_WEEKS_DISPLAY = 6;

export function MasterPlannerGrid({
  calendarDays,
  selectedDayOfWeek,
  onSessionClick,
  onAddSession,
  getIntensityColor,
  dailyIntensityData,
  parameterValues,
  currentMesocycle,
  trainingDays,
  toolboxData,
  onParameterChange,
  sessionSections,
  supersets,
  onSessionNameChange,
  onSessionCommentChange,
  onSectionCommentChange,
}: MasterPlannerGridProps) {
  // Filter days that match the selected day of week
  // getDay returns 0=Sunday, 1=Monday, etc.
  // Our selectedDayOfWeek: 1=Monday, 7=Sunday
  const filteredDays = useMemo(() => {
    const targetDay = selectedDayOfWeek === 7 ? 0 : selectedDayOfWeek;
    return calendarDays
      .filter(day => getDay(day.date) === targetDay)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, MAX_WEEKS_DISPLAY); // Limit to 6 weeks
  }, [calendarDays, selectedDayOfWeek]);

  if (filteredDays.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No training days found for the selected day of week.
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex min-h-[500px]">
        {filteredDays.map((day, idx) => (
          <MasterPlannerColumn
            key={day.dateString}
            day={day}
            weekNumber={idx + 1}
            onSessionClick={onSessionClick}
            onAddSession={onAddSession}
            getIntensityColor={getIntensityColor}
            dailyIntensityData={dailyIntensityData}
            parameterValues={parameterValues}
            currentMesocycle={currentMesocycle}
            trainingDays={trainingDays}
            toolboxData={toolboxData}
            onParameterChange={onParameterChange}
            sessionSections={sessionSections}
            supersets={supersets}
            onSessionNameChange={onSessionNameChange}
            onSessionCommentChange={onSessionCommentChange}
            onSectionCommentChange={onSectionCommentChange}
            totalWeeks={filteredDays.length}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
