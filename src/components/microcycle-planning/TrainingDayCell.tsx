import React, { useRef } from 'react';
import { format, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dumbbell, Trophy, Calendar, GripVertical } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

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
    sessionIndex: number;
    exercises: ExerciseDistribution[];
    methods: string[];
  }[];
  totalExercises: number;
}

interface TrainingDayCellProps {
  day: CalendarDay;
  onClick: () => void;
}

export function TrainingDayCell({ day, onClick }: TrainingDayCellProps) {
  const hasTraining = day.sessions.length > 0;
  const isTestDay = day.trainingDay?.isTestDay;
  const isEventDay = day.trainingDay?.isEventDay;
  const isRestDay = !hasTraining && day.trainingDay?.isTrainingDay === false;
  const isTodayDate = isToday(day.date);
  const isSpecialDay = isTestDay || isEventDay;

  // Track mouse position to distinguish between clicks and drags
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  // Get primary method name (first method from first session)
  const primaryMethod = day.sessions[0]?.methods[0]?.split(' - ')[0] || '';

  // Compute display label with fallback
  const displayLabel =
    day.trainingDay?.testName ??
    day.trainingDay?.eventName ??
    (isTestDay ? 'Test' : isEventDay ? 'Event' : '');

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;
    
    // Calculate distance moved
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Only trigger onClick if mouse didn't move much (< 5 pixels)
    if (distance < 5) {
      onClick();
    }
    
    mouseDownPos.current = null;
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={hasTraining ? handleClick : undefined}
      className={cn(
        "min-h-[140px] border rounded-lg p-3 transition-all",
        day.isCurrentMonth ? "bg-card" : "bg-muted/30",
        hasTraining && "cursor-pointer hover:shadow-md hover:border-primary",
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

          {/* Test/Event Name Display */}
          {displayLabel && (
            <div className="text-xs font-medium text-red-600 truncate max-w-[140px]">
              {displayLabel}
            </div>
          )}
        </div>

        {/* Status Icons */}
        <div className="flex gap-1">
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
        </div>
      </div>

      {/* Training Content */}
      {hasTraining ? (
        <Droppable droppableId={`day-${day.dateString}`} type="session">
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
                  key={`session-${day.dateString}-${session.sessionIndex}`}
                  draggableId={`session-${day.dateString}-${session.sessionIndex}`}
                  index={idx}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "p-2 rounded-md bg-primary/10 border border-primary/20 transition-all",
                        snapshot.isDragging && "shadow-lg ring-2 ring-primary opacity-90"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </div>
                        <Dumbbell className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-primary">
                          Session {session.sessionIndex + 1}
                        </span>
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

              {/* Multiple Sessions Summary */}
              {day.sessions.length > 1 && (
                <p className="text-xs text-muted-foreground text-center pt-1 border-t">
                  {day.sessions.length} sessions • {day.totalExercises} total exercises
                </p>
              )}
            </div>
          )}
        </Droppable>
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
              <span className="text-xs text-muted-foreground">
                {snapshot.isDraggingOver ? 'Drop here' : 'Rest'}
              </span>
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
                "min-h-[60px]",
                snapshot.isDraggingOver && "bg-primary/5 rounded-md"
              )}
            >
              {snapshot.isDraggingOver && (
                <span className="text-xs text-muted-foreground">Drop here</span>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}
