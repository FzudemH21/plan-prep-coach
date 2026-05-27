import React, { useState } from 'react';
import { format, isToday } from 'date-fns';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { BORG_LEVELS, getBorgBg, getBorgFg, getBorgLabelFull, migrateLegacyIntensity } from '@/utils/intensityScale';
import { Dumbbell, Trophy, Calendar, Plus, MoreVertical, Trash2, CalendarPlus, Copy, ClipboardPaste, Settings, GripVertical } from 'lucide-react';
import { IntensityLevel } from '@/types/training';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { CalendarEventDialog } from '@/components/shared/CalendarEventDialog';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { ExerciseDistribution } from '@/types/microcycle-planning';
import { AthletePerformanceParameter } from '@/types/athlete';

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
  intensity?: IntensityLevel; // NEW: Day-level intensity for the overview square
  // Pre-fetched from parent's useCalendarEvents instance so new events added
  // during the session are visible immediately without a page reload
  calendarEvents?: import('@/hooks/useCalendarEvents').CalendarEvent[];
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

interface AthleteCalendarDayCellProps {
  day: AthleteCalendarDay;
  onSessionClick?: (dayDate: string, sessionIndex: number, assignmentId: string) => void;
  onDayClick?: (date: Date) => void;
  onAddSession?: (date: Date) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
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
  // Intensity editing
  onIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  // Ref-based drag end timestamp for click suppression (sync update, not state)
  lastDragEndRef?: React.MutableRefObject<number>;
  // Athlete context — required for tests/events storage
  athleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
  // Parent-owned event callbacks — use these so mutations go through the
  // authoritative hook instance, not the DayCell's own stale store.
  onAddCalendarEvent?: (athleteId: string, event: Omit<import('@/hooks/useCalendarEvents').CalendarEvent, 'id'>) => void;
  onDeleteCalendarEvent?: (athleteId: string, eventId: string) => void;
}

export function AthleteCalendarDayCell({
  day,
  onSessionClick,
  onDayClick,
  onAddSession,
  onDeleteAssignment,
  copiedDay,
  onCopyDay,
  onClearDay,
  onPasteDay,
  copiedSession,
  onCopySession,
  onDeleteSession,
  onPasteSession,
  onIntensityChange,
  lastDragEndRef,
  athleteId,
  athletePerformanceParameters,
  onAddCalendarEvent,
  onDeleteCalendarEvent,
}: AthleteCalendarDayCellProps) {
  const [testEventDialogOpen, setTestEventDialogOpen] = useState(false);
  const [intensityPopoverOpen, setIntensityPopoverOpen] = useState(false);

  // New independent tests/events storage
  const { getEventsForDate, addEvent, deleteEvent } = useCalendarEvents();
  const { data: parametersData } = useParametersDataV2();
  const parameters = parametersData?.parameters ?? [];
  // Prefer events passed from the parent (single shared store instance) so that
  // events added during the session are visible immediately without a page reload.
  const calendarEvents = day.calendarEvents ?? (athleteId
    ? getEventsForDate(athleteId, day.dateString)
    : []);
  const calendarTests = calendarEvents.filter(e => e.type === 'test');
  const calendarEventItems = calendarEvents.filter(e => e.type === 'event');

  const hasTraining = day.sessions.length > 0;
  const isTestDay = calendarTests.length > 0;
  const isEventDay = calendarEventItems.length > 0;
  const isTodayDate = isToday(day.date);
  const isSpecialDay = isTestDay || isEventDay;

  return (
    <>
      <div
        className={cn(
          "min-h-[140px] border rounded-lg p-2 transition-all relative group/day overflow-hidden",
          "bg-card",
          !hasTraining && "cursor-default",
          isTestDay && !isEventDay && "border-2 border-amber-500",
          !isTestDay && isEventDay && "border-2 border-blue-500",
        )}
        style={isTestDay && isEventDay ? {
          border: '2px solid transparent',
          backgroundImage: 'linear-gradient(hsl(var(--card)), hsl(var(--card))), linear-gradient(to right, #f59e0b 50%, #3b82f6 50%)',
          backgroundOrigin: 'padding-box, border-box',
          backgroundClip: 'padding-box, border-box',
        } : undefined}
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

            {/* Day Intensity Indicator - Clickable (uses day.intensity, NOT session 0 intensity) */}
            {hasTraining && day.intensity && onIntensityChange ? (
              <Popover open={intensityPopoverOpen} onOpenChange={setIntensityPopoverOpen}>
                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    className="w-5 h-5 rounded-sm border transition-all hover:scale-110 cursor-pointer shrink-0"
                    style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(day.intensity)) }}
                    title={`Day Intensity: ${getBorgLabelFull(migrateLegacyIntensity(day.intensity))}`}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 z-[100]" align="end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium mb-2 text-muted-foreground">Select Day Intensity</p>
                    {BORG_LEVELS.map((level) => (
                      <button
                        key={level}
                        onClick={(e) => {
                          e.stopPropagation();
                          onIntensityChange(day.dateString, level as IntensityLevel);
                          setIntensityPopoverOpen(false);
                        }}
                        className={cn("w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left", level === migrateLegacyIntensity(day.intensity) && "bg-accent")}
                      >
                        <div className="w-3 h-3 rounded-sm border shrink-0" style={{ backgroundColor: getBorgBg(level) }} />
                        <span className="text-xs">{getBorgLabelFull(level)}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : hasTraining && day.intensity ? (
              <div
                className="w-5 h-5 rounded-sm border shrink-0"
                style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(day.intensity)) }}
                title={`Day Intensity: ${getBorgLabelFull(migrateLegacyIntensity(day.intensity))}`}
              />
            ) : null}
          </div>

          {/* Status Icons + Day Menu */}
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
                      {calendarTests.length > 1 ? 'Tests:' : 'Test:'}
                    </p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {calendarTests.map(ev => {
                        const param = ev.parameterId ? parameters.find(p => p.id === ev.parameterId) : undefined;
                        const displayName = param?.name ?? ev.title;
                        return (
                          <div key={ev.id}>
                            • {displayName}
                            {ev.targetValue && (
                              <span className="ml-1 text-muted-foreground/70">
                                → {ev.targetValue}{param?.unit ? ` ${param.unit}` : ''}
                              </span>
                            )}
                            {ev.notes && (
                              <span className="ml-1 text-muted-foreground/70">({ev.notes})</span>
                            )}
                          </div>
                        );
                      })}
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
                      {calendarEventItems.length > 1 ? 'Events:' : 'Event:'}
                    </p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {calendarEventItems.map(ev => (
                        <div key={ev.id}>
                          • {ev.title}
                          {ev.notes && (
                            <span className="ml-1 text-muted-foreground/70">({ev.notes})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}

            {/* Day-level Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors">
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-[100]">
                {/* Assign Program */}
                {onDayClick && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(day.date);
                    }}
                  >
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Assign program
                  </DropdownMenuItem>
                )}

                {/* Add Session */}
                {onAddSession && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSession(day.date);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add session
                  </DropdownMenuItem>
                )}

                {(onDayClick || onAddSession) && <DropdownMenuSeparator />}

                {/* Copy Day */}
                {onCopyDay && hasTraining && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyDay(day.dateString);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy day
                  </DropdownMenuItem>
                )}
                
                {/* Paste Session */}
                {onPasteSession && copiedSession && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onPasteSession(day.dateString);
                    }}
                  >
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Paste session ({copiedSession.exercises.length})
                  </DropdownMenuItem>
                )}

                {/* Paste Day */}
                {onPasteDay && copiedDay && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onPasteDay(day.dateString);
                    }}
                  >
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Paste day ({copiedDay.exercises.length})
                  </DropdownMenuItem>
                )}
                
                {/* Clear Day */}
                {onClearDay && hasTraining && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearDay(day.dateString);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear day
                  </DropdownMenuItem>
                )}
                
                {/* Separator before test/event management */}
                {(hasTraining || copiedDay) && <DropdownMenuSeparator />}

                {/* Manage Tests/Events */}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setTestEventDialogOpen(true);
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage tests/events
                </DropdownMenuItem>
                
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Training Content */}
        {hasTraining ? (
          <Droppable droppableId={day.dateString} type="session">
            {(droppableProvided, droppableSnapshot) => (
              <div 
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                className={cn(
                  "space-y-2 min-h-[80px] flex-1",
                  droppableSnapshot.isDraggingOver && "bg-primary/5 rounded-md p-2 border-2 border-dashed border-primary/30"
                )}
              >
                {day.sessions.map((session, idx) => (
                  <Draggable
                    key={session.id}
                    draggableId={session.id}
                    index={idx}
                  >
                  {(draggableProvided, draggableSnapshot) => {
                    return (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          style={draggableProvided.draggableProps.style}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Suppress clicks right after drag ends (using ref for synchronous check)
                            // Increased to 500ms for more reliable suppression on slower devices/trackpads
                            const dragEndTime = lastDragEndRef?.current ?? 0;
                            if (Date.now() - dragEndTime < 500) return;
                            onSessionClick?.(day.dateString, session.sessionIndex, session.assignmentId || day.assignmentId || '');
                          }}
                          className={cn(
                            "p-2 rounded-md bg-primary/10 border border-primary/20 transition-all cursor-pointer hover:bg-primary/15 overflow-hidden",
                            draggableSnapshot.isDragging && "shadow-lg ring-2 ring-primary opacity-90"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              {/* Drag Handle */}
                              <div {...draggableProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing shrink-0">
                                <GripVertical className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </div>
                              <Dumbbell className="h-3 w-3 text-primary shrink-0" />
                              <span
                                className="text-xs font-medium text-primary truncate min-w-0 flex-1"
                                title={session.sessionName}
                              >
                                {session.sessionName}
                              </span>

                              {/* Session Intensity Indicator */}
                              {session.intensity && (
                                <div
                                  className="w-3 h-3 rounded-sm border shrink-0"
                                  style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(session.intensity)) }}
                                  title={`Session intensity: ${getBorgLabelFull(migrateLegacyIntensity(session.intensity))}`}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              {/* Session Menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors">
                                    <MoreVertical className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 z-[100]">
                                  {onCopySession && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onCopySession(day.dateString, session.sessionIndex);
                                      }}
                                    >
                                      <Copy className="mr-2 h-4 w-4" />
                                      Copy session
                                    </DropdownMenuItem>
                                  )}
                                  {onDeleteSession && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSession(day.dateString, session.sessionIndex);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete session
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </Draggable>
                ))}
                {droppableProvided.placeholder}
            
                {/* Paste Day Button (below existing sessions) */}
                {copiedDay && onPasteDay && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPasteDay(day.dateString);
                    }}
                    className="w-full h-7 text-xs opacity-0 group-hover/day:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Paste Day ({copiedDay.exercises.length})
                  </Button>
                )}

                {/* Paste Session Button (below existing sessions) */}
                {copiedSession && onPasteSession && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPasteSession(day.dateString);
                    }}
                    className="w-full h-7 text-xs opacity-0 group-hover/day:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Paste Session ({copiedSession.exercises.length})
                  </Button>
                )}
              </div>
            )}
          </Droppable>
        ) : (
          /* Empty Day - Wrap with Droppable so sessions can be dropped here */
          <Droppable droppableId={day.dateString} type="session">
            {(droppableProvided, droppableSnapshot) => (
              <div 
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                className={cn(
                  "flex flex-col items-center justify-center h-[calc(100%-40px)] gap-2 min-h-[80px]",
                  droppableSnapshot.isDraggingOver && "bg-primary/10 rounded-md border-2 border-dashed border-primary/40"
                )}
              >
                {droppableSnapshot.isDraggingOver ? (
                  /* Drop hint when dragging over empty day */
                  <div className="text-xs text-primary font-medium">
                    Drop session here
                  </div>
                ) : (
                  /* Normal empty day content */
                  <>
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
                    
                    {/* Paste buttons for empty days */}
                    {copiedDay && onPasteDay && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPasteDay(day.dateString);
                        }}
                        className="h-6 px-2 text-xs opacity-0 group-hover/day:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Paste Day
                      </Button>
                    )}
                    
                    {copiedSession && onPasteSession && !copiedDay && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPasteSession(day.dateString);
                        }}
                        className="h-6 px-2 text-xs opacity-0 group-hover/day:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Paste Session
                      </Button>
                    )}
                  </>
                )}
                {droppableProvided.placeholder}
              </div>
            )}
          </Droppable>
        )}
      </div>

      {/* Test/Event Dialog */}
      <CalendarEventDialog
        open={testEventDialogOpen}
        onOpenChange={setTestEventDialogOpen}
        date={day.dateString}
        events={calendarEvents}
        onAdd={(type, title, notes, parameterId, targetValue) => {
          if (athleteId) {
            const payload = { date: day.dateString, type, title, notes, parameterId, targetValue };
            if (onAddCalendarEvent) onAddCalendarEvent(athleteId, payload);
            else addEvent(athleteId, payload);
          }
        }}
        onDelete={(eventId) => {
          if (athleteId) {
            if (onDeleteCalendarEvent) onDeleteCalendarEvent(athleteId, eventId);
            else deleteEvent(athleteId, eventId);
          }
        }}
        athletePerformanceParameters={athletePerformanceParameters}
      />
    </>
  );
}
