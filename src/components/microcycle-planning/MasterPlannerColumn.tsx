import React, { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dumbbell, Plus, Trophy, Calendar, ChevronDown, ChevronRight, MessageSquare, Pencil, StickyNote, Calculator, ArrowUp, ArrowDown, Copy, Trash2, MoreVertical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { IntensityLevel } from '@/types/training';
import { ExtendedMesocycle } from '@/features/planner/types';
import { ToolboxDatabase } from '@/types/toolbox';
import { SessionSection, SupersetMapping } from '@/types/microcycle-planning';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  eachSide?: boolean;
  autoCalculateWeight?: boolean;
  autoCalculateTargetHR?: boolean;
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
  showInGridByDefault?: boolean;
  unit?: string;
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
  // New props for Phase 1
  sessionSections?: SessionSection[];
  supersets?: SupersetMapping;
  onSessionNameChange?: (dayDate: string, sessionIndex: number, newName: string) => void;
  onSessionCommentChange?: (dayDate: string, sessionIndex: number, comment: string) => void;
  onSectionCommentChange?: (sectionId: string, comment: string) => void;
  totalWeeks?: number;
  // New props for Phase 2 - editable notes and eachSide
  onExerciseNotesChange?: (exerciseId: string, notes: string) => void;
  onExerciseEachSideChange?: (exerciseId: string, eachSide: boolean) => void;
  // New props for Phase 3 - auto-calculate toggles
  onExerciseAutoCalcChange?: (exerciseId: string, field: 'autoCalculateWeight' | 'autoCalculateTargetHR', value: boolean) => void;
  // New props for Phase 4 - intensity editing
  onDayIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  onSessionIntensityChange?: (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => void;
  intensityLevels?: IntensityLevel[];
  // New props for Phase 5 - section and exercise reordering
  onSectionReorder?: (dayDate: string, sessionIndex: number, sectionId: string, direction: 'up' | 'down') => void;
  onExerciseReorder?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string, direction: 'up' | 'down') => void;
  // New props for Phase 6 - add section and exercise buttons
  onAddSectionToSession?: (dayDate: string, sessionIndex: number) => void;
  onAddExerciseToSection?: (dayDate: string, sessionIndex: number, sectionId: string) => void;
  // New props for duplicate/delete exercise
  onExerciseDuplicate?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => void;
  onExerciseDelete?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => void;
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
  setIndex?: number; // 1-based set number for per-set parameter storage
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
  setIndex,
  onParameterChange
}: EditableParamInputProps) => {
  const [localValue, setLocalValue] = useState(currentValue ?? '');
  
  // Sync local value with prop changes
  useEffect(() => {
    setLocalValue(currentValue ?? '');
  }, [currentValue]);

  // Compute the actual parameter key - use per-set key when setIndex is provided
  const actualParamName = setIndex ? `${paramName}_set${setIndex}` : paramName;
  
  const handleBlur = useCallback(() => {
    const finalValue = paramType === 'number' && localValue !== '' 
      ? Number(localValue) 
      : localValue;
    onParameterChange?.(
      dayDateString,
      exercise.sessionIndex,
      exercise.methodId,
      exercise.categoryName,
      actualParamName,
      finalValue
    );
  }, [dayDateString, exercise.sessionIndex, exercise.methodId, exercise.categoryName, actualParamName, paramType, localValue, onParameterChange]);

  const handleSelectChange = useCallback((value: string) => {
    setLocalValue(value);
    // Save immediately for select inputs
    onParameterChange?.(
      dayDateString,
      exercise.sessionIndex,
      exercise.methodId,
      exercise.categoryName,
      actualParamName,
      value
    );
  }, [dayDateString, exercise.sessionIndex, exercise.methodId, exercise.categoryName, actualParamName, onParameterChange]);

  // Render Select dropdown for select type with options
  if (paramType === 'select' && options && options.length > 0) {
    return (
      <Select value={String(localValue)} onValueChange={handleSelectChange}>
        <SelectTrigger 
          className="h-6 w-full text-[10px] px-1 border-muted bg-background/50" 
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
      className="h-6 w-full text-[10px] px-1 py-0 text-center border-muted bg-background/50 focus:bg-background"
    />
  );
});

EditableParamInput.displayName = 'EditableParamInput';

// Session name edit component
const EditableSessionName = memo(({ 
  sessionName, 
  onSave,
}: { 
  sessionName: string; 
  onSave: (name: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(sessionName);

  useEffect(() => {
    setLocalName(sessionName);
  }, [sessionName]);

  const handleSave = () => {
    // Always close editing mode
    setIsEditing(false);
    // Only save if there's a change and the name is not empty
    if (localName.trim() && localName.trim() !== sessionName) {
      onSave(localName.trim());
    } else {
      // Reset to original if empty
      setLocalName(sessionName);
    }
  };

  if (isEditing) {
    return (
      <Input
        autoFocus
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
          }
          if (e.key === 'Escape') {
            setLocalName(sessionName);
            setIsEditing(false);
          }
        }}
        className="h-6 text-sm font-medium px-1 w-full"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div 
      className="flex items-center gap-1 cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      <span className="text-sm font-medium text-primary">{sessionName}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
});

EditableSessionName.displayName = 'EditableSessionName';

// Session/Section comment component
const EditableComment = memo(({
  comment,
  placeholder,
  onSave,
}: {
  comment: string;
  placeholder: string;
  onSave: (comment: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localComment, setLocalComment] = useState(comment);

  useEffect(() => {
    setLocalComment(comment);
  }, [comment]);

  const handleSave = () => {
    // Always save (even if empty) and close
    onSave(localComment);
  };

  if (!isExpanded && !comment) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1.5 text-xs text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(true);
        }}
      >
        <MessageSquare className="h-3 w-3 mr-1" />
        Add note
      </Button>
    );
  }

  return (
    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
      {isExpanded ? (
        <Textarea
          autoFocus
          value={localComment}
          onChange={(e) => setLocalComment(e.target.value)}
          onBlur={() => {
            handleSave();
            setIsExpanded(false);
          }}
          placeholder={placeholder}
          className="text-xs min-h-[40px] resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSave();
              setIsExpanded(false);
            }
            if (e.key === 'Escape') {
              setLocalComment(comment);
              setIsExpanded(false);
            }
          }}
        />
      ) : (
        <div 
          className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 cursor-pointer hover:bg-muted/50"
          onClick={() => setIsExpanded(true)}
        >
          {comment}
        </div>
      )}
    </div>
  );
});

EditableComment.displayName = 'EditableComment';

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
  sessionSections,
  supersets,
  onSessionNameChange,
  onSessionCommentChange,
  onSectionCommentChange,
  totalWeeks = 6,
  onExerciseNotesChange,
  onExerciseEachSideChange,
  onExerciseAutoCalcChange,
  onDayIntensityChange,
  onSessionIntensityChange,
  intensityLevels,
  onSectionReorder,
  onExerciseReorder,
  onAddSectionToSession,
  onAddExerciseToSection,
  onExerciseDuplicate,
  onExerciseDelete,
}: MasterPlannerColumnProps) {
  const [dayIntensityPopoverOpen, setDayIntensityPopoverOpen] = useState(false);
  const [sessionIntensityPopovers, setSessionIntensityPopovers] = useState<Record<number, boolean>>({});
  const [collapsedExercises, setCollapsedExercises] = useState<Record<string, boolean>>({});
  
  const toggleExerciseCollapse = (exerciseId: string) => {
    setCollapsedExercises(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };
  const hasTraining = day.sessions.length > 0;
  const isSingleSession = day.sessions.length === 1;
  const currentIntensity: IntensityLevel = dailyIntensityData?.find(di => di.date === day.dateString)?.intensity || 'moderate';

  // Handle day intensity change with coupled/decoupled logic
  const handleDayIntensityChange = (newIntensity: IntensityLevel) => {
    onDayIntensityChange?.(day.dateString, newIntensity);
    // If single session, also update session intensity (coupled)
    if (isSingleSession) {
      onSessionIntensityChange?.(day.dateString, 0, newIntensity);
    }
    setDayIntensityPopoverOpen(false);
  };

  // Handle session intensity change with coupled/decoupled logic
  const handleSessionIntensityChange = (sessionIndex: number, newIntensity: IntensityLevel) => {
    onSessionIntensityChange?.(day.dateString, sessionIndex, newIntensity);
    // If single session, also update day intensity (coupled)
    if (isSingleSession) {
      onDayIntensityChange?.(day.dateString, newIntensity);
    }
    setSessionIntensityPopovers(prev => ({ ...prev, [sessionIndex]: false }));
  };

  // Get sections for this day and session
  const getSectionsForSession = useCallback((sessionIndex: number): SessionSection[] => {
    if (!sessionSections) {
      console.log('[MasterPlannerColumn] sessionSections is undefined or empty');
      return [];
    }
    const filtered = sessionSections
      .filter(s => s.dayDate === day.dateString && s.sessionIndex === sessionIndex)
      .sort((a, b) => a.order - b.order);
    
    // Debug logging
    if (sessionSections.length > 0 && filtered.length === 0) {
      console.log('[MasterPlannerColumn] No sections matched for:', {
        dayDateString: day.dateString,
        sessionIndex,
        totalSections: sessionSections.length,
        sampleSectionDates: sessionSections.slice(0, 3).map(s => s.dayDate)
      });
    }
    
    return filtered;
  }, [sessionSections, day.dateString]);

  // Get session comment from localStorage
  const getSessionComment = useCallback((sessionIndex: number): string => {
    if (!currentMesocycle) return '';
    const key = `workoutSessions_${currentMesocycle.id}_${day.dateString}_${sessionIndex}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.comments || '';
      }
    } catch {}
    return '';
  }, [currentMesocycle, day.dateString]);

  // Helper to normalize method keys for consistent lookup
  const normalizeMethodKey = (key: string): string => {
    return key.replace(/ Tier/g, '-Tier').replace(/ tier/g, '-tier');
  };

  // Get parameters for an exercise from toolbox data
  const getExerciseParams = useCallback((exercise: ExerciseDistribution) => {
    if (!currentMesocycle || !parameterValues) {
      return { storedParams: {}, methodParams: [] as MethodParameter[] };
    }

    const trainingDay = trainingDays?.find(td => td.date === day.dateString);
    const microcycleId = trainingDay?.microcycleId;
    
    let microcycleIndex = currentMesocycle.microcycles?.findIndex(m => m.id === microcycleId) ?? -1;
    if (microcycleIndex < 0) {
      microcycleIndex = Math.max(0, weekNumber - 1);
    }

    const hasValidCategory = exercise.categoryName && exercise.categoryName !== 'Uncategorized' && exercise.categoryName !== '';
    const fullMethodKey = hasValidCategory
      ? `${exercise.methodId}::${exercise.categoryName}` 
      : exercise.methodId;

    const normalizedMethodId = normalizeMethodKey(exercise.methodId);
    const normalizedFullMethodKey = normalizeMethodKey(fullMethodKey);

    const mesocycleParams = parameterValues[currentMesocycle.id];
    const microcycleParams = mesocycleParams?.[microcycleIndex];
    
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

    const methodParts = exercise.methodId.split(' - ');
    const methodMain = methodParts[0] || exercise.methodId;
    const methodSubCategory = methodParts[1] || '';

    // Get toolbox entries for metadata enrichment
    const toolboxEntries = toolboxData?.entries.filter(entry => {
      if (methodSubCategory) {
        return entry.category === methodMain && entry.subCategory === methodSubCategory;
      }
      return entry.category === methodMain && (!entry.subCategory || entry.subCategory === '');
    }) || [];

    // Build methodParams from storedParams keys ONLY (no toolbox fallback)
    // This ensures Master Planner shows exactly the same params as Workout Session Card
    const storedParamKeys = Object.keys(storedParams)
      .filter(k => !k.endsWith('_unit') && !/_set\d+$/i.test(k));

    const methodParams: MethodParameter[] = storedParamKeys.map(paramName => {
      // Find matching toolbox entry for metadata
      const toolboxEntry = toolboxEntries.find(entry => entry.parameterName === paramName);
      
      const isQualitative = toolboxEntry?.parameterType === 'qualitative';
      const hasOptions = toolboxEntry?.options && toolboxEntry.options.length > 0;
      const unit = toolboxEntry?.parameterType === 'quantitative' && toolboxEntry.options?.[0]
        ? toolboxEntry.options[0]
        : undefined;
      
      return {
        name: paramName,
        displayName: paramName.replace(/\s*\[.*?\]\s*$/, '').trim(),
        type: (isQualitative && hasOptions) ? 'select' : 'number',
        options: (isQualitative && hasOptions) ? toolboxEntry.options : undefined,
        isSetParameter: toolboxEntry?.isSetParameter || /^sets?$/i.test(paramName) || /ground contacts/i.test(paramName),
        isFrequencyParameter: toolboxEntry?.isFrequencyParameter || false,
        showInGridByDefault: toolboxEntry?.showInGridByDefault ?? true,
        unit,
      };
    });

    return { storedParams, methodParams };
  }, [currentMesocycle, parameterValues, trainingDays, day.dateString, toolboxData, weekNumber]);

  // Get superset label for an exercise (A1, A2, B1, B2, etc.)
  const getSupersetLabel = useCallback((exercise: ExerciseDistribution): string | null => {
    const daySupersets = supersets?.[day.dateString]?.[exercise.sessionIndex];
    if (!daySupersets) return null;
    
    const sectionKey = exercise.sectionId || '__unsectioned__';
    const sectionSupersets = daySupersets[sectionKey];
    if (!sectionSupersets) return null;
    
    let labelIndex = 0;
    for (const [supersetId, exerciseIds] of Object.entries(sectionSupersets)) {
      if (exerciseIds.includes(exercise.exerciseId)) {
        const positionInSuperset = exerciseIds.indexOf(exercise.exerciseId);
        const letter = String.fromCharCode(65 + labelIndex); // A, B, C...
        return `${letter}${positionInSuperset + 1}`; // A1, A2, B1...
      }
      labelIndex++;
    }
    return null;
  }, [supersets, day.dateString]);

  // Render parameter values for an exercise
  const renderExerciseParams = (exercise: ExerciseDistribution) => {
    const { storedParams, methodParams } = getExerciseParams(exercise);
    
    if (methodParams.length === 0 && Object.keys(storedParams).length === 0) {
      return null;
    }

    const setParam = methodParams.find(p => p.isSetParameter);
    const setCount = setParam 
      ? Number(storedParams[setParam.name] || 0) 
      : 0;

    // Split params into visible (grid) and hidden (badges)
    const visibleParams = methodParams.filter(p => 
      !p.isSetParameter && 
      !p.isFrequencyParameter &&
      p.name !== 'frequency_per_week' && 
      p.name !== 'Frequency' &&
      p.showInGridByDefault !== false
    );

    const hiddenParams = methodParams.filter(p => 
      p.showInGridByDefault === false &&
      !p.isSetParameter && 
      !p.isFrequencyParameter
    );

    const rowCount = Math.max(setCount, 1);

    // Detect %1RM and %maxHR parameters for auto-calculation toggles
    const autoCalcDetection = (() => {
      let has1RMParam = false;
      let hasMaxHRParam = false;

      // Check stored unit values
      for (const param of methodParams) {
        const unit = storedParams[`${param.name}_unit`] || param.unit;
        if (unit === '%1RM') has1RMParam = true;
        if (unit === '%maxHR') hasMaxHRParam = true;
      }

      // Also check toolbox entries for quantitative params with %1RM or %maxHR options
      if (toolboxData) {
        const methodParts = exercise.methodId.split(' - ');
        const methodMain = methodParts[0] || exercise.methodId;
        const methodSubCategory = methodParts[1] || '';

        const toolboxEntries = toolboxData.entries.filter(entry => {
          if (methodSubCategory) {
            return entry.category === methodMain && entry.subCategory === methodSubCategory;
          }
          return entry.category === methodMain && (!entry.subCategory || entry.subCategory === '');
        });

        for (const tp of toolboxEntries) {
          if (tp.parameterType === 'quantitative' && tp.options) {
            if (tp.options.includes('%1RM')) has1RMParam = true;
            if (tp.options.includes('%maxHR')) hasMaxHRParam = true;
          }
        }
      }

      return { has1RMParam, hasMaxHRParam };
    })();

    // Determine if auto-calculate columns should show
    const showWeightColumn = autoCalcDetection.has1RMParam && (exercise.autoCalculateWeight ?? true);
    const showHRColumn = autoCalcDetection.hasMaxHRParam && (exercise.autoCalculateTargetHR ?? true);

    return (
      <>
        {/* Hidden parameter badges */}
        {hiddenParams.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {hiddenParams.map(param => {
              const value = storedParams[param.name];
              if (!value) return null;
              return (
                <Badge key={param.name} variant="secondary" className="text-[11px] h-4 px-1 font-normal">
                  {param.displayName || param.name}: {value}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Auto-Calculation Toggles - matching WorkoutExerciseCard format */}
        {(autoCalcDetection.has1RMParam || autoCalcDetection.hasMaxHRParam) && (
          <div className="flex flex-wrap items-center gap-3 mt-1.5 p-1.5 bg-muted/50 rounded text-[10px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calculator className="h-3 w-3" />
              <span className="font-medium">Auto-calculate:</span>
            </div>
            {autoCalcDetection.has1RMParam && (
              <div className="flex items-center gap-4">
                <Switch
                  checked={exercise.autoCalculateWeight ?? true}
                  onCheckedChange={(checked) => onExerciseAutoCalcChange?.(exercise.exerciseId, 'autoCalculateWeight', checked)}
                  className="h-3 w-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
                />
                <span className="ml-1">Weight [kg]</span>
              </div>
            )}
            {autoCalcDetection.hasMaxHRParam && (
              <div className="flex items-center gap-4">
                <Switch
                  checked={exercise.autoCalculateTargetHR ?? true}
                  onCheckedChange={(checked) => onExerciseAutoCalcChange?.(exercise.exerciseId, 'autoCalculateTargetHR', checked)}
                  className="h-3 w-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
                />
                <span className="ml-1">HR [bpm]</span>
              </div>
            )}
          </div>
        )}

        {/* Visible parameter grid with set numbers - horizontal scroll for overflow */}
        {visibleParams.length > 0 && (
          <div className="mt-1 overflow-x-auto">
            <Table className="text-[11px] w-auto min-w-full">
              <TableHeader>
                <TableRow className="h-6 border-b">
                  <TableHead className="py-0.5 px-1 font-medium h-6 min-w-[40px] w-[40px] text-center whitespace-nowrap">{setParam?.name || 'Set'}</TableHead>
                  {visibleParams.slice(0, 4).map(p => (
                    <TableHead key={p.name} className="py-0.5 px-1 font-medium h-6 min-w-[80px] whitespace-nowrap">
                      {formatParamName(p.displayName || p.name)}
                      {p.unit && (
                        <span className="text-muted-foreground ml-0.5 font-normal">[{p.unit}]</span>
                      )}
                    </TableHead>
                  ))}
                  {/* Auto-calculate Weight column header */}
                  {showWeightColumn && (
                    <TableHead className="py-0.5 px-1 font-medium h-6 min-w-[70px] whitespace-nowrap text-primary">
                      <div className="flex items-center gap-0.5">
                        <Calculator className="h-3 w-3" />
                        <span>Weight [kg]</span>
                      </div>
                    </TableHead>
                  )}
                  {/* Auto-calculate Target HR column header */}
                  {showHRColumn && (
                    <TableHead className="py-0.5 px-1 font-medium h-6 min-w-[70px] whitespace-nowrap text-primary">
                      <div className="flex items-center gap-0.5">
                        <Calculator className="h-3 w-3" />
                        <span>HR [bpm]</span>
                      </div>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: rowCount }, (_, idx) => {
                  const setNumber = idx + 1;
                  return (
                    <TableRow key={idx} className="h-7 border-0">
                      <TableCell className="py-0 px-1 text-center text-muted-foreground min-w-[40px] w-[40px]">{setNumber}</TableCell>
                      {visibleParams.slice(0, 4).map(p => {
                        // Read per-set value first, fallback to base param value
                        const perSetKey = `${p.name}_set${setNumber}`;
                        const currentValue = storedParams[perSetKey] ?? storedParams[p.name];
                        
                        return (
                          <TableCell key={p.name} className="py-0 px-1 min-w-[80px]">
                            <EditableParamInput
                              dayDateString={day.dateString}
                              exercise={exercise}
                              paramName={p.name}
                              paramType={p.type as 'number' | 'text' | 'select'}
                              currentValue={currentValue}
                              options={p.options}
                              displayName={p.displayName}
                              setIndex={setNumber}
                              onParameterChange={onParameterChange}
                            />
                          </TableCell>
                        );
                      })}
                      {/* Auto-calculate Weight cell */}
                      {showWeightColumn && (
                        <TableCell className="py-0 px-1 min-w-[70px]">
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/50 bg-primary/5 px-1">
                            Auto
                          </Badge>
                        </TableCell>
                      )}
                      {/* Auto-calculate Target HR cell */}
                      {showHRColumn && (
                        <TableCell className="py-0 px-1 min-w-[70px]">
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/50 bg-primary/5 px-1">
                            Auto
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </>
    );
  };

  // Group exercises by section
  const renderSessionContent = (session: typeof day.sessions[0]) => {
    const sections = getSectionsForSession(session.sessionIndex);
    const sessionComment = getSessionComment(session.sessionIndex);

    // Get exercises grouped by section
    const exercisesBySection = useMemo(() => {
      const grouped: Record<string, ExerciseDistribution[]> = {};
      const unsectioned: ExerciseDistribution[] = [];

      session.exercises.forEach(ex => {
        if (ex.sectionId) {
          if (!grouped[ex.sectionId]) {
            grouped[ex.sectionId] = [];
          }
          grouped[ex.sectionId].push(ex);
        } else {
          unsectioned.push(ex);
        }
      });

      return { grouped, unsectioned };
    }, [session.exercises]);

    return (
      <div className="space-y-2">
        {/* Session Header */}
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <EditableSessionName
            sessionName={session.sessionName || `Session ${session.sessionIndex + 1}`}
            onSave={(name) => onSessionNameChange?.(day.dateString, session.sessionIndex, name)}
          />
          {session.sessionIntensity && getIntensityColor && intensityLevels && onSessionIntensityChange ? (
            <Popover 
              open={sessionIntensityPopovers[session.sessionIndex] || false}
              onOpenChange={(open) => setSessionIntensityPopovers(prev => ({ ...prev, [session.sessionIndex]: open }))}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "ml-auto text-[10px] font-medium px-1.5 py-0.5 h-auto hover:opacity-80",
                    getIntensityColor(session.sessionIntensity)
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {session.sessionIntensity.replace('-', ' ').toUpperCase()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2 z-[200]" align="end" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                  <div className="text-xs font-medium mb-2">
                    {isSingleSession ? 'Change Intensity' : 'Session Intensity'}
                  </div>
                  {intensityLevels.map((level) => (
                    <Button
                      key={level}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-xs h-7",
                        level === session.sessionIntensity && "bg-accent"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSessionIntensityChange(session.sessionIndex, level);
                      }}
                    >
                      <span
                        className={cn(
                          "inline-block w-2.5 h-2.5 rounded-full mr-2",
                          getIntensityColor(level)
                        )}
                      />
                      {level.replace('-', ' ')}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : session.sessionIntensity && getIntensityColor && (
            <div 
              className={cn(
                "w-3.5 h-3.5 rounded-sm border ml-auto",
                getIntensityColor(session.sessionIntensity)
              )}
              title={`Session intensity: ${session.sessionIntensity.replace('-', ' ')}`}
            />
          )}
        </div>

        {/* Session Comment */}
        <EditableComment
          comment={sessionComment}
          placeholder="Session notes..."
          onSave={(comment) => onSessionCommentChange?.(day.dateString, session.sessionIndex, comment)}
        />

        {/* Sections with exercises */}
        {sections.length > 0 ? (
          <div className="space-y-2">
            {sections.map((section, sectionIdx) => {
              const sectionExercises = exercisesBySection.grouped[section.id] || [];
              const isFirstSection = sectionIdx === 0;
              const isLastSection = sectionIdx === sections.length - 1;
              
              return (
                <Collapsible key={section.id} defaultOpen>
                  <div className="border rounded-lg bg-card shadow-sm">
                    <div className="flex items-center gap-1 w-full px-3 py-2 hover:bg-muted/30 border-b bg-muted/20">
                      <CollapsibleTrigger 
                        className="flex items-center gap-1 flex-1 text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ChevronDown className="h-3 w-3 text-muted-foreground collapsible-chevron" />
                        <span className="text-xs font-semibold">{section.name}</span>
                        <Badge variant="outline" className="ml-auto text-[10px] h-4">
                          {sectionExercises.length}
                        </Badge>
                      </CollapsibleTrigger>
                      {/* Section reorder arrows */}
                      {sections.length > 1 && (
                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          {!isFirstSection && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSectionReorder?.(day.dateString, session.sessionIndex, section.id, 'up');
                              }}
                              title="Move section up"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                          )}
                          {!isLastSection && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSectionReorder?.(day.dateString, session.sessionIndex, section.id, 'down');
                              }}
                              title="Move section down"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <CollapsibleContent>
                      <div className="px-2 pb-2">
                        {/* Section Comment - Editable */}
                        <EditableComment
                          comment={section.comments || ''}
                          placeholder="Section notes..."
                          onSave={(comment) => onSectionCommentChange?.(section.id, comment)}
                        />
                        
                        {/* Section Exercises */}
                        <div className="space-y-2 mt-2">
                          {sectionExercises.map((exercise, exIdx) => {
                            const supersetLabel = getSupersetLabel(exercise);
                            const isFirstExercise = exIdx === 0;
                            const isLastExercise = exIdx === sectionExercises.length - 1;
                            
                            return (
                              <div
                                key={`${exercise.exerciseId}-${exIdx}`}
                                className={cn(
                                  "text-xs bg-muted/30 border rounded-md p-2.5 shadow-sm",
                                  supersetLabel && "border-l-4 border-l-primary"
                                )}
                              >
                                <div className="flex items-start gap-1.5">
                                  {/* Collapse toggle - first position */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 shrink-0 mt-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExerciseCollapse(exercise.exerciseId);
                                    }}
                                    title={collapsedExercises[exercise.exerciseId] ? "Expand" : "Collapse"}
                                  >
                                    {collapsedExercises[exercise.exerciseId] ? (
                                      <ChevronRight className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {supersetLabel && (
                                        <Badge variant="default" className="text-[9px] h-4 px-1 font-semibold">
                                          {supersetLabel}
                                        </Badge>
                                      )}
                                      <p className="font-semibold truncate flex-1">{exercise.exerciseName}</p>
                                      {/* Exercise reorder arrows */}
                                      {sectionExercises.length > 1 && (
                                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                          {!isFirstExercise && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-4 w-4 p-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onExerciseReorder?.(day.dateString, session.sessionIndex, section.id, exercise.exerciseId, 'up');
                                              }}
                                              title="Move exercise up"
                                            >
                                              <ArrowUp className="h-2.5 w-2.5" />
                                            </Button>
                                          )}
                                          {!isLastExercise && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-4 w-4 p-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onExerciseReorder?.(day.dateString, session.sessionIndex, section.id, exercise.exerciseId, 'down');
                                              }}
                                              title="Move exercise down"
                                            >
                                              <ArrowDown className="h-2.5 w-2.5" />
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                      {/* Dropdown menu for duplicate/delete */}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 shrink-0">
                                            <MoreVertical className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="z-[300] bg-background border">
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onExerciseDuplicate?.(day.dateString, session.sessionIndex, section.id, exercise.exerciseId);
                                            }}
                                          >
                                            <Copy className="h-3.5 w-3.5 mr-2" />
                                            Duplicate
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onExerciseDelete?.(day.dateString, session.sessionIndex, section.id, exercise.exerciseId);
                                            }}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                    
                                    {/* Collapsible content */}
                                    {!collapsedExercises[exercise.exerciseId] && (
                                      <>
                                        <p className="text-muted-foreground truncate text-[11px]">
                                          {exercise.methodId}
                                          {exercise.categoryName && exercise.categoryName !== 'Uncategorized' && exercise.categoryName !== '' && ` • ${exercise.categoryName}`}
                                        </p>
                                        {renderExerciseParams(exercise)}
                                        {/* Editable Each Side Toggle - below parameter grid */}
                                        <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                                          <Checkbox
                                            id={`each-side-section-${exercise.exerciseId}`}
                                            checked={exercise.eachSide || false}
                                            onCheckedChange={(checked) => onExerciseEachSideChange?.(exercise.exerciseId, !!checked)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-3.5 w-3.5"
                                          />
                                          <label
                                            htmlFor={`each-side-section-${exercise.exerciseId}`}
                                            className="text-xs text-muted-foreground cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Each side
                                          </label>
                                        </div>
                                        {/* Editable Notes - below each side toggle */}
                                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center gap-1 mb-0.5">
                                            <StickyNote className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">Notes</span>
                                          </div>
                                          <Textarea
                                            value={exercise.notes || ''}
                                            onChange={(e) => onExerciseNotesChange?.(exercise.exerciseId, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="Add notes..."
                                            className="text-xs min-h-[36px] resize-none p-1"
                                          />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Add Exercise Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-6 mt-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddExerciseToSection?.(day.dateString, session.sessionIndex, section.id);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Exercise
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}

            {/* Add Section Button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 mt-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
              onClick={(e) => {
                e.stopPropagation();
                onAddSectionToSession?.(day.dateString, session.sessionIndex);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Section
            </Button>

            {/* Unsectioned exercises (fallback) */}
            {exercisesBySection.unsectioned.length > 0 && (
              <div className="space-y-2 mt-2">
                {exercisesBySection.unsectioned.map((exercise, exIdx) => {
                  const supersetLabel = getSupersetLabel(exercise);
                  return (
                    <div
                      key={`${exercise.exerciseId}-${exIdx}`}
                      className={cn(
                        "text-xs bg-muted/30 border rounded-md p-2.5 shadow-sm",
                        supersetLabel && "border-l-4 border-l-primary"
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        {/* Collapse toggle - first position */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 shrink-0 mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExerciseCollapse(exercise.exerciseId);
                          }}
                          title={collapsedExercises[exercise.exerciseId] ? "Expand" : "Collapse"}
                        >
                          {collapsedExercises[exercise.exerciseId] ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            {supersetLabel && (
                              <Badge variant="default" className="text-[9px] h-4 px-1 font-semibold">
                                {supersetLabel}
                              </Badge>
                            )}
                            <p className="font-semibold truncate flex-1">{exercise.exerciseName}</p>
                            {/* Dropdown menu for duplicate/delete */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 shrink-0">
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[300] bg-background border">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onExerciseDuplicate?.(day.dateString, session.sessionIndex, '', exercise.exerciseId);
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onExerciseDelete?.(day.dateString, session.sessionIndex, '', exercise.exerciseId);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          {/* Collapsible content */}
                          {!collapsedExercises[exercise.exerciseId] && (
                            <>
                              <p className="text-muted-foreground truncate text-[11px]">
                                {exercise.methodId}
                                {exercise.categoryName && exercise.categoryName !== 'Uncategorized' && exercise.categoryName !== '' && ` • ${exercise.categoryName}`}
                              </p>
                              {renderExerciseParams(exercise)}
                              {/* Editable Each Side Toggle - below parameter grid */}
                              <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  id={`each-side-unsectioned-${exercise.exerciseId}`}
                                  checked={exercise.eachSide || false}
                                  onCheckedChange={(checked) => onExerciseEachSideChange?.(exercise.exerciseId, !!checked)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-3.5 w-3.5"
                                />
                                <label
                                  htmlFor={`each-side-unsectioned-${exercise.exerciseId}`}
                                  className="text-xs text-muted-foreground cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Each side
                                </label>
                              </div>
                              {/* Editable Notes - below each side toggle */}
                              <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1 mb-0.5">
                                  <StickyNote className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Notes</span>
                                </div>
                                <Textarea
                                  value={exercise.notes || ''}
                                  onChange={(e) => onExerciseNotesChange?.(exercise.exerciseId, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Add notes..."
                                  className="text-xs min-h-[36px] resize-none p-1"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // No sections - show exercises flat
          <div className="space-y-2">
            {session.exercises.map((exercise, exIdx) => {
              const supersetLabel = getSupersetLabel(exercise);
              return (
                <div
                  key={`${exercise.exerciseId}-${exIdx}`}
                  className={cn(
                    "text-xs",
                    supersetLabel && "border-l-2 border-l-primary pl-2"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-4 shrink-0">{exIdx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        {supersetLabel && (
                          <Badge variant="default" className="text-[9px] h-4 px-1 font-semibold">
                            {supersetLabel}
                          </Badge>
                        )}
                        <p className="font-medium truncate">{exercise.exerciseName}</p>
                      </div>
                      <p className="text-muted-foreground truncate text-[11px]">
                        {exercise.methodId}
                        {exercise.categoryName && exercise.categoryName !== 'Uncategorized' && exercise.categoryName !== '' && ` • ${exercise.categoryName}`}
                      </p>
                      {renderExerciseParams(exercise)}
                      {/* Editable Each Side Toggle - below parameter grid */}
                      <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          id={`each-side-flat-${exercise.exerciseId}`}
                          checked={exercise.eachSide || false}
                          onCheckedChange={(checked) => onExerciseEachSideChange?.(exercise.exerciseId, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5"
                        />
                        <label
                          htmlFor={`each-side-flat-${exercise.exerciseId}`}
                          className="text-xs text-muted-foreground cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Each side
                        </label>
                      </div>
                      {/* Editable Notes - below each side toggle */}
                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <StickyNote className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Notes</span>
                        </div>
                        <Textarea
                          value={exercise.notes || ''}
                          onChange={(e) => onExerciseNotesChange?.(exercise.exerciseId, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Add notes..."
                          className="text-xs min-h-[36px] resize-none p-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Add Section Button - for flat view */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 mt-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
              onClick={(e) => {
                e.stopPropagation();
                onAddSectionToSession?.(day.dateString, session.sessionIndex);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Section
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Calculate column width based on total weeks (full width distribution)
  const columnWidth = totalWeeks <= 6 ? `calc((100% - ${(totalWeeks - 1) * 8}px) / ${totalWeeks})` : '320px';

  return (
    <div 
      className="flex-shrink-0 border-r last:border-r-0 flex flex-col bg-card"
      style={{ width: columnWidth, minWidth: '280px' }}
    >
      {/* Header with week number and date */}
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-semibold">
              Week {weekNumber}
            </Badge>
            {getIntensityColor && intensityLevels && onDayIntensityChange ? (
              <Popover open={dayIntensityPopoverOpen} onOpenChange={setDayIntensityPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 h-auto hover:opacity-80",
                      getIntensityColor(currentIntensity)
                    )}
                  >
                    {currentIntensity.replace('-', ' ').toUpperCase()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 z-[200]" align="start">
                  <div className="space-y-1">
                    <div className="text-xs font-medium mb-2">
                      {isSingleSession ? 'Change Intensity' : 'Day Intensity'}
                    </div>
                    {intensityLevels.map((level) => (
                      <Button
                        key={level}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-xs h-7",
                          level === currentIntensity && "bg-accent"
                        )}
                        onClick={() => handleDayIntensityChange(level)}
                      >
                        <span
                          className={cn(
                            "inline-block w-2.5 h-2.5 rounded-full mr-2",
                            getIntensityColor(level)
                          )}
                        />
                        {level.replace('-', ' ')}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : getIntensityColor && (
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
            {day.sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSessionClick?.(day.dateString, session.sessionIndex, session.exercises)}
                className="p-3 rounded-lg border bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
              >
                {renderSessionContent(session)}
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
