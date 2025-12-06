import React from 'react';
import { format, getWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dumbbell, Plus, Trophy, Calendar } from 'lucide-react';
import { IntensityLevel } from '@/types/training';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';

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

interface MasterPlannerColumnProps {
  day: CalendarDay;
  weekNumber: number;
  onSessionClick?: (dayDate: string, sessionIndex: number, exercises: ExerciseDistribution[]) => void;
  onAddSession?: (dayDate: string) => void;
  getIntensityColor?: (intensity: IntensityLevel) => string;
  dailyIntensityData?: any[];
}

export function MasterPlannerColumn({
  day,
  weekNumber,
  onSessionClick,
  onAddSession,
  getIntensityColor,
  dailyIntensityData,
}: MasterPlannerColumnProps) {
  const hasTraining = day.sessions.length > 0;
  const currentIntensity: IntensityLevel = dailyIntensityData?.find(di => di.date === day.dateString)?.intensity || 'moderate';

  return (
    <div className="flex-shrink-0 w-72 border-r last:border-r-0 flex flex-col bg-card">
      {/* Header with week number and date */}
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-semibold">
              Week {weekNumber}
            </Badge>
            {getIntensityColor && (
              <div 
                className={cn(
                  "w-4 h-4 rounded-sm border",
                  getIntensityColor(currentIntensity)
                )}
                title={`Intensity: ${currentIntensity.replace('-', ' ')}`}
              />
            )}
          </div>
          <div className="flex gap-1">
            {day.trainingDay?.testNames && day.trainingDay.testNames.length > 0 && (
              <HoverCard openDelay={100}>
                <HoverCardTrigger asChild>
                  <div className="cursor-pointer">
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      <Trophy className="h-3 w-3" />
                    </Badge>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-auto max-w-xs p-3 z-[200]" side="top">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">Tests:</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {day.trainingDay.testNames.map((name, idx) => (
                        <div key={idx}>• {name}</div>
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
                <HoverCardContent className="w-auto max-w-xs p-3 z-[200]" side="top">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">Events:</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {day.trainingDay.eventNames.map((name, idx) => (
                        <div key={idx}>• {name}</div>
                      ))}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
        </div>
        <p className="text-sm font-medium mt-1">
          {format(day.date, 'MMM d')} • {format(day.date, 'EEE')}
        </p>
      </div>

      {/* Content area */}
      <div className="flex-1 p-3 overflow-y-auto">
        {hasTraining ? (
          <div className="space-y-3">
            {day.sessions.map((session, idx) => (
              <div
                key={session.id}
                onClick={() => onSessionClick?.(day.dateString, session.sessionIndex, session.exercises)}
                className="p-3 rounded-lg border bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
              >
                {/* Session Header */}
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {session.sessionName || `Session ${idx + 1}`}
                  </span>
                  {session.sessionIntensity && getIntensityColor && (
                    <div 
                      className={cn(
                        "w-3.5 h-3.5 rounded-sm border ml-auto",
                        getIntensityColor(session.sessionIntensity)
                      )}
                      title={`Session intensity: ${session.sessionIntensity.replace('-', ' ')}`}
                    />
                  )}
                </div>

                {/* Exercise List */}
                <div className="space-y-1.5">
                  {session.exercises.map((exercise, exIdx) => (
                    <div
                      key={`${exercise.exerciseId}-${exIdx}`}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span className="text-muted-foreground w-4 shrink-0">{exIdx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{exercise.exerciseName}</p>
                        <p className="text-muted-foreground truncate text-[10px]">
                          {exercise.categoryName}
                          {exercise.subCategory && ` • ${exercise.subCategory}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Exercise Count Badge */}
                <div className="mt-2 pt-2 border-t">
                  <Badge variant="secondary" className="text-[10px]">
                    {session.exercises.length} exercise{session.exercises.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Dumbbell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">No workout</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddSession?.(day.dateString)}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Workout
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
