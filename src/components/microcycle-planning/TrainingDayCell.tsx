import React, { useState } from 'react';
import { format, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dumbbell, Trophy, Calendar, GripVertical, MoreVertical, Copy, Trash2, ChevronDown } from 'lucide-react';
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
  testName?: string;
  eventName?: string;
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
  }[];
  totalExercises: number;
}

interface TrainingDayCellProps {
  day: CalendarDay;
  onClick: () => void;
  onDeleteSession?: (dayDate: string, sessionIndex: number) => void;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  copiedSession?: { exercises: ExerciseDistribution[]; sourceDate: string; sessionIndex: number } | null;
  
  // Day-level operations
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event') => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event') => void;
  copiedDay?: { exercises: ExerciseDistribution[]; sourceDate: string } | null;
  
  dailyIntensityData?: any[];
  onIntensityChange?: (date: string, intensity: IntensityLevel) => void;
  getIntensityColor?: (intensity: IntensityLevel) => string;
  intensityLevels?: IntensityLevel[];
}

export function TrainingDayCell({ 
  day, 
  onClick, 
  onDeleteSession, 
  onCopySession, 
  onPasteSession, 
  copiedSession,
  onCopyDay,
  onClearDay,
  onAddTestEvent,
  onDeleteTestEvent,
  copiedDay,
  dailyIntensityData,
  onIntensityChange,
  getIntensityColor,
  intensityLevels
}: TrainingDayCellProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [intensityPopoverOpen, setIntensityPopoverOpen] = useState(false);
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
    day.trainingDay?.testName ??
    day.trainingDay?.eventName ??
    (isTestDay ? 'Test' : isEventDay ? 'Event' : '');

  return (
    <div
      onClick={hasTraining ? onClick : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "min-h-[140px] border rounded-lg p-3 transition-all relative",
        day.isCurrentMonth ? "bg-card" : "bg-muted/30",
        hasTraining && "cursor-pointer hover:shadow-md hover:border-primary",
        !hasTraining && "cursor-default",
        isSpecialDay && "border-red-500 border-2"
      )}
    >
      {/* Day-level Menu (3-dot) */}
      {day.isCurrentMonth && (
        <div className="absolute top-1 right-1 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent/80 transition-colors bg-background/80 border shadow-sm">
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
              
              {!isTestDay && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onAddTestEvent?.(day.dateString, 'test');
                }}>
                  <Trophy className="mr-2 h-4 w-4" />
                  Add test
                </DropdownMenuItem>
              )}
              
              {isTestDay && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTestEvent?.(day.dateString, 'test');
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete test
                </DropdownMenuItem>
              )}
              
              {!isEventDay && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onAddTestEvent?.(day.dateString, 'event');
                }}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Add event
                </DropdownMenuItem>
              )}
              
              {isEventDay && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTestEvent?.(day.dateString, 'event');
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete event
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

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

          {/* Test/Event Name Display */}
          {displayLabel && (
            <div className="text-xs font-medium text-red-600 truncate max-w-[140px]">
              {displayLabel}
            </div>
          )}
        </div>

        {/* Status Icons and Intensity Indicator */}
        <div className="flex gap-1 items-start">
          {isTestDay && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              <Trophy className="h-3 w-3" />
            </Badge>
          )}
          {isEventDay && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              <Calendar className="h-3 w-3" />
            </Badge>
          )}
          
          {/* Intensity Indicator */}
          {getIntensityColor && intensityLevels && onIntensityChange && (
            <Popover open={intensityPopoverOpen} onOpenChange={setIntensityPopoverOpen}>
              <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button 
                  className={cn(
                    "w-4 h-4 rounded-sm border transition-all hover:scale-110 cursor-pointer shrink-0",
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
                        className={cn(
                          "p-2 rounded-md bg-primary/10 border border-primary/20 transition-all",
                          snapshot.isDragging && "shadow-lg ring-2 ring-primary opacity-90"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </div>
                            <Dumbbell className="h-3 w-3 text-primary" />
                            <span className="text-xs font-medium text-primary">
                              Session {idx + 1}
                            </span>
                          </div>

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

          {/* Paste button - shown when hovering and session is copied */}
          {isHovering && copiedSession && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onPasteSession?.(day.dateString);
              }}
              className="w-full mt-2"
              variant="default"
              size="sm"
            >
              <Copy className="mr-2 h-4 w-4" />
              Paste ({copiedSession.exercises.length} exercise{copiedSession.exercises.length !== 1 ? 's' : ''})
            </Button>
          )}

          {/* Paste Day button - shown when hovering and day is copied */}
          {isHovering && copiedDay && !copiedSession && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onPasteSession?.(day.dateString);
              }}
              className="w-full mt-2"
              variant="default"
              size="sm"
            >
              <Copy className="mr-2 h-4 w-4" />
              Paste Day ({copiedDay.exercises.length} exercise{copiedDay.exercises.length !== 1 ? 's' : ''})
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
                "flex items-center justify-center h-12 min-h-[60px]",
                snapshot.isDraggingOver && "bg-primary/5 rounded-md"
              )}
            >
              {snapshot.isDraggingOver ? (
                <span className="text-xs text-muted-foreground">Drop here</span>
              ) : isHovering && copiedSession ? (
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
                  Paste ({copiedSession.exercises.length} exercise{copiedSession.exercises.length !== 1 ? 's' : ''})
                </Button>
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
              ) : isHovering && copiedSession ? (
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
                  Paste ({copiedSession.exercises.length} exercise{copiedSession.exercises.length !== 1 ? 's' : ''})
                </Button>
              ) : null}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}
