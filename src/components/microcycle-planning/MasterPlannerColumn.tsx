import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dumbbell, Plus, Trophy, Calendar } from 'lucide-react';
import { IntensityLevel } from '@/types/training';
import { ExtendedMesocycle } from '@/features/planner/types';
import { getParametersForMethod, MethodParameter } from '@/data/methodParameters';
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
  parameterValues?: Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>;
  currentMesocycle?: ExtendedMesocycle;
  trainingDays?: TrainingDay[];
}

// Helper to format parameter names nicely
const formatParamName = (name: string): string => {
  return name
    .replace(/_/g, ' ')
    .replace(/per week/gi, '/wk')
    .replace(/between/gi, 'b/w')
    .replace(/percent/gi, '%')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/1rm/gi, '1RM')
    .replace(/ S$/, 's')
    .replace(/ M$/, 'm')
    .replace(/ Min$/, ' min')
    .replace(/ Ms$/, ' ms');
};

export function MasterPlannerColumn({
  day,
  weekNumber,
  onSessionClick,
  onAddSession,
  getIntensityColor,
  dailyIntensityData,
  parameterValues,
  currentMesocycle,
  trainingDays,
}: MasterPlannerColumnProps) {
  const hasTraining = day.sessions.length > 0;
  const currentIntensity: IntensityLevel = dailyIntensityData?.find(di => di.date === day.dateString)?.intensity || 'moderate';

  // Get parameters for an exercise
  const getExerciseParams = (exercise: ExerciseDistribution) => {
    if (!currentMesocycle || !parameterValues) {
      return { storedParams: {}, methodParams: [] as MethodParameter[] };
    }

    // Find microcycle index for this day
    const trainingDay = trainingDays?.find(td => td.date === day.dateString);
    const microcycleId = trainingDay?.microcycleId;
    const microcycleIndex = currentMesocycle.microcycles?.findIndex(m => m.id === microcycleId) ?? 0;

    // Build method key (with or without category)
    const fullMethodKey = exercise.categoryName 
      ? `${exercise.methodId}::${exercise.categoryName}` 
      : exercise.methodId;

    // Get stored parameter values - try full key first, then just methodId
    const mesocycleParams = parameterValues[currentMesocycle.id];
    const microcycleParams = mesocycleParams?.[microcycleIndex];
    
    const storedParams = microcycleParams?.[fullMethodKey]?.[exercise.sessionIndex] 
      || microcycleParams?.[exercise.methodId]?.[exercise.sessionIndex]
      || {};

    // Get parameter definitions from method
    let methodParams = getParametersForMethod(exercise.methodId);

    // FALLBACK: If no predefined parameters, derive from storedParams keys
    if (!methodParams || methodParams.length === 0) {
      methodParams = Object.keys(storedParams)
        .filter(k => !k.endsWith('_unit')) // Exclude unit fields
        .map((name) => ({
          name,
          type: (typeof storedParams[name] === 'number' ? 'number' : 'text') as 'number' | 'text',
        }));
    }

    return { storedParams, methodParams };
  };

  // Render parameter values for an exercise
  const renderExerciseParams = (exercise: ExerciseDistribution) => {
    const { storedParams, methodParams } = getExerciseParams(exercise);
    
    // Only return null if there are truly no parameters stored
    if (Object.keys(storedParams).length === 0) {
      return null;
    }

    // Filter out frequency parameter for display
    const displayParams = methodParams.filter(p => 
      p.name !== 'frequency_per_week' && 
      p.name !== 'Frequency' &&
      storedParams[p.name] !== undefined && 
      storedParams[p.name] !== ''
    );

    if (displayParams.length === 0) {
      return null;
    }

    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {displayParams.slice(0, 4).map(param => {
          const value = storedParams[param.name];
          const displayValue = param.unit ? `${value}${param.unit}` : value;
          
          return (
            <Badge 
              key={param.name} 
              variant="outline" 
              className="text-[9px] px-1.5 py-0 h-4 font-normal bg-muted/50"
            >
              {formatParamName(param.name)}: {displayValue}
            </Badge>
          );
        })}
        {displayParams.length > 4 && (
          <Badge 
            variant="outline" 
            className="text-[9px] px-1.5 py-0 h-4 font-normal bg-muted/50"
          >
            +{displayParams.length - 4} more
          </Badge>
        )}
      </div>
    );
  };

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

                {/* Exercise List with Parameters */}
                <div className="space-y-2">
                  {session.exercises.map((exercise, exIdx) => (
                    <div
                      key={`${exercise.exerciseId}-${exIdx}`}
                      className="text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-4 shrink-0">{exIdx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{exercise.exerciseName}</p>
                          <p className="text-muted-foreground truncate text-[10px]">
                            {exercise.categoryName}
                            {exercise.subCategory && ` • ${exercise.subCategory}`}
                          </p>
                          {/* Method-specific parameters */}
                          {renderExerciseParams(exercise)}
                        </div>
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
