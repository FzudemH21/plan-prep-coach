import React, { useState, useCallback, useEffect, memo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dumbbell, Plus, Trophy, Calendar } from 'lucide-react';
import { IntensityLevel } from '@/types/training';
import { ExtendedMesocycle } from '@/features/planner/types';
import { ToolboxDatabase } from '@/types/toolbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface MethodParameter {
  name: string;
  displayName?: string;
  type: 'number' | 'text' | 'select';
  options?: string[];
  isSetParameter?: boolean;
  isFrequencyParameter?: boolean;
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
  toolboxData?: ToolboxDatabase;
  onParameterChange?: (
    dayDate: string,
    sessionIndex: number,
    methodId: string,
    categoryName: string,
    parameterName: string,
    value: string | number
  ) => void;
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

// Props interface for EditableParamInput - defined OUTSIDE the component
interface EditableParamInputProps {
  dayDateString: string;
  exercise: ExerciseDistribution;
  paramName: string;
  paramType: 'number' | 'text' | 'select';
  currentValue: string | number | undefined;
  options?: string[];
  displayName?: string;
  onParameterChange?: (
    dayDate: string,
    sessionIndex: number,
    methodId: string,
    categoryName: string,
    parameterName: string,
    value: string | number
  ) => void;
}

// Editable input component - defined OUTSIDE the parent to maintain stable identity
const EditableParamInput = memo(({ 
  dayDateString,
  exercise, 
  paramName, 
  paramType, 
  currentValue,
  options,
  displayName,
  onParameterChange
}: EditableParamInputProps) => {
  const [localValue, setLocalValue] = useState(currentValue ?? '');
  
  // Sync local value with prop changes
  useEffect(() => {
    setLocalValue(currentValue ?? '');
  }, [currentValue]);
  
  const handleBlur = useCallback(() => {
    const finalValue = paramType === 'number' && localValue !== '' 
      ? Number(localValue) 
      : localValue;
    onParameterChange?.(
      dayDateString,
      exercise.sessionIndex,
      exercise.methodId,
      exercise.categoryName,
      paramName,
      finalValue
    );
  }, [dayDateString, exercise.sessionIndex, exercise.methodId, exercise.categoryName, paramName, paramType, localValue, onParameterChange]);

  const handleSelectChange = useCallback((value: string) => {
    setLocalValue(value);
    // Save immediately for select inputs
    onParameterChange?.(
      dayDateString,
      exercise.sessionIndex,
      exercise.methodId,
      exercise.categoryName,
      paramName,
      value
    );
  }, [dayDateString, exercise.sessionIndex, exercise.methodId, exercise.categoryName, paramName, onParameterChange]);

  // Render Select dropdown for select type with options
  if (paramType === 'select' && options && options.length > 0) {
    return (
      <Select value={String(localValue)} onValueChange={handleSelectChange}>
        <SelectTrigger 
          className="h-5 w-20 text-[10px] px-1 border-muted bg-background/50" 
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent className="z-[300] bg-background border">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-[10px]">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Render Input for number/text types
  return (
    <Input
      type={paramType === 'number' ? 'number' : 'text'}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      className="h-5 w-14 text-[10px] px-1 py-0 text-center border-muted bg-background/50 focus:bg-background"
    />
  );
});

EditableParamInput.displayName = 'EditableParamInput';

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
  toolboxData,
  onParameterChange,
}: MasterPlannerColumnProps) {
  const hasTraining = day.sessions.length > 0;
  const currentIntensity: IntensityLevel = dailyIntensityData?.find(di => di.date === day.dateString)?.intensity || 'moderate';

  // Helper to normalize method keys for consistent lookup
  const normalizeMethodKey = (key: string): string => {
    // Normalize "Tier" spelling: "Reactive Tier" -> "Reactive-Tier"
    return key.replace(/ Tier/g, '-Tier').replace(/ tier/g, '-tier');
  };

  // Get parameters for an exercise from toolbox data
  const getExerciseParams = useCallback((exercise: ExerciseDistribution) => {
    if (!currentMesocycle || !parameterValues) {
      return { storedParams: {}, methodParams: [] as MethodParameter[] };
    }

    // Find microcycle index for this day
    const trainingDay = trainingDays?.find(td => td.date === day.dateString);
    const microcycleId = trainingDay?.microcycleId;
    
    // Calculate microcycle index - with fallback based on week number
    let microcycleIndex = currentMesocycle.microcycles?.findIndex(m => m.id === microcycleId) ?? -1;
    if (microcycleIndex < 0) {
      // Fallback: use week number - 1 (Week 1 = index 0)
      microcycleIndex = Math.max(0, weekNumber - 1);
    }

    // Build method key (with or without category)
    // Treat empty string or 'Uncategorized' as no real category
    const hasValidCategory = exercise.categoryName && exercise.categoryName !== 'Uncategorized' && exercise.categoryName !== '';
    const fullMethodKey = hasValidCategory
      ? `${exercise.methodId}::${exercise.categoryName}` 
      : exercise.methodId;

    // Normalize keys for lookup (handles spelling variations like "Reactive Tier" vs "Reactive-Tier")
    const normalizedMethodId = normalizeMethodKey(exercise.methodId);
    const normalizedFullMethodKey = normalizeMethodKey(fullMethodKey);

    // Get stored parameter values
    const mesocycleParams = parameterValues[currentMesocycle.id];
    const microcycleParams = mesocycleParams?.[microcycleIndex];
    
    
    // Priority order for lookup (try both original and normalized keys):
    // 1. Category-specific key with session 0 (most specific - category was split & specified)
    // 2. Category-specific key with exercise's session index
    // 3. Method key (without category) with session 0 (fallback - applies to all categories)
    // 4. Method key with exercise's session index
    // Also try normalized versions for each
    const storedParams = 
      microcycleParams?.[fullMethodKey]?.[0] ||
      microcycleParams?.[normalizedFullMethodKey]?.[0] ||
      microcycleParams?.[fullMethodKey]?.[exercise.sessionIndex] ||
      microcycleParams?.[normalizedFullMethodKey]?.[exercise.sessionIndex] ||
      microcycleParams?.[exercise.methodId]?.[0] ||
      microcycleParams?.[normalizedMethodId]?.[0] ||
      microcycleParams?.[exercise.methodId]?.[exercise.sessionIndex] ||
      microcycleParams?.[normalizedMethodId]?.[exercise.sessionIndex] ||
      {};
    
    
    

    // Parse methodId to extract main method and sub-method
    // Format: "Lower Body Resistance Training - Strength" → ["Lower Body Resistance Training", "Strength"]
    const methodParts = exercise.methodId.split(' - ');
    const methodMain = methodParts[0] || exercise.methodId;
    const methodSubCategory = methodParts[1] || '';

    // Look up parameters from toolbox data for this method
    // Match: toolbox.category = methodMain AND toolbox.subCategory = methodSubCategory
    let toolboxParams = toolboxData?.entries.filter(entry => {
      if (methodSubCategory) {
        return entry.category === methodMain && entry.subCategory === methodSubCategory;
      }
      // For methods without sub-category, match just category
      return entry.category === methodMain && (!entry.subCategory || entry.subCategory === '');
    }) || [];



    // Convert toolbox entries to MethodParameter format
    const methodParams: MethodParameter[] = toolboxParams.map(entry => {
      const paramName = entry.parameterName;
      const isQualitative = entry.parameterType === 'qualitative';
      const hasOptions = entry.options && entry.options.length > 0;
      
      return {
        name: paramName,
        displayName: paramName.replace(/\s*\[.*?\]\s*$/, '').trim(), // Clean display name
        type: (isQualitative && hasOptions) ? 'select' : 'number',
        options: (isQualitative && hasOptions) ? entry.options : undefined,
        isSetParameter: entry.isSetParameter || false,
        isFrequencyParameter: entry.isFrequencyParameter || false,
      };
    });

    // Fallback: if no toolbox data found, derive from storedParams keys
    if (methodParams.length === 0 && Object.keys(storedParams).length > 0) {
      Object.keys(storedParams)
        .filter(k => !k.endsWith('_unit') && !/_set\d+$/i.test(k))
        .forEach((name) => {
          methodParams.push({
            name,
            displayName: name.replace(/\s*\[.*?\]\s*$/, '').trim(),
            type: typeof storedParams[name] === 'number' ? 'number' : 'text',
            isSetParameter: /^sets?$/i.test(name.replace(/\s*\[.*?\]\s*$/, '').trim()),
          });
        });
    }

    return { storedParams, methodParams };
  }, [currentMesocycle, parameterValues, trainingDays, day.dateString, toolboxData, weekNumber]);

  // Render parameter values for an exercise
  const renderExerciseParams = (exercise: ExerciseDistribution) => {
    const { storedParams, methodParams } = getExerciseParams(exercise);
    
    // If no method params from toolbox and no stored params, show nothing
    if (methodParams.length === 0 && Object.keys(storedParams).length === 0) {
      return null;
    }

    // Find the set parameter
    const setParam = methodParams.find(p => p.isSetParameter);
    const setCount = setParam 
      ? Number(storedParams[setParam.name] || 0) 
      : 0;

    // Filter parameters for display (exclude frequency and set param - set param determines row count)
    const displayParams = methodParams.filter(p => 
      !p.isSetParameter && 
      p.name !== 'frequency_per_week' && 
      p.name !== 'Frequency'
    );

    // The set count determines how many rows to display
    const rowCount = Math.max(setCount, 1); // At least 1 row

    // Render table if we have display params
    if (displayParams.length > 0) {
      return (
        <div className="mt-2">
          <Table className="text-[10px]">
            <TableHeader>
              <TableRow className="h-5 border-b">
                {displayParams.slice(0, 4).map(p => (
                  <TableHead key={p.name} className="py-0.5 px-1 font-medium h-5">
                    {formatParamName(p.displayName || p.name)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rowCount }, (_, idx) => (
                <TableRow key={idx} className="h-6 border-0">
                  {displayParams.slice(0, 4).map(p => (
                    <TableCell key={p.name} className="py-0 px-0.5">
                      <EditableParamInput
                        dayDateString={day.dateString}
                        exercise={exercise}
                        paramName={p.name}
                        paramType={p.type as 'number' | 'text' | 'select'}
                        currentValue={storedParams[p.name]}
                        options={p.options}
                        displayName={p.displayName}
                        onParameterChange={onParameterChange}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    // If no parameters defined in toolbox, show a message
    if (methodParams.length === 0) {
      return (
        <div className="mt-1.5 text-[10px] text-muted-foreground italic">
          No parameters defined for this method
        </div>
      );
    }

    // No parameters with values to display
    return null;
  };

  return (
    <div className="flex-shrink-0 w-96 border-r last:border-r-0 flex flex-col bg-card">
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
                            {exercise.methodId}
                            {exercise.categoryName && exercise.categoryName !== 'Uncategorized' && exercise.categoryName !== '' && ` • ${exercise.categoryName}`}
                          </p>
                          {renderExerciseParams(exercise)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">No training scheduled</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddSession?.(day.dateString)}
              className="gap-1.5"
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
