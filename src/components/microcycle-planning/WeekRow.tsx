import { useState } from 'react';
import { format } from 'date-fns';
import { Copy, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntensityLevel, SubGoal, Event } from '@/types/training';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TrainingDayCell } from './TrainingDayCell';

interface ExerciseDistribution {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
}

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  trainingDay?: any;
  sessions: {
    id: string;
    sessionIndex: number;
    exercises: ExerciseDistribution[];
    methods: string[];
  }[];
  totalExercises: number;
}

interface WeekRowProps {
  week: CalendarDay[];
  weekIdx: number;
  copiedWeek?: { exercises: ExerciseDistribution[]; weekStartDate: string } | null;
  copiedSession?: any;
  copiedDay?: { exercises: ExerciseDistribution[]; sourceDate: string } | null;
  onCopyWeek?: (weekStartDate: string) => void;
  onClearWeek?: (weekStartDate: string) => void;
  onPasteWeek?: (weekStartDate: string) => void;
  onSessionClick?: (dayDate: string, sessionIndex: number, exercises: ExerciseDistribution[]) => void;
  onDeleteSession?: (dayDate: string, sessionIndex: number) => void;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event', testEventId: string, testEventName: string, isNew: boolean, comments?: string) => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event', name: string) => void;
  onUpdateTestComment?: (testId: string, comments: string) => void;
  onUpdateEventComment?: (eventId: string, comments: string) => void;
  availableTests?: SubGoal[];
  availableEvents?: Event[];
  dailyIntensityData?: any[];
  onIntensityChange?: (date: string, intensity: IntensityLevel) => void;
  getIntensityColor?: (intensity: IntensityLevel) => string;
  intensityLevels?: IntensityLevel[];
}

export function WeekRow({
  week,
  weekIdx,
  copiedWeek,
  copiedSession,
  copiedDay,
  onCopyWeek,
  onClearWeek,
  onPasteWeek,
  onSessionClick,
  onDeleteSession,
  onCopySession,
  onPasteSession,
  onCopyDay,
  onClearDay,
  onAddTestEvent,
  onDeleteTestEvent,
  onUpdateTestComment,
  onUpdateEventComment,
  availableTests,
  availableEvents,
  dailyIntensityData,
  onIntensityChange,
  getIntensityColor,
  intensityLevels,
}: WeekRowProps) {
  const [isWeekHovering, setIsWeekHovering] = useState(false);
  const weekStartDate = week[0]?.dateString;

  return (
    <div
      className="space-y-2"
      onMouseEnter={() => setIsWeekHovering(true)}
      onMouseLeave={() => setIsWeekHovering(false)}
    >
      {/* Week Header with Menu and Paste Button */}
      <div className="flex items-center gap-2 pl-1 min-h-[32px]">
        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => onCopyWeek?.(weekStartDate)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy week
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onClearWeek?.(weekStartDate)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear week
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Week label */}
        <div className="text-xs text-muted-foreground flex-1">
          Week of {format(week[0].date, 'MMM d')}
        </div>

        {/* Paste Week button - appears on hover when week is copied */}
        {isWeekHovering && copiedWeek && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onPasteWeek?.(weekStartDate);
            }}
            variant="default"
            size="sm"
            className="ml-auto"
          >
            <Copy className="mr-2 h-4 w-4" />
            Paste Week
          </Button>
        )}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {week.map(day => (
          <TrainingDayCell
            key={day.dateString}
            day={day}
            onSessionClick={onSessionClick}
            onDeleteSession={onDeleteSession}
            onCopySession={onCopySession}
            onPasteSession={onPasteSession}
            copiedSession={copiedSession}
            onCopyDay={onCopyDay}
            onClearDay={onClearDay}
            onAddTestEvent={onAddTestEvent}
            onDeleteTestEvent={onDeleteTestEvent}
            onUpdateTestComment={onUpdateTestComment}
            onUpdateEventComment={onUpdateEventComment}
            copiedDay={copiedDay}
            availableTests={availableTests}
            availableEvents={availableEvents}
            dailyIntensityData={dailyIntensityData}
            onIntensityChange={onIntensityChange}
            getIntensityColor={getIntensityColor}
            intensityLevels={intensityLevels}
          />
        ))}
      </div>
    </div>
  );
}
