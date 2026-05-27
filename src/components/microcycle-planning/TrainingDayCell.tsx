import React, { useState, useRef } from 'react';
import { format, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BorgLevel, BORG_LEVELS, getBorgBg, getBorgFg, getBorgLabel, getBorgLabelFull, migrateLegacyIntensity } from '@/utils/intensityScale';
import { Dumbbell, Trophy, Calendar, GripVertical, MoreVertical, Copy, Trash2, ChevronDown, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { IntensityLevel } from '@/types/training';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { CalendarEventDialog } from '@/components/shared/CalendarEventDialog';
import { useCalendarEvents, CalendarEvent } from '@/hooks/useCalendarEvents';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { AthletePerformanceParameter } from '@/types/athlete';

interface ExerciseDistribution {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
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
}

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  trainingDay?: TrainingDay;
  sessions: {
    id: string;
    sessionIndex: number;
    exercises: ExerciseDistribution[];
    methods: string[];
    sessionIntensity?: IntensityLevel;
    sessionName?: string;
  }[];
  totalExercises: number;
}

interface TrainingDayCellProps {
  day: CalendarDay;
  onSessionClick?: (dayDate: string, sessionIndex: number, exercises: ExerciseDistribution[]) => void;
  onDeleteSession?: (dayDate: string, sessionIndex: number) => void;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  copiedSession?: { exercises: ExerciseDistribution[]; sourceDate: string; sessionIndex: number } | null;

  // Day-level operations
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  // Legacy test/event props — kept for backward compat but ignored; hook handles storage internally
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event', testEventId: string, testEventName: string, isNew: boolean, comments?: string) => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event', name: string) => void;
  onUpdateTestComment?: (testId: string, comments: string) => void;
  onUpdateTestValues?: (testId: string, updates: { preTestValue?: number; goalValue?: number; comments?: string }) => void;
  onUpdateEventComment?: (eventId: string, comments: string) => void;
  copiedDay?: { exercises: ExerciseDistribution[]; sourceDate: string } | null;
  // Legacy — ignored
  availableTests?: unknown[];
  availableEvents?: unknown[];

  // Session reordering
  onMoveSessionUp?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionDown?: (dayDate: string, sessionIndex: number) => void;

  // Add session functionality
  onAddSession?: (dayDate: string) => void;

  dailyIntensityData?: any[];
  onIntensityChange?: (date: string, intensity: IntensityLevel) => void;
  // Athlete context — used to scope tests/events in the new storage
  selectedAthleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
}

export const TrainingDayCell = React.memo(function TrainingDayCell({
  day,
  onSessionClick,
  onDeleteSession,
  onCopySession,
  onPasteSession,
  copiedSession,
  onCopyDay,
  onClearDay,
  copiedDay,
  onMoveSessionUp,
  onMoveSessionDown,
  onAddSession,
  dailyIntensityData,
  onIntensityChange,
  selectedAthleteId,
  athletePerformanceParameters,
  onDeleteTestEvent,
}: TrainingDayCellProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [intensityPopoverOpen, setIntensityPopoverOpen] = useState(false);
  const [calendarEventDialogOpen, setCalendarEventDialogOpen] = useState(false);
  const lastDragEndTime = useRef<number>(0);

  // New independent tests/events storage
  const { getEventsForDate, addEvent, deleteEvent } = useCalendarEvents();
  const { data: parametersData } = useParametersDataV2();
  const parameters = parametersData?.parameters ?? [];
  // Use a stable athlete key: when no athlete is selected we use a fixed
  // per-program key derived from the day's mesocycleId so tests persist
  const eventsAthleteKey = selectedAthleteId || `program-${day.trainingDay?.mesocycleId || 'default'}`;
  const calendarEvents = getEventsForDate(eventsAthleteKey, day.dateString);
  const hookTests = calendarEvents.filter(e => e.type === 'test');
  const hookEventItems = calendarEvents.filter(e => e.type === 'event');

  // Merge plan-level testNames / eventNames from trainingDay into the hook-sourced arrays.
  // These are read-only markers set during macrocycle planning — we create synthetic CalendarEvent
  // objects for any title not already present so they show up in badges and tooltips.
  const hookTestTitles = new Set(hookTests.map(e => e.title));
  const planLevelTests: CalendarEvent[] = (day.trainingDay?.testNames ?? [])
    .filter((name: string) => !hookTestTitles.has(name))
    .map((name: string): CalendarEvent => ({
      id: `plan-test-${day.dateString}-${name}`,
      date: day.dateString,
      type: 'test',
      title: name,
    }));

  const hookEventTitles = new Set(hookEventItems.map(e => e.title));
  const planLevelEvents: CalendarEvent[] = (day.trainingDay?.eventNames ?? [])
    .filter((name: string) => !hookEventTitles.has(name))
    .map((name: string): CalendarEvent => ({
      id: `plan-event-${day.dateString}-${name}`,
      date: day.dateString,
      type: 'event',
      title: name,
    }));

  const calendarTests = [...hookTests, ...planLevelTests];
  const calendarEventItems = [...hookEventItems, ...planLevelEvents];

  const hasTraining = day.sessions.length > 0;
  const isTestDay = calendarTests.length > 0;
  const isEventDay = calendarEventItems.length > 0;
  const isRestDay = !hasTraining && day.trainingDay?.isTrainingDay === false;
  const isTodayDate = isToday(day.date);
  const isSpecialDay = isTestDay || isEventDay;

  // Get current intensity for this day — migrate legacy values on read
  const currentIntensity: IntensityLevel = migrateLegacyIntensity(
    dailyIntensityData?.find(di => di.date === day.dateString)?.intensity
  ) as IntensityLevel;

  // Get primary method name (first method from first session)
  const primaryMethod = day.sessions[0]?.methods[0]?.split(' - ')[0] || '';

  // Compute display label with fallback — use live parameterId lookup for tests
  const firstTest = calendarTests[0];
  const displayLabel = firstTest
    ? (firstTest.parameterId
        ? (parameters.find(p => p.id === firstTest.parameterId)?.name ?? firstTest.title)
        : firstTest.title)
    : calendarEventItems[0]?.title ?? (isTestDay ? 'Test' : isEventDay ? 'Event' : '');

  return (
    <>
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "min-h-[140px] border rounded-lg p-3 transition-all relative",
        day.isCurrentMonth ? "bg-card" : "bg-muted/30",
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

      {/* Day Number + Test/Event Name */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Day Number with Red Ring for Special Days */}
          <div
            className={cn(
              "text-sm font-medium flex items-center justify-center shrink-0",
              isTodayDate && "bg-black text-white rounded-full w-7 h-7",
              !isTodayDate && isSpecialDay && "rounded-full w-7 h-7",
              !isTodayDate && !day.isCurrentMonth && "text-muted-foreground",
              !isTodayDate && hasTraining && !isSpecialDay && "text-primary font-semibold"
            )}
          >
            {format(day.date, 'd')}
          </div>

          {/* Intensity Indicator - Moved next to day number */}
          {onIntensityChange && (
            <Popover open={intensityPopoverOpen} onOpenChange={setIntensityPopoverOpen}>
              <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button
                  className="w-5 h-5 rounded-sm border transition-all hover:scale-110 cursor-pointer shrink-0"
                  style={{ backgroundColor: getBorgBg(currentIntensity as BorgLevel) }}
                  title={`Intensity: ${getBorgLabelFull(currentIntensity as BorgLevel)}`}
                />
              </PopoverTrigger>
              <PopoverContent
                className="w-48 p-2 z-[100] bg-popover"
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">Select Intensity</p>
                  {BORG_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={(e) => {
                        e.stopPropagation();
                        onIntensityChange(day.dateString, level as IntensityLevel);
                        setIntensityPopoverOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left",
                        level === currentIntensity && "bg-accent"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-sm border shrink-0"
                        style={{ backgroundColor: getBorgBg(level) }}
                      />
                      <span className="text-xs">{getBorgLabelFull(level)}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

        </div>

        {/* Status Icons with Hover Tooltips */}
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
                      const displayName = ev.parameterId
                        ? (parameters.find(p => p.id === ev.parameterId)?.name ?? ev.title)
                        : ev.title;
                      return (
                        <div key={ev.id}>
                          • {displayName}
                          {ev.targetValue && (
                            <span className="ml-1 text-muted-foreground/70">→ {ev.targetValue}</span>
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

          {/* Day-level Menu (3-dot) */}
          {day.isCurrentMonth && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors">
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-[100]">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onCopyDay?.(day.dateString);
                }}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy day
                </DropdownMenuItem>

                {hasTraining && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearDay?.(day.dateString);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear day
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  setCalendarEventDialogOpen(true);
                }}>
                  <Trophy className="mr-2 h-4 w-4" />
                  Manage tests/events
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Training Content */}
      {hasTraining ? (
        <>
          <Droppable droppableId={`day-${day.dateString}`} type="session" direction="vertical">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "space-y-2 min-h-[60px]",
                  snapshot.isDraggingOver && "bg-primary/5 rounded-md p-1"
                )}
              >
                {/* Session Indicators */}
                {day.sessions.map((session, idx) => (
                  <Draggable
                    key={`session-${session.id}`}
                    draggableId={`session-${session.id}`}
                    index={idx}
                  >
                    {(provided, snapshot) => {
                      // Track when drag ends
                      if (!snapshot.isDragging && snapshot.draggingOver === null) {
                        lastDragEndTime.current = Date.now();
                      }
                      
                      return (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={provided.draggableProps.style}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Ignore clicks within 200ms of drag ending
                          if (Date.now() - lastDragEndTime.current < 200) {
                            return;
                          }
                          onSessionClick?.(day.dateString, session.sessionIndex, session.exercises);
                        }}
                        className={cn(
                          "p-2 rounded-md bg-primary/10 border border-primary/20 transition-all cursor-pointer hover:bg-primary/15 overflow-hidden",
                          snapshot.isDragging && "shadow-lg ring-2 ring-primary opacity-90"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing shrink-0">
                              <GripVertical className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </div>
                            <Dumbbell className="h-3 w-3 text-primary shrink-0" />
                            <span
                              className="text-xs font-medium text-primary truncate min-w-0 flex-1"
                              title={session.sessionName || `Session ${idx + 1}`}
                            >
                              {session.sessionName || `Session ${idx + 1}`}
                            </span>
                            
                            {/* Session Intensity Indicator */}
                            {session.sessionIntensity && (
                              <div
                                className="w-3.5 h-3.5 rounded-sm border shrink-0"
                                style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(session.sessionIntensity)) }}
                                title={`Session intensity: ${getBorgLabelFull(migrateLegacyIntensity(session.sessionIntensity))}`}
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-0.5">
                            {/* Up/Down arrows - only show if multiple sessions */}
                            {day.sessions.length > 1 && (
                              <>
                                {/* Up arrow - hide for first session */}
                                {idx > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMoveSessionUp?.(day.dateString, session.sessionIndex);
                                    }}
                                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/20 transition-colors"
                                    title="Move session up"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                )}
                                
                                {/* Down arrow - hide for last session */}
                                {idx < day.sessions.length - 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMoveSessionDown?.(day.dateString, session.sessionIndex);
                                    }}
                                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/20 transition-colors"
                                    title="Move session down"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                )}
                              </>
                            )}

                            {/* Three-dot menu */}
                            <DropdownMenu
                              open={openDropdownId === `${day.dateString}-${session.sessionIndex}`}
                              onOpenChange={(open) => {
                                setOpenDropdownId(open ? `${day.dateString}-${session.sessionIndex}` : null);
                              }}
                            >
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/20 transition-colors">
                                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onCopySession?.(day.dateString, session.sessionIndex);
                                setOpenDropdownId(null);
                              }}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy session
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSession?.(day.dateString, session.sessionIndex);
                                  setOpenDropdownId(null);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete session
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        {/* Primary Method Name */}
                        {session.methods[0] && (
                          <p className="text-xs font-medium truncate mb-0.5 ml-5">
                            {session.methods[0].split(' - ')[0]}
                          </p>
                        )}

                      </div>
                      );
                    }}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Add Session Button - shown on hover */}
          {isHovering && onAddSession && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onAddSession(day.dateString);
              }}
              variant="ghost"
              size="icon"
              className="w-full mt-1 h-7"
              title="Add session"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </>
      ) : isRestDay ? (
        <Droppable droppableId={`day-${day.dateString}`} type="session">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex flex-col items-center justify-center min-h-[60px]",
                snapshot.isDraggingOver && "bg-primary/5 rounded-md"
              )}
            >
              {snapshot.isDraggingOver ? (
                <span className="text-xs text-muted-foreground">Drop here</span>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">Rest</span>
                  {isHovering && onAddSession && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSession(day.dateString);
                      }}
                      variant="ghost"
                      size="icon"
                      className="mt-2 h-7 w-7"
                      title="Add session"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      ) : (
        <Droppable droppableId={`day-${day.dateString}`} type="session">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "min-h-[60px] flex flex-col items-center justify-center",
                snapshot.isDraggingOver && "bg-primary/5 rounded-md"
              )}
            >
              {snapshot.isDraggingOver ? (
                <span className="text-xs text-muted-foreground">Drop here</span>
              ) : (
                onAddSession && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSession(day.dateString);
                    }}
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    title="Add session"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}

      {/* Universal Paste Buttons - shown on hover for any day type */}
      {isHovering && day.isCurrentMonth && (
        <div className="mt-2 space-y-2">
          {copiedSession && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onPasteSession?.(day.dateString);
              }}
              className="w-full"
              variant="default"
              size="sm"
            >
              <Copy className="mr-2 h-4 w-4" />
              Paste Session ({copiedSession.exercises.length} exercise{copiedSession.exercises.length !== 1 ? 's' : ''})
            </Button>
          )}
          
          {copiedDay && !copiedSession && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onPasteSession?.(day.dateString);
              }}
              className="w-full"
              variant="default"
              size="sm"
            >
              <Copy className="mr-2 h-4 w-4" />
              Paste Day ({copiedDay.exercises.length} exercise{copiedDay.exercises.length !== 1 ? 's' : ''})
            </Button>
          )}
        </div>
      )}
    </div>

    {/* Calendar Test/Event Dialog */}
      <CalendarEventDialog
        open={calendarEventDialogOpen}
        onOpenChange={setCalendarEventDialogOpen}
        date={day.dateString}
        events={[...calendarTests, ...calendarEventItems]}
        onAdd={(type, title, notes, parameterId, targetValue) => {
          addEvent(eventsAthleteKey, { date: day.dateString, type, title, notes, parameterId, targetValue });
        }}
        onDelete={(eventId) => {
          const planTestPrefix = `plan-test-${day.dateString}-`;
          const planEventPrefix = `plan-event-${day.dateString}-`;
          if (eventId.startsWith(planTestPrefix)) {
            const name = eventId.slice(planTestPrefix.length);
            onDeleteTestEvent?.(day.dateString, 'test', name);
          } else if (eventId.startsWith(planEventPrefix)) {
            const name = eventId.slice(planEventPrefix.length);
            onDeleteTestEvent?.(day.dateString, 'event', name);
          } else {
            deleteEvent(eventsAthleteKey, eventId);
          }
        }}
        athletePerformanceParameters={athletePerformanceParameters}
      />
    </>
  );
});
// Note: No custom comparison - the component uses useCalendarEvents internally,
// which updates React state via useLocalStorage when events change. A custom memo
// comparison would prevent those re-renders from showing updated test/event badges.
