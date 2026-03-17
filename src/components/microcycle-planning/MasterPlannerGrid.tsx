import React, { useMemo, useState } from 'react';
import { getDay } from 'date-fns';
import { MasterPlannerColumn } from './MasterPlannerColumn';
import { IntensityLevel, SubGoal, Event } from '@/types/training';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ExtendedMesocycle } from '@/features/planner/types';
import { ToolboxDatabase } from '@/types/toolbox';
import { SessionSection, SupersetMapping } from '@/types/microcycle-planning';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AthletePerformanceParameter } from '@/types/athlete';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  eachSide?: boolean;
  autoCalculateWeight?: boolean;
  autoCalculateTargetHR?: boolean;
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
  // New props for Phase 2 - editable notes and eachSide
  onExerciseNotesChange?: (exerciseId: string, notes: string) => void;
  onExerciseEachSideChange?: (exerciseId: string, eachSide: boolean) => void;
  // New props for Phase 3 - auto-calculate toggles
  onExerciseAutoCalcChange?: (exerciseId: string, field: 'autoCalculateWeight' | 'autoCalculateTargetHR', value: boolean) => void;
  // New props for Phase 4 - intensity editing
  onDayIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  onSessionIntensityChange?: (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => void;
  intensityLevels?: IntensityLevel[];
  // New props for Phase 5 - section and exercise reordering
  onSectionReorder?: (dayDate: string, sessionIndex: number, sectionId: string, direction: 'up' | 'down') => void;
  onExerciseReorder?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string, direction: 'up' | 'down') => void;
  // New props for Phase 6 - add section and exercise buttons
  onAddSectionToSession?: (dayDate: string, sessionIndex: number) => void;
  onAddExerciseToSection?: (dayDate: string, sessionIndex: number, sectionId: string) => void;
  // New props for duplicate/delete exercise
  onExerciseDuplicate?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => void;
  onExerciseDelete?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => void;
  // New prop for superset toggling
  onToggleSuperset?: (dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string, sectionId?: string) => void;
  // New props for section duplicate/delete
  onSectionDuplicate?: (dayDate: string, sessionIndex: number, sectionId: string) => void;
  onSectionDelete?: (dayDate: string, sessionIndex: number, sectionId: string) => void;
  // New props for session copy/delete/paste
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onDeleteSession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  copiedSession?: { exercises: ExerciseDistribution[]; sections?: any[]; sourceDate: string; sessionIndex: number } | null;
  // New props for day management
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  onPasteDay?: (dayDate: string) => void;
  copiedDay?: { exercises: ExerciseDistribution[]; sourceDate: string } | null;
  // Test/Event management props
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event', testEventId: string, testEventName: string, isNew: boolean, comments?: string) => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event', name: string) => void;
  onUpdateTestComment?: (testId: string, comments: string) => void;
  onUpdateTestValues?: (testId: string, updates: { preTestValue?: number; goalValue?: number; comments?: string }) => void;
  onUpdateEventComment?: (eventId: string, comments: string) => void;
  availableTests?: SubGoal[];
  availableEvents?: Event[];
  // Full exercise distribution for chronological session index calculation
  allExerciseDistribution?: ExerciseDistribution[];
  // Exercise detail dialog
  onOpenExerciseDetail?: (exercise: ExerciseDistribution) => void;
  // Exercise change
  onExerciseChange?: (
    dayDate: string,
    sessionIndex: number,
    sectionId: string,
    exerciseId: string,
    newExercise: { exerciseId: string; exerciseName: string; libraryId: string }
  ) => void;
  // Athlete context for baseline value auto-fill
  selectedAthleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
}

const WEEKS_OPTIONS = [1, 2, 4, 6, 8] as const;
const DEFAULT_WEEKS_DISPLAY = 6;

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
  onExerciseNotesChange,
  onExerciseEachSideChange,
  onExerciseAutoCalcChange,
  onDayIntensityChange,
  onSessionIntensityChange,
  intensityLevels,
  onSectionReorder,
  onExerciseReorder,
  onAddSectionToSession,
  onAddExerciseToSection,
  onExerciseDuplicate,
  onExerciseDelete,
  onToggleSuperset,
  onSectionDuplicate,
  onSectionDelete,
  onCopySession,
  onDeleteSession,
  onPasteSession,
  copiedSession,
  onCopyDay,
  onClearDay,
  onPasteDay,
  copiedDay,
  onAddTestEvent,
  onDeleteTestEvent,
  onUpdateTestComment,
  onUpdateTestValues,
  onUpdateEventComment,
  availableTests,
  availableEvents,
  allExerciseDistribution,
  onOpenExerciseDetail,
  onExerciseChange,
  selectedAthleteId,
  athletePerformanceParameters,
}: MasterPlannerGridProps) {
  const [startWeekOffset, setStartWeekOffset] = useState(0);
  const [weeksToDisplay, setWeeksToDisplay] = useState(DEFAULT_WEEKS_DISPLAY);

  // Filter days that match the selected day of week
  // getDay returns 0=Sunday, 1=Monday, etc.
  // Our selectedDayOfWeek: 1=Monday, 7=Sunday
  const allMatchingDays = useMemo(() => {
    const targetDay = selectedDayOfWeek === 7 ? 0 : selectedDayOfWeek;
    return calendarDays
      .filter(day => getDay(day.date) === targetDay)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calendarDays, selectedDayOfWeek]);

  // Apply pagination for mesocycles with more than 6 weeks
  const filteredDays = useMemo(() => {
    return allMatchingDays.slice(startWeekOffset, startWeekOffset + weeksToDisplay);
  }, [allMatchingDays, startWeekOffset, weeksToDisplay]);

  const totalWeeksInMesocycle = allMatchingDays.length;
  const hasMoreWeeks = totalWeeksInMesocycle > weeksToDisplay;
  const canGoBack = startWeekOffset > 0;
  const canGoForward = startWeekOffset + weeksToDisplay < totalWeeksInMesocycle;

  // Reset offset when mesocycle changes
  useMemo(() => {
    setStartWeekOffset(0);
  }, [currentMesocycle?.id]);

  if (filteredDays.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No training days found for the selected day of week.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Week Navigation - always show indicator, buttons only for 6+ weeks */}
      <div className="flex items-center justify-between mb-2 px-2">
        {/* Weeks-per-view selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Show:</span>
          <Select
            value={String(weeksToDisplay)}
            onValueChange={(v) => {
              const n = Number(v);
              setWeeksToDisplay(n);
              setStartWeekOffset(0);
            }}
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKS_OPTIONS.map(w => (
                <SelectItem key={w} value={String(w)} className="text-xs">
                  {w} {w === 1 ? 'week' : 'weeks'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasMoreWeeks ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStartWeekOffset(prev => Math.max(0, prev - 1))}
              disabled={!canGoBack}
              className="h-7"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Weeks {startWeekOffset + 1}-{Math.min(startWeekOffset + weeksToDisplay, totalWeeksInMesocycle)} of {totalWeeksInMesocycle}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStartWeekOffset(prev => Math.min(totalWeeksInMesocycle - weeksToDisplay, prev + 1))}
              disabled={!canGoForward}
              className="h-7"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </>
        ) : (
          <div className="w-full text-center">
            <span className="text-xs text-muted-foreground">
              {totalWeeksInMesocycle === 1 
                ? `Week 1 of 1`
                : `Weeks 1-${totalWeeksInMesocycle} of ${totalWeeksInMesocycle}`
              }
            </span>
          </div>
        )}
      </div>

      <ScrollArea className="w-full">
        <div className="flex min-h-[500px]">
          {filteredDays.map((day, idx) => (
            <MasterPlannerColumn
              key={day.dateString}
              day={day}
              weekNumber={startWeekOffset + idx + 1}
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
              onExerciseNotesChange={onExerciseNotesChange}
              onExerciseEachSideChange={onExerciseEachSideChange}
              onExerciseAutoCalcChange={onExerciseAutoCalcChange}
              onDayIntensityChange={onDayIntensityChange}
              onSessionIntensityChange={onSessionIntensityChange}
              intensityLevels={intensityLevels}
              onSectionReorder={onSectionReorder}
              onExerciseReorder={onExerciseReorder}
              onAddSectionToSession={onAddSectionToSession}
              onAddExerciseToSection={onAddExerciseToSection}
              onExerciseDuplicate={onExerciseDuplicate}
              onExerciseDelete={onExerciseDelete}
              onToggleSuperset={onToggleSuperset}
              onSectionDuplicate={onSectionDuplicate}
              onSectionDelete={onSectionDelete}
              onCopySession={onCopySession}
              onDeleteSession={onDeleteSession}
              onPasteSession={onPasteSession}
              copiedSession={copiedSession}
              onCopyDay={onCopyDay}
              onClearDay={onClearDay}
              onPasteDay={onPasteDay}
              copiedDay={copiedDay}
              onAddTestEvent={onAddTestEvent}
              onDeleteTestEvent={onDeleteTestEvent}
              onUpdateTestComment={onUpdateTestComment}
              onUpdateTestValues={onUpdateTestValues}
              onUpdateEventComment={onUpdateEventComment}
              availableTests={availableTests}
              availableEvents={availableEvents}
              allExerciseDistribution={allExerciseDistribution}
              onOpenExerciseDetail={onOpenExerciseDetail}
              onExerciseChange={onExerciseChange}
              selectedAthleteId={selectedAthleteId}
              athletePerformanceParameters={athletePerformanceParameters}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
