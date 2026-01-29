import React from 'react';
import { format, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dumbbell, Trophy, Calendar, Plus, MoreVertical, Trash2, CalendarPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';

export interface AthleteCalendarSession {
  id: string;
  sessionIndex: number;
  sessionName: string;
  exerciseCount: number;
  intensity?: string;
  assignmentId?: string;
}

export interface AthleteCalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  sessions: AthleteCalendarSession[];
  testNames?: string[];
  eventNames?: string[];
  assignmentId?: string;
  programName?: string;
}

interface AthleteCalendarDayCellProps {
  day: AthleteCalendarDay;
  onSessionClick?: (dayDate: string, sessionIndex: number, assignmentId: string) => void;
  onDayClick?: (date: Date) => void;
  onAddSession?: (date: Date) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  getIntensityColor?: (intensity: string) => string;
}

export function AthleteCalendarDayCell({
  day,
  onSessionClick,
  onDayClick,
  onAddSession,
  onDeleteAssignment,
  getIntensityColor,
}: AthleteCalendarDayCellProps) {
  const hasTraining = day.sessions.length > 0;
  const isTestDay = day.testNames && day.testNames.length > 0;
  const isEventDay = day.eventNames && day.eventNames.length > 0;
  const isTodayDate = isToday(day.date);
  const isSpecialDay = isTestDay || isEventDay;

  return (
    <div
      className={cn(
        "min-h-[140px] border rounded-lg p-3 transition-all relative",
        "bg-card",
        !hasTraining && "cursor-default",
        isSpecialDay && "border-red-500 border-2"
      )}
    >
      {/* Day Number + Status Icons */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Day Number */}
          <div
            className={cn(
              "text-sm font-medium flex items-center justify-center shrink-0",
              isTodayDate && "bg-primary text-primary-foreground rounded-full w-7 h-7",
              !isTodayDate && isSpecialDay && "rounded-full w-7 h-7",
              
              !isTodayDate && hasTraining && !isSpecialDay && "text-primary font-semibold"
            )}
          >
            {format(day.date, 'd')}
          </div>

          {/* First Session Intensity Indicator */}
          {hasTraining && day.sessions[0]?.intensity && getIntensityColor && (
            <div
              className={cn(
                "w-5 h-5 rounded-sm border shrink-0",
                getIntensityColor(day.sessions[0].intensity)
              )}
              title={`Intensity: ${day.sessions[0].intensity.replace('-', ' ')}`}
            />
          )}
        </div>

        {/* Status Icons */}
        <div className="flex gap-1 items-start">
          {isTestDay && (
            <HoverCard openDelay={100}>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer">
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    <Trophy className="h-3 w-3" />
                  </Badge>
                </div>
              </HoverCardTrigger>
              <HoverCardContent
                className="w-auto max-w-xs p-3 z-[200]"
                side="top"
                align="center"
                sideOffset={5}
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    {day.testNames!.length > 1 ? 'Tests:' : 'Test:'}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {day.testNames!.map((testName, idx) => (
                      <div key={idx}>• {testName}</div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}

          {isEventDay && (
            <HoverCard openDelay={100}>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer">
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    <Calendar className="h-3 w-3" />
                  </Badge>
                </div>
              </HoverCardTrigger>
              <HoverCardContent
                className="w-auto max-w-xs p-3 z-[200]"
                side="top"
                align="center"
                sideOffset={5}
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    {day.eventNames!.length > 1 ? 'Events:' : 'Event:'}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {day.eventNames!.map((eventName, idx) => (
                      <div key={idx}>• {eventName}</div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}

          {/* Day-level Menu */}
          {day.assignmentId && onDeleteAssignment && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors">
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-[100]">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAssignment(day.assignmentId!);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove assignment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Training Content */}
      {hasTraining ? (
        <div className="space-y-2">
          {day.sessions.map((session, idx) => (
            <div
              key={session.id}
              onClick={(e) => {
                e.stopPropagation();
                onSessionClick?.(day.dateString, session.sessionIndex, session.assignmentId || day.assignmentId || '');
              }}
              className={cn(
                "p-2 rounded-md bg-primary/10 border border-primary/20 transition-all cursor-pointer hover:bg-primary/15"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Dumbbell className="h-3 w-3 text-primary" />
                  <span
                    className="text-xs font-medium text-primary truncate max-w-[100px]"
                    title={session.sessionName}
                  >
                    {session.sessionName}
                  </span>

                  {/* Session Intensity Indicator */}
                  {session.intensity && getIntensityColor && (
                    <div
                      className={cn(
                        "w-3.5 h-3.5 rounded-sm border shrink-0",
                        getIntensityColor(session.intensity)
                      )}
                      title={`Session intensity: ${session.intensity.replace('-', ' ')}`}
                    />
                  )}
                </div>

                {/* Exercise Count Badge */}
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {session.exerciseCount}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty Day - Show Add Dropdown */
        <div className="flex flex-col items-center justify-center h-[calc(100%-40px)]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                title="Add to calendar"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="z-[100] bg-background">
              <DropdownMenuItem onClick={() => onDayClick?.(day.date)}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                Assign Program
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddSession?.(day.date)}>
                <Dumbbell className="mr-2 h-4 w-4" />
                Add Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
