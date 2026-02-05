import { format } from 'date-fns';
import React from 'react';
import { AthleteCalendarDayCell, AthleteCalendarDay } from './AthleteCalendarDayCell';
import { Button } from '@/components/ui/button';
import { MoreVertical, Copy, Trash2, ClipboardPaste } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExerciseDistribution, SessionSection } from '@/types/microcycle-planning';
import { SubGoal, Event, IntensityLevel } from '@/types/training';
import { AthletePerformanceParameter } from '@/types/athlete';

interface CopiedWeekInfo {
  exercises: ExerciseDistribution[];
  weekStartDate: string;
}

interface CopiedDayInfo {
  exercises: ExerciseDistribution[];
  sourceDate: string;
}

interface CopiedSessionInfo {
  exercises: ExerciseDistribution[];
  sourceDate: string;
  sessionIndex: number;
}

interface AthleteCalendarWeekRowProps {
  week: AthleteCalendarDay[];
  weekIdx: number;
  onSessionClick?: (dayDate: string, sessionIndex: number, assignmentId: string) => void;
  onDayClick?: (date: Date) => void;
  onAddSession?: (date: Date) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  getIntensityColor?: (intensity: string) => string;
  // Week operations
  copiedWeek?: CopiedWeekInfo | null;
  onCopyWeek?: (weekStartDate: string) => void;
  onClearWeek?: (weekStartDate: string) => void;
  onPasteWeek?: (weekStartDate: string) => void;
  // Day operations
  copiedDay?: CopiedDayInfo | null;
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  onPasteDay?: (dayDate: string) => void;
  // Session operations
  copiedSession?: CopiedSessionInfo | null;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onDeleteSession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  // Test/Event operations
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event', id: string, name: string, isNew: boolean, comments?: string) => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event', name: string) => void;
  availableTests?: SubGoal[];
  availableEvents?: Event[];
  // Intensity editing
  intensityLevels?: IntensityLevel[];
  onIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  // Ref-based drag end timestamp for click suppression (sync update, not state)
  lastDragEndRef?: React.MutableRefObject<number>;
  // Athlete context for baseline auto-fill
  athleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
}

export function AthleteCalendarWeekRow({
  week,
  weekIdx,
  onSessionClick,
  onDayClick,
  onAddSession,
  onDeleteAssignment,
  getIntensityColor,
  copiedWeek,
  onCopyWeek,
  onClearWeek,
  onPasteWeek,
  copiedDay,
  onCopyDay,
  onClearDay,
  onPasteDay,
  copiedSession,
  onCopySession,
  onDeleteSession,
  onPasteSession,
  onAddTestEvent,
  onDeleteTestEvent,
  availableTests,
  availableEvents,
  intensityLevels,
  onIntensityChange,
  lastDragEndRef,
  athleteId,
  athletePerformanceParameters,
}: AthleteCalendarWeekRowProps) {
  const weekStartDate = format(week[0].date, 'yyyy-MM-dd');
  const hasExercisesInWeek = week.some(day => day.sessions.length > 0);

  return (
    <div className="space-y-2 group/week">
      {/* Week Header */}
      <div className="flex items-center gap-2 pl-1 min-h-[32px]">
        {/* Week Dropdown Menu - Now on the left */}
        <div>
          {(onCopyWeek || onClearWeek) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[100]">
                {onCopyWeek && hasExercisesInWeek && (
                  <DropdownMenuItem onClick={() => onCopyWeek(weekStartDate)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy week
                  </DropdownMenuItem>
                )}
                {onClearWeek && hasExercisesInWeek && (
                  <DropdownMenuItem 
                    onClick={() => onClearWeek(weekStartDate)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear week
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground flex-1">
          Week of {format(week[0].date, 'MMM d')}
        </div>
        
        {/* Paste Week Button - on the right */}
        <div>
          {copiedWeek && onPasteWeek && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onPasteWeek(weekStartDate)}
              className="h-6 px-2 text-xs gap-1"
            >
              <Copy className="h-3 w-3" />
              Paste Week ({copiedWeek.exercises.length})
            </Button>
          )}
        </div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {week.map(day => (
          <AthleteCalendarDayCell
            key={day.dateString}
            day={day}
            onSessionClick={onSessionClick}
            onDayClick={onDayClick}
            onAddSession={onAddSession}
            onDeleteAssignment={onDeleteAssignment}
            getIntensityColor={getIntensityColor}
            copiedDay={copiedDay}
            onCopyDay={onCopyDay}
            onClearDay={onClearDay}
            onPasteDay={onPasteDay}
            copiedSession={copiedSession}
            onCopySession={onCopySession}
            onDeleteSession={onDeleteSession}
            onPasteSession={onPasteSession}
            onAddTestEvent={onAddTestEvent}
            onDeleteTestEvent={onDeleteTestEvent}
            availableTests={availableTests}
            availableEvents={availableEvents}
            intensityLevels={intensityLevels}
            onIntensityChange={onIntensityChange}
            lastDragEndRef={lastDragEndRef}
            athleteId={athleteId}
            athletePerformanceParameters={athletePerformanceParameters}
          />
        ))}
      </div>
    </div>
  );
}
