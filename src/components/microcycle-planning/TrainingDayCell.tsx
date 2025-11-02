import React, { useState } from 'react';
import { format, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dumbbell, Trophy, Calendar, GripVertical, MoreVertical, Copy, Trash2, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { IntensityLevel, SubGoal, Event } from '@/types/training';
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
import { CombinedTestEventDialog } from './CombinedTestEventDialog';

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
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event', testEventId: string, testEventName: string, isNew: boolean, comments?: string) => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event', name: string) => void;
  onUpdateTestComment?: (testId: string, comments: string) => void;
  onUpdateEventComment?: (eventId: string, comments: string) => void;
  copiedDay?: { exercises: ExerciseDistribution[]; sourceDate: string } | null;
  
  // Session reordering
  onMoveSessionUp?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionDown?: (dayDate: string, sessionIndex: number) => void;
  
  // Test/Event selection from macrocycle
  availableTests?: SubGoal[];
  availableEvents?: Event[];
  
  dailyIntensityData?: any[];
  onIntensityChange?: (date: string, intensity: IntensityLevel) => void;
  getIntensityColor?: (intensity: IntensityLevel) => string;
  intensityLevels?: IntensityLevel[];
}

export function TrainingDayCell({ 
  day, 
  onSessionClick, 
  onDeleteSession,
  onCopySession, 
  onPasteSession, 
  copiedSession,
  onCopyDay,
  onClearDay,
  onAddTestEvent,
  onDeleteTestEvent,
  onUpdateTestComment,
  onUpdateEventComment,
  copiedDay,
  onMoveSessionUp,
  onMoveSessionDown,
  availableTests,
  availableEvents,
  dailyIntensityData,
  onIntensityChange,
  getIntensityColor,
  intensityLevels
}: TrainingDayCellProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [intensityPopoverOpen, setIntensityPopoverOpen] = useState(false);
  const [combinedDialogOpen, setCombinedDialogOpen] = useState(false);
  const hasTraining = day.sessions.length > 0;
  const isTestDay = day.trainingDay?.isTestDay;
  const isEventDay = day.trainingDay?.isEventDay;
  const isRestDay = !hasTraining && day.trainingDay?.isTrainingDay === false;
  const isTodayDate = isToday(day.date);
  const isSpecialDay = isTestDay || isEventDay;

  // Get current intensity for this day
  const currentIntensity: IntensityLevel = dailyIntensityData?.find(di => di.date === day.dateString)?.intensity || 'moderate';

  // Get primary method name (first method from first session)
  const primaryMethod = day.sessions[0]?.methods[0]?.split(' - ')[0] || '';

  // Compute display label with fallback
  const displayLabel =
    day.trainingDay?.testNames?.[0] ??
    day.trainingDay?.eventNames?.[0] ??
    (isTestDay ? 'Test' : isEventDay ? 'Event' : '');

  return (
    <>
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "min-h-[140px] border rounded-lg p-3 transition-all relative",
        day.isCurrentMonth ? "bg-card" : "bg-muted/30",
        !hasTraining && "cursor-default",
        isSpecialDay && "border-red-500 border-2"
      )}
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
          {getIntensityColor && intensityLevels && onIntensityChange && (
            <Popover open={intensityPopoverOpen} onOpenChange={setIntensityPopoverOpen}>
              <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button 
                  className={cn(
                    "w-5 h-5 rounded-sm border transition-all hover:scale-110 cursor-pointer shrink-0",
                    getIntensityColor(currentIntensity)
                  )}
                  title={`Intensity: ${currentIntensity.replace('-', ' ')}`}
                />
              </PopoverTrigger>
              <PopoverContent 
                className="w-48 p-2 z-[100] bg-popover" 
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">Select Intensity</p>
                  {intensityLevels.map((level) => (
                    <button
                      key={level}
                      onClick={(e) => {
                        e.stopPropagation();
                        onIntensityChange(day.dateString, level);
                        setIntensityPopoverOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left",
                        level === currentIntensity && "bg-accent"
                      )}
                    >
                      <div 
                        className={cn(
                          "w-3 h-3 rounded-sm border shrink-0",
                          getIntensityColor(level)
                        )}
                      />
                      <span className="text-xs capitalize">
                        {level.replace('-', ' ')}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

        </div>

        {/* Status Icons with Hover Tooltips */}
        <div className="flex gap-1 items-start">
          {day.trainingDay?.testNames && day.trainingDay.testNames.length > 0 && (
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
                    {day.trainingDay.testNames.length > 1 ? 'Tests:' : 'Test:'}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {day.trainingDay.testNames.map((testName, idx) => (
                      <div key={idx}>• {testName}</div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
          
          {day.trainingDay?.eventNames && day.trainingDay.eventNames.length > 0 && (
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
                    {day.trainingDay.eventNames.length > 1 ? 'Events:' : 'Event:'}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {day.trainingDay.eventNames.map((eventName, idx) => (
                      <div key={idx}>• {eventName}</div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
          
          {/* Day-level Menu (3-dot) - moved here from absolute position */}
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
                  setCombinedDialogOpen(true);
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
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={provided.draggableProps.style}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSessionClick?.(day.dateString, session.sessionIndex, session.exercises);
                        }}
                        className={cn(
                          "p-2 rounded-md bg-primary/10 border border-primary/20 transition-all cursor-pointer hover:bg-primary/15",
                          snapshot.isDragging && "shadow-lg ring-2 ring-primary opacity-90"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </div>
                            <Dumbbell className="h-3 w-3 text-primary" />
                            <span 
                              className="text-xs font-medium text-primary truncate max-w-[120px]"
                              title={session.sessionName || `Session ${idx + 1}`}
                            >
                              {session.sessionName || `Session ${idx + 1}`}
                            </span>
                            
                            {/* Session Intensity Indicator */}
                            {session.sessionIntensity && getIntensityColor && (
                              <div 
                                className={cn(
                                  "w-3.5 h-3.5 rounded-sm border shrink-0",
                                  getIntensityColor(session.sessionIntensity)
                                )}
                                title={`Session intensity: ${session.sessionIntensity.replace('-', ' ')}`}
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

                        {/* Exercise Count */}
                        <p className="text-xs text-muted-foreground ml-5">
                          {session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'}
                        </p>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Multiple Sessions Summary */}
          {day.sessions.length > 1 && (
            <p className="text-xs text-muted-foreground text-center pt-1 border-t">
              {day.sessions.length} sessions • {day.totalExercises} total exercises
            </p>
          )}
        </>
      ) : isRestDay ? (
        <Droppable droppableId={`day-${day.dateString}`} type="session">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex items-center justify-center h-12 min-h-[60px]",
                snapshot.isDraggingOver && "bg-primary/5 rounded-md"
              )}
            >
              {snapshot.isDraggingOver ? (
                <span className="text-xs text-muted-foreground">Drop here</span>
              ) : (
                <span className="text-xs text-muted-foreground">Rest</span>
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
                "min-h-[60px] flex items-center justify-center",
                snapshot.isDraggingOver && "bg-primary/5 rounded-md"
              )}
            >
              {snapshot.isDraggingOver ? (
                <span className="text-xs text-muted-foreground">Drop here</span>
              ) : null}
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

    {/* Combined Test/Event Dialog */}
      <CombinedTestEventDialog
        open={combinedDialogOpen}
        onOpenChange={setCombinedDialogOpen}
        existingTests={availableTests || []}
        existingEvents={availableEvents || []}
        scheduledTestNames={day.trainingDay?.testNames}
        scheduledEventNames={day.trainingDay?.eventNames}
        onSelect={(selected) => {
          onAddTestEvent?.(
            day.dateString, 
            selected.type, 
            selected.id, 
            selected.name, 
            selected.isNew,
            selected.comments
          );
        }}
        onDelete={(type, name) => {
          onDeleteTestEvent?.(day.dateString, type, name);
        }}
        onUpdateComment={(type, id, comments) => {
          if (type === 'test') {
            onUpdateTestComment?.(id, comments);
          } else {
            onUpdateEventComment?.(id, comments);
          }
        }}
      />
    </>
  );
}
