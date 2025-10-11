import React from 'react';
import { format, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dumbbell, Trophy, Calendar } from 'lucide-react';

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

  // Get primary method name (first method from first session)
  const primaryMethod = day.sessions[0]?.methods[0]?.split(' - ')[0] || '';

  return (
    <div
      onClick={hasTraining ? onClick : undefined}
      className={cn(
        "min-h-[140px] border rounded-lg p-3 transition-all",
        day.isCurrentMonth ? "bg-card" : "bg-muted/30",
        hasTraining && "cursor-pointer hover:shadow-md hover:border-primary",
        !hasTraining && "cursor-default"
      )}
    >
      {/* Day Number + Test/Event Name */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Day Number with Red Ring for Special Days */}
          <div
            className={cn(
              "text-sm font-medium flex items-center justify-center shrink-0",
              isTodayDate && isSpecialDay && "bg-black text-white rounded-full w-7 h-7 ring-2 ring-red-500",
              isTodayDate && !isSpecialDay && "bg-black text-white rounded-full w-7 h-7",
              !isTodayDate && isSpecialDay && "rounded-full w-7 h-7 ring-2 ring-red-500",
              !isTodayDate && !day.isCurrentMonth && "text-muted-foreground",
              !isTodayDate && hasTraining && !isSpecialDay && "text-primary font-semibold"
            )}
          >
            {format(day.date, 'd')}
          </div>

          {/* Test/Event Name Display */}
          {(day.trainingDay?.testName || day.trainingDay?.eventName) && (
            <div className="text-xs font-medium text-red-600 truncate max-w-[120px]">
              {day.trainingDay.testName || day.trainingDay.eventName}
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
        <div className="space-y-2">
          {/* Session Indicators */}
          {day.sessions.map((session, idx) => (
            <div
              key={idx}
              className="p-2 rounded-md bg-primary/10 border border-primary/20"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Dumbbell className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">
                  Session {session.sessionIndex + 1}
                </span>
              </div>
              
              {/* Primary Method Name */}
              {session.methods[0] && (
                <p className="text-xs font-medium truncate mb-0.5">
                  {session.methods[0].split(' - ')[0]}
                </p>
              )}

              {/* Exercise Count */}
              <p className="text-xs text-muted-foreground">
                {session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'}
              </p>
            </div>
          ))}

          {/* Multiple Sessions Summary */}
          {day.sessions.length > 1 && (
            <p className="text-xs text-muted-foreground text-center pt-1 border-t">
              {day.sessions.length} sessions • {day.totalExercises} total exercises
            </p>
          )}
        </div>
      ) : isRestDay ? (
        <div className="flex items-center justify-center h-12">
          <span className="text-xs text-muted-foreground">Rest</span>
        </div>
      ) : null}
    </div>
  );
}
