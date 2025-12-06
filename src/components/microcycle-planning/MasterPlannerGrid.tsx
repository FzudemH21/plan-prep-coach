import React, { useMemo } from 'react';
import { getDay } from 'date-fns';
import { MasterPlannerColumn } from './MasterPlannerColumn';
import { IntensityLevel } from '@/types/training';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ExtendedMesocycle } from '@/features/planner/types';

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
}

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
}: MasterPlannerGridProps) {
  // Filter days that match the selected day of week
  // getDay returns 0=Sunday, 1=Monday, etc.
  // Our selectedDayOfWeek: 1=Monday, 7=Sunday
  const filteredDays = useMemo(() => {
    const targetDay = selectedDayOfWeek === 7 ? 0 : selectedDayOfWeek;
    return calendarDays
      .filter(day => getDay(day.date) === targetDay)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
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
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
