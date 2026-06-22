import React, { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dumbbell, Plus, Trophy, Calendar, ChevronDown, ChevronRight, MessageSquare, Pencil, StickyNote, Calculator, ArrowUp, ArrowDown, Copy, Trash2, MoreVertical, Link2, ClipboardPaste, RefreshCw } from 'lucide-react';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { SubGoal, Event } from '@/types/training';
import { CombinedTestEventDialog } from './CombinedTestEventDialog';
import { IntensityLevel } from '@/types/training';
import { ExtendedMesocycle } from '@/features/planner/types';
import { ToolboxDatabase } from '@/types/toolbox';
import { ExerciseDistribution, SessionSection, SupersetMapping } from '@/types/microcycle-planning';
import { getSupersetLabelFromMapping } from '@/utils/supersetUtils';
import { getMethodSessionIndex, getModuloSessionIndex } from '@/utils/sessionIndexUtils';
import { BORG_LEVELS, getBorgBg, getBorgFg, getBorgLabelFull, migrateLegacyIntensity } from '@/utils/intensityScale';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { evaluateFormula, parseNumeric } from '@/utils/formulaEvaluator';
import { AthletePerformanceParameter } from '@/types/athlete';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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
  // New props for Phase 4 - intensity editing
  onDayIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  onSessionIntensityChange?: (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => void;
  // New props for Phase 5 - section and exercise reordering
  onSectionReorder?: (dayDate: string, sessionIndex: number, sectionId: string, direction: 'up' | 'down') => void;
  onExerciseReorder?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string, direction: 'up' | 'down') => void;
  // New props for Phase 6 - add section and exercise buttons
  onAddSectionToSession?: (dayDate: string, sessionIndex: number) => void;
  onAddExerciseToSection?: (dayDate: string, sessionIndex: number, sectionId: string) => void;
  // New props for duplicate/delete exercise
  onExerciseDuplicate?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => void;
  onExerciseDelete?: (dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => void;
  // New prop for superset toggling
  onToggleSuperset?: (dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string, sectionId?: string) => void;
  // New props for section duplicate/delete
  onSectionDuplicate?: (dayDate: string, sessionIndex: number, sectionId: string) => void;
  onSectionDelete?: (dayDate: string, sessionIndex: number, sectionId: string) => void;
  // New props for session copy/delete/paste
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onDeleteSession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  copiedSession?: { exercises: ExerciseDistribution[]; sections?: any[]; sourceDate: string; sessionIndex: number } | null;
  // New props for day management
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  onPasteDay?: (dayDate: string) => void;
  copiedDay?: { exercises: ExerciseDistribution[]; sourceDate: string } | null;
  // Test/Event management props
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event', testEventId: string, testEventName: string, isNew: boolean, comments?: string) => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event', name: string) => void;
  onUpdateTestComment?: (testId: string, comments: string) => void;
  onUpdateTestValues?: (testId: string, updates: { preTestValue?: number; goalValue?: number; comments?: string }) => void;
  onUpdateEventComment?: (eventId: string, comments: string) => void;
  availableTests?: SubGoal[];
  availableEvents?: Event[];
  // Full exercise distribution for chronological session index calculation (flexible type)
  allExerciseDistribution?: Array<{
    id?: string;
    exerciseId: string;
    methodId: string;
    categoryName?: string;
    dayDate: string;
    sessionIndex: number;
    order?: number;
  }>;
  // Exercise detail dialog
  onOpenExerciseDetail?: (exercise: ExerciseDistribution) => void;
  // Exercise change
  onExerciseChange?: (
    dayDate: string,
    sessionIndex: number,
    sectionId: string,
    exerciseId: string,
    newExercise: { exerciseId: string; exerciseName: string; libraryId: string }
  ) => void;
  // Athlete context for baseline value auto-fill
  selectedAthleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
  // Body Metrics
  biometricDefinitions?: import('@/types/athlete').BiometricDefinition[];
  athleteBiometrics?: import('@/types/athlete').AthleteBiometric[];
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
  onDayIntensityChange,
  onSessionIntensityChange,
  onSectionReorder,
  onExerciseReorder,
  onAddSectionToSession,
  onAddExerciseToSection,
  onExerciseDuplicate,
  onExerciseDelete,
  onToggleSuperset,
  onSectionDuplicate,
  onSectionDelete,
  onCopySession,
  onDeleteSession,
  onPasteSession,
  copiedSession,
  onCopyDay,
  onClearDay,
  onPasteDay,
  copiedDay,
  onAddTestEvent,
  onDeleteTestEvent,
  onUpdateTestComment,
  onUpdateTestValues,
  onUpdateEventComment,
  availableTests,
  availableEvents,
  allExerciseDistribution,
  onOpenExerciseDetail,
  onExerciseChange,
  selectedAthleteId,
  athletePerformanceParameters,
  biometricDefinitions,
  athleteBiometrics,
}: MasterPlannerColumnProps) {
  const [dayIntensityPopoverOpen, setDayIntensityPopoverOpen] = useState(false);
  const [sessionIntensityPopovers, setSessionIntensityPopovers] = useState<Record<number, boolean>>({});
  // Default all exercises to collapsed (true = collapsed)
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [combinedDialogOpen, setCombinedDialogOpen] = useState(false);
  // State for Change Exercise via full library popup
  const [changeExerciseTarget, setChangeExerciseTarget] = useState<{
    dayDate: string;
    sessionIndex: number;
    sectionId: string;
    exerciseId: string;
  } | null>(null);
  
  // Parameters database hook for test method dropdown
  const { data: parametersData, addParameter } = useParametersDataV2();
  const { data: parametersToolboxData } = useToolboxData();
  
  const toggleExerciseCollapse = (exerciseId: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };
  
  // Helper: check if exercise is collapsed (default is collapsed = true, so check if NOT in expanded)
  const isExerciseCollapsed = (exerciseId: string) => !expandedExercises[exerciseId];
  const hasTraining = day.sessions.length > 0;
  const isSingleSession = day.sessions.length === 1;
  const currentIntensity: IntensityLevel = migrateLegacyIntensity(dailyIntensityData?.find(di => di.date === day.dateString)?.intensity || '5') as IntensityLevel;

  // Helper: check if two exercises are linked in a superset
  // Uses distribution id (exercise.id) which is what Step 1 uses when creating supersets
  const areExercisesLinked = useCallback((id1: string, id2: string, sessionIndex: number, sectionId?: string): boolean => {
    const sectionKey = sectionId || '__unsectioned__';
    const daySupersets = supersets?.[day.dateString];
    if (!daySupersets) return false;
    
    const sessionSupersets = daySupersets[sessionIndex];
    if (!sessionSupersets) return false;
    
    const sectionSupersets = sessionSupersets[sectionKey];
    if (!sectionSupersets) return false;
    
    for (const [, exerciseIds] of Object.entries(sectionSupersets)) {
      if (exerciseIds.includes(id1) && exerciseIds.includes(id2)) {
        return true;
      }
    }
    return false;
  }, [supersets, day.dateString]);

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
    if (!sessionSections || !Array.isArray(sessionSections)) {
      return [];
    }
    const filtered = sessionSections
      .filter(s => s.dayDate === day.dateString && s.sessionIndex === sessionIndex)
      .sort((a, b) => a.order - b.order);

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
  const normalizeMethodKey = (key: string | undefined): string => {
    if (!key) return '';
    return key.replace(/ Tier/g, '-Tier').replace(/ tier/g, '-tier');
  };

  // Get all exercises for the current microcycle (for chronological session index calculation)
  const getMicrocycleDates = useCallback((): string[] => {
    if (!currentMesocycle || !trainingDays) return [];
    
    const trainingDay = trainingDays.find(td => td.date === day.dateString);
    const microcycleId = trainingDay?.microcycleId;
    
    if (!microcycleId) return [];
    
    return trainingDays
      .filter(td => td.microcycleId === microcycleId)
      .map(td => td.date);
  }, [currentMesocycle, trainingDays, day.dateString]);

  // Get parameters for an exercise from toolbox data
  const getExerciseParams = useCallback((exercise: ExerciseDistribution) => {
    if (!currentMesocycle || !parameterValues) {
      return { storedParams: {}, methodParams: [] as MethodParameter[], chronologicalSessionIndex: 0 };
    }

    const trainingDay = trainingDays?.find(td => td.date === day.dateString);
    const microcycleId = trainingDay?.microcycleId;
    
    let microcycleIndex = currentMesocycle.microcycles?.findIndex(m => m.id === microcycleId) ?? -1;
    if (microcycleIndex < 0) {
      microcycleIndex = Math.max(0, weekNumber - 1);
    }

    // Calculate chronological session index for this exercise within its method
    const microcycleDates = getMicrocycleDates();
    // Convert local ExerciseDistribution to the type expected by getMethodSessionIndex
    const exerciseForLookup = {
      ...exercise,
      id: exercise.id || exercise.exerciseId, // Ensure id is always present
    };
    const rawChronologicalIndex = getMethodSessionIndex(
      exerciseForLookup,
      (allExerciseDistribution || []).map(ex => ({ ...ex, id: ex.id || ex.exerciseId })),
      microcycleDates
    );

    const hasValidCategory = exercise.categoryName && exercise.categoryName !== 'Uncategorized' && exercise.categoryName !== '';
    const fullMethodKey = hasValidCategory
      ? `${exercise.methodId}::${exercise.categoryName}` 
      : exercise.methodId;

    const normalizedMethodId = normalizeMethodKey(exercise.methodId);
    const normalizedFullMethodKey = normalizeMethodKey(fullMethodKey);

    const mesocycleParams = parameterValues[currentMesocycle.id];
    const microcycleParams = mesocycleParams?.[microcycleIndex];
    
    // Count how many session parameter sets are defined for this method
    const methodParamsForSession = microcycleParams?.[fullMethodKey] ||
      microcycleParams?.[normalizedFullMethodKey] ||
      microcycleParams?.[exercise.methodId] ||
      microcycleParams?.[normalizedMethodId] || {};
    const sessionCount = Object.keys(methodParamsForSession).filter(k => !isNaN(Number(k))).length;
    
    // Apply modulo if there are more exercises than sessions
    const chronologicalSessionIndex = sessionCount > 0 
      ? getModuloSessionIndex(rawChronologicalIndex, sessionCount)
      : rawChronologicalIndex;
    
    // UPDATED: Try chronological session index FIRST for split methods,
    // then fall back to session 0 for non-split methods
    const storedParams = 
      microcycleParams?.[fullMethodKey]?.[chronologicalSessionIndex] ||
      microcycleParams?.[normalizedFullMethodKey]?.[chronologicalSessionIndex] ||
      microcycleParams?.[exercise.methodId]?.[chronologicalSessionIndex] ||
      microcycleParams?.[normalizedMethodId]?.[chronologicalSessionIndex] ||
      // Fallback to session 0 for non-split methods
      microcycleParams?.[fullMethodKey]?.[0] ||
      microcycleParams?.[normalizedFullMethodKey]?.[0] ||
      microcycleParams?.[exercise.methodId]?.[0] ||
      microcycleParams?.[normalizedMethodId]?.[0] ||
      {};

    const methodParts = (exercise.methodId || '').split(' - ');
    const methodMain = methodParts[0] || '';
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

    return { storedParams, methodParams, chronologicalSessionIndex };
  }, [currentMesocycle, parameterValues, trainingDays, day.dateString, toolboxData, weekNumber, getMicrocycleDates, allExerciseDistribution]);

  // Get superset label for an exercise (A1, A2, B1, B2, etc.)
  const getSupersetLabel = useCallback((exercise: ExerciseDistribution): string | null => {
    // Use distribution id (used by Step 1) with fallback to exerciseId
    const lookupId = exercise.id || exercise.exerciseId;
    return getSupersetLabelFromMapping(
      supersets,
      day.dateString,
      exercise.sessionIndex,
      lookupId,
      exercise.sectionId
    );
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

    // Generic isCalculated entries from toolbox for this method
    const methodParts2 = (exercise.methodId || '').split(' - ');
    const methodMain2 = methodParts2[0] || '';
    const methodSub2 = methodParts2[1] || '';
    const calcEntries = toolboxData
      ? toolboxData.entries.filter(tp => {
          const catMatch = methodSub2
            ? tp.category === methodMain2 && tp.subCategory === methodSub2
            : tp.category === methodMain2 && (!tp.subCategory || tp.subCategory === '');
          return catMatch && tp.isCalculated && !!tp.formula;
        })
      : [];

    const PCT_UNITS_LOCAL = new Set(['%', '%1RM', '%BW', '%maxV', '%maxHR']);
    const computeCalcValue = (ce: (typeof calcEntries)[0], setNumber: number): number | null => {
      if (!ce.formula) return null;
      const ctx: Record<string, number> = {};
      const methodSiblings = toolboxData
        ? toolboxData.entries.filter(tp => {
            const catMatch = methodSub2
              ? tp.category === methodMain2 && tp.subCategory === methodSub2
              : tp.category === methodMain2 && (!tp.subCategory || tp.subCategory === '');
            return catMatch && !tp.isCalculated;
          })
        : [];
      // Primary: resolve by source parameter ID
      for (const srcId of ce.sourceParameterIds ?? []) {
        const srcEntry = toolboxData?.entries.find(te => te.id === srcId);
        if (!srcEntry) continue;
        const raw = storedParams[`${srcEntry.parameterName}_set${setNumber}`] ?? storedParams[srcEntry.parameterName];
        if (raw === undefined || raw === '') continue;
        const unit = (storedParams[`${srcEntry.parameterName}_unit`] as string | undefined)
          ?? (srcEntry.parameterType === 'quantitative' && srcEntry.options.length > 0 ? srcEntry.options[0] : undefined);
        let n = parseNumeric(raw);
        if (!isNaN(n)) {
          if (unit && PCT_UNITS_LOCAL.has(unit)) n /= 100;
          ctx[srcEntry.parameterName] = n;
        }
      }
      // Fallback: resolve by parameter name for anything still missing
      for (const sibling of methodSiblings) {
        if (ctx[sibling.parameterName] !== undefined) continue;
        const raw = storedParams[`${sibling.parameterName}_set${setNumber}`] ?? storedParams[sibling.parameterName];
        if (raw === undefined || raw === '') continue;
        const unit = (storedParams[`${sibling.parameterName}_unit`] as string | undefined)
          ?? (sibling.parameterType === 'quantitative' && sibling.options.length > 0 ? sibling.options[0] : undefined);
        let n = parseNumeric(raw);
        if (!isNaN(n)) {
          if (unit && PCT_UNITS_LOCAL.has(unit)) n /= 100;
          ctx[sibling.parameterName] = n;
        }
      }
      // Athlete data refs: 'e1RM' token, biometric def IDs, or performance param IDs
      for (const ref of ce.athleteDataRefs ?? []) {
        if (ref === 'e1RM') {
          // Find any performance parameter named 'e1rm' (case-insensitive) as fallback
          const e1rmParam = parametersData?.parameters.find(p => p.name.toLowerCase() === 'e1rm');
          if (e1rmParam && selectedAthleteId) {
            const perfEntry = (athletePerformanceParameters ?? []).find(
              p => p.athleteId === selectedAthleteId && p.athleticismParameterId === e1rmParam.id
            );
            if (perfEntry?.values.length) {
              const sorted = [...perfEntry.values].sort(
                (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
              );
              const n = parseFloat(sorted[0].value);
              if (!isNaN(n)) ctx['e1RM'] = n;
            }
          }
        } else {
          // Try biometric definition ID first
          const bioDef = biometricDefinitions?.find(d => d.id === ref);
          if (bioDef) {
            const bioEntry = athleteBiometrics?.find(
              ab => ab.athleteId === selectedAthleteId && ab.biometricDefinitionId === ref
            );
            if (bioEntry?.values.length) {
              const sorted = [...bioEntry.values].sort(
                (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
              );
              const n = parseFloat(sorted[0].value);
              if (!isNaN(n)) ctx[bioDef.name] = n;
            }
            continue;
          }
          // Try performance parameter ID
          const perfDef = parametersData?.parameters.find(p => p.id === ref);
          if (perfDef) {
            const perfEntry = (athletePerformanceParameters ?? []).find(
              p => p.athleteId === selectedAthleteId && p.athleticismParameterId === ref
            );
            if (perfEntry?.values.length) {
              const sorted = [...perfEntry.values].sort(
                (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
              );
              const n = parseFloat(sorted[0].value);
              if (!isNaN(n)) ctx[perfDef.name] = n;
            }
          }
        }
      }
      const result = evaluateFormula(ce.formula, ctx);
      if (result === null) return null;
      return Math.round(result * 2) / 2;
    };

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
                  {calcEntries.map(ce => (
                    <TableHead key={ce.parameterName} className="py-0.5 px-1 font-medium h-6 min-w-[70px] whitespace-nowrap text-primary">
                      <div className="flex items-center gap-0.5">
                        <Calculator className="h-3 w-3" />
                        <span>{ce.parameterName}{ce.parameterType === 'quantitative' && ce.options?.[0] ? ` [${ce.options[0]}]` : ''}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: rowCount }, (_, idx) => {
                  const setNumber = idx + 1;
                  return (
                    <TableRow key={idx} className="h-7 border-0">
                      <TableCell className="py-0 px-1 text-center text-muted-foreground min-w-[40px] w-[40px]">{setNumber}</TableCell>
                      {visibleParams.slice(0, 4).map(p => {
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
                      {calcEntries.map(ce => {
                        const computed = computeCalcValue(ce, setNumber);
                        const overrideKey = `${ce.parameterName}_set${setNumber}`;
                        const storedOverride = storedParams[overrideKey] ?? storedParams[ce.parameterName];
                        const hasOverride = computed !== null &&
                          storedOverride !== undefined &&
                          storedOverride !== '' &&
                          String(storedOverride) !== String(computed);
                        const displayValue = (storedOverride !== undefined && storedOverride !== '')
                          ? storedOverride
                          : (computed !== null ? computed : undefined);
                        return (
                          <TableCell key={ce.parameterName} className="py-0 px-1 min-w-[70px]">
                            <div className="flex items-center gap-0.5">
                              <EditableParamInput
                                dayDateString={day.dateString}
                                exercise={exercise}
                                paramName={ce.parameterName}
                                paramType="number"
                                currentValue={displayValue}
                                setIndex={setNumber}
                                onParameterChange={onParameterChange}
                              />
                              {hasOverride && (
                                <button
                                  className="shrink-0 text-primary hover:text-primary/70 p-0.5 rounded"
                                  title={`Restore calculated value (${computed})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onParameterChange?.(
                                      day.dateString,
                                      exercise.sessionIndex,
                                      exercise.methodId,
                                      exercise.categoryName,
                                      overrideKey,
                                      computed!
                                    );
                                  }}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
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

    // Get exercises grouped by section (no hook here - just compute directly)
    const getExercisesBySection = () => {
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

      // Sort exercises by order within each section
      for (const sectionId of Object.keys(grouped)) {
        grouped[sectionId].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
      unsectioned.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      return { grouped, unsectioned };
    };
    
    const exercisesBySection = getExercisesBySection();

    return (
      <div className="space-y-2">
        {/* Session Header */}
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <EditableSessionName
            sessionName={session.sessionName || `Session ${session.sessionIndex + 1}`}
            onSave={(name) => onSessionNameChange?.(day.dateString, session.sessionIndex, name)}
          />
          {session.sessionIntensity && onSessionIntensityChange ? (
            <Popover
              open={sessionIntensityPopovers[session.sessionIndex] || false}
              onOpenChange={(open) => setSessionIntensityPopovers(prev => ({ ...prev, [session.sessionIndex]: open }))}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-[10px] font-medium px-1.5 py-0.5 h-auto hover:opacity-80"
                  style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(session.sessionIntensity)), color: getBorgFg(migrateLegacyIntensity(session.sessionIntensity)) }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {getBorgLabelFull(migrateLegacyIntensity(session.sessionIntensity))}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2 z-[200]" align="end" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                  <div className="text-xs font-medium mb-2">
                    {isSingleSession ? 'Change Intensity' : 'Session Intensity'}
                  </div>
                  {BORG_LEVELS.map((level) => (
                    <Button
                      key={level}
                      variant="ghost"
                      size="sm"
                      className={cn("w-full justify-start text-xs h-7", level === migrateLegacyIntensity(session.sessionIntensity) && "bg-accent")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSessionIntensityChange(session.sessionIndex, level as IntensityLevel);
                      }}
                    >
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: getBorgBg(level) }} />
                      {getBorgLabelFull(level)}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : session.sessionIntensity ? (
            <div
              className="w-3.5 h-3.5 rounded-sm border ml-auto"
              style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(session.sessionIntensity)) }}
              title={`Session intensity: ${getBorgLabelFull(migrateLegacyIntensity(session.sessionIntensity))}`}
            />
          ) : null}

          {/* Session 3-dot menu for copy/delete */}
          {(onCopySession || onDeleteSession) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 ml-1">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 z-[200] bg-popover">
                {onCopySession && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onCopySession(day.dateString, session.sessionIndex);
                  }}>
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
                <Collapsible key={section.id} defaultOpen={false}>
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
                      {/* Section reorder arrows - only when 2+ sections */}
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
                      {/* Section dropdown menu - always visible */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 shrink-0 ml-1"
                            title="Section options"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[300] bg-background border">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onSectionDuplicate?.(day.dateString, session.sessionIndex, section.id);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Duplicate Section
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onSectionDelete?.(day.dateString, session.sessionIndex, section.id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete Section
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                        <div className="space-y-0 mt-2">
                          {sectionExercises.map((exercise, exIdx) => {
                            const supersetLabel = getSupersetLabel(exercise);
                            const isFirstExercise = exIdx === 0;
                            const isLastExercise = exIdx === sectionExercises.length - 1;
                            const nextExercise = !isLastExercise ? sectionExercises[exIdx + 1] : null;
                            const isLinkedToNext = nextExercise ? areExercisesLinked(exercise.id || exercise.exerciseId, nextExercise.id || nextExercise.exerciseId, session.sessionIndex, section.id) : false;
                            
                            return (
                              <React.Fragment key={`${exercise.exerciseId}-${exIdx}`}>
                                <div
                                  className={cn(
                                    "text-xs bg-muted/50 border rounded-md p-2.5 shadow-sm",
                                    supersetLabel && "border-l-4 border-l-primary"
                                  )}
                                >
                                  <div className="flex items-start gap-1.5">
                                    {/* Collapse toggle - first position */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      tabIndex={-1}
                                      className="h-4 w-4 p-0 shrink-0 mt-0.5"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExerciseCollapse(exercise.exerciseId);
                                      }}
                                      title={isExerciseCollapsed(exercise.exerciseId) ? "Expand" : "Collapse"}
                                    >
                                      {isExerciseCollapsed(exercise.exerciseId) ? (
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
                                        <button
                                          tabIndex={-1}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenExerciseDetail?.(exercise);
                                          }}
                                          className="font-semibold truncate flex-1 text-left hover:underline cursor-pointer"
                                        >
                                          {exercise.exerciseName}
                                        </button>
                                        {/* Exercise reorder arrows */}
                                        {sectionExercises.length > 1 && (
                                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            {!isFirstExercise && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                tabIndex={-1}
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
                                                tabIndex={-1}
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
                                            <Button variant="ghost" size="sm" tabIndex={-1} className="h-4 w-4 p-0 shrink-0">
                                              <MoreVertical className="h-3 w-3" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="z-[300] bg-background border">
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setChangeExerciseTarget({
                                                  dayDate: day.dateString,
                                                  sessionIndex: session.sessionIndex,
                                                  sectionId: section.id,
                                                  exerciseId: exercise.id || exercise.exerciseId,
                                                });
                                              }}
                                            >
                                              <RefreshCw className="h-3.5 w-3.5 mr-2" />
                                              Change Exercise
                                            </DropdownMenuItem>
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
                                      {!isExerciseCollapsed(exercise.exerciseId) && (
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
                                
                                {/* Chain icon between exercises - always visible */}
                                {!isLastExercise && nextExercise && (
                                  <div className="flex justify-center py-0.5 relative z-10">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={cn(
                                        "h-5 w-5 rounded-full p-0",
                                        isLinkedToNext
                                          ? "bg-primary/20 text-primary hover:bg-primary/30"
                                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleSuperset?.(
                                          day.dateString, 
                                          session.sessionIndex, 
                                          exercise.id || exercise.exerciseId, 
                                          nextExercise.id || nextExercise.exerciseId, 
                                          section.id
                                        );
                                      }}
                                      title={isLinkedToNext ? "Remove from superset" : "Add to superset"}
                                    >
                                      <Link2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </React.Fragment>
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
              <div className="space-y-0 mt-2">
                {exercisesBySection.unsectioned.map((exercise, exIdx) => {
                  const supersetLabel = getSupersetLabel(exercise);
                  const isLastExercise = exIdx === exercisesBySection.unsectioned.length - 1;
                  const nextExercise = !isLastExercise ? exercisesBySection.unsectioned[exIdx + 1] : null;
                  const isLinkedToNext = nextExercise ? areExercisesLinked(exercise.id || exercise.exerciseId, nextExercise.id || nextExercise.exerciseId, session.sessionIndex, undefined) : false;
                  
                  return (
                    <React.Fragment key={`${exercise.exerciseId}-${exIdx}`}>
                      <div
                        className={cn(
                          "text-xs bg-muted/50 border rounded-md p-2.5 shadow-sm",
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
                            title={isExerciseCollapsed(exercise.exerciseId) ? "Expand" : "Collapse"}
                          >
                            {isExerciseCollapsed(exercise.exerciseId) ? (
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenExerciseDetail?.(exercise);
                                }}
                                className="font-semibold truncate flex-1 text-left hover:underline cursor-pointer"
                              >
                                {exercise.exerciseName}
                              </button>
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
                                      setChangeExerciseTarget({
                                        dayDate: day.dateString,
                                        sessionIndex: session.sessionIndex,
                                        sectionId: '',
                                        exerciseId: exercise.id || exercise.exerciseId,
                                      });
                                    }}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                                    Change Exercise
                                  </DropdownMenuItem>
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
                            {!isExerciseCollapsed(exercise.exerciseId) && (
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
                      
                      {/* Chain icon between exercises - always visible */}
                      {!isLastExercise && nextExercise && (
                        <div className="flex justify-center py-0.5 relative z-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-5 w-5 rounded-full p-0",
                              isLinkedToNext
                                ? "bg-primary/20 text-primary hover:bg-primary/30"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSuperset?.(
                                day.dateString, 
                                session.sessionIndex, 
                                exercise.id || exercise.exerciseId, 
                                nextExercise.id || nextExercise.exerciseId, 
                                undefined
                              );
                            }}
                            title={isLinkedToNext ? "Remove from superset" : "Add to superset"}
                          >
                            <Link2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </React.Fragment>
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
            {onDayIntensityChange ? (
              <Popover open={dayIntensityPopoverOpen} onOpenChange={setDayIntensityPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] font-medium px-1.5 py-0.5 h-auto hover:opacity-80"
                    style={{ backgroundColor: getBorgBg(currentIntensity), color: getBorgFg(currentIntensity) }}
                  >
                    {getBorgLabelFull(currentIntensity)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 z-[200]" align="start">
                  <div className="space-y-1">
                    <div className="text-xs font-medium mb-2">
                      {isSingleSession ? 'Change Intensity' : 'Day Intensity'}
                    </div>
                    {BORG_LEVELS.map((level) => (
                      <Button
                        key={level}
                        variant="ghost"
                        size="sm"
                        className={cn("w-full justify-start text-xs h-7", level === currentIntensity && "bg-accent")}
                        onClick={() => handleDayIntensityChange(level as IntensityLevel)}
                      >
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: getBorgBg(level) }} />
                        {getBorgLabelFull(level)}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div
                className="w-4 h-4 rounded-sm border"
                style={{ backgroundColor: getBorgBg(currentIntensity) }}
                title={`Intensity: ${getBorgLabelFull(currentIntensity)}`}
              />
            )}
          </div>
          <div className="flex gap-1 items-center">
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
            
            {/* Day Management 3-dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors">
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-[200]">
                <DropdownMenuItem onClick={() => onCopyDay?.(day.dateString)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy day
                </DropdownMenuItem>
                
                {copiedDay && onPasteDay && (
                  <DropdownMenuItem onClick={() => onPasteDay(day.dateString)}>
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Paste day ({copiedDay.exercises.length})
                  </DropdownMenuItem>
                )}
                
                {hasTraining && (
                  <DropdownMenuItem 
                    onClick={() => onClearDay?.(day.dateString)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear day
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => setCombinedDialogOpen(true)}>
                  <Trophy className="mr-2 h-4 w-4" />
                  Manage tests/events
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            
            {/* Add Session and Paste Session buttons for days with existing sessions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSession?.(day.dateString);
                }}
                className="gap-1.5 w-full"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Session
              </Button>
              {copiedSession && onPasteSession && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPasteSession(day.dateString);
                  }}
                  className="gap-1.5 w-full"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Paste Session ({copiedSession.exercises.length})
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground mb-1">No training scheduled</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddSession?.(day.dateString)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Session
            </Button>
            {copiedSession && onPasteSession && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onPasteSession(day.dateString)}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Paste Session ({copiedSession.exercises.length})
              </Button>
            )}
            {copiedDay && onPasteDay && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPasteDay(day.dateString)}
                className="gap-1.5"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Paste Day ({copiedDay.exercises.length})
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* CombinedTestEventDialog for managing tests/events */}
      <CombinedTestEventDialog
        open={combinedDialogOpen}
        onOpenChange={setCombinedDialogOpen}
        existingTests={availableTests || []}
        existingEvents={availableEvents || []}
        scheduledTestNames={day.trainingDay?.testNames || []}
        scheduledEventNames={day.trainingDay?.eventNames || []}
        onSelect={(selected) => {
          onAddTestEvent?.(day.dateString, selected.type, selected.id, selected.name, selected.isNew, selected.comments);
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
        onUpdateTestValues={onUpdateTestValues}
        allParameters={parametersData.parameters}
        toolboxEntries={parametersToolboxData?.entries || []}
        onAddParameter={(param) => {
          addParameter({
            name: param.name,
            unit: param.unit,
            category: param.category,
          });
        }}
        selectedAthleteId={selectedAthleteId}
        athletePerformanceParameters={athletePerformanceParameters}
        biometricDefinitions={biometricDefinitions}
        athleteBiometrics={athleteBiometrics}
      />
      
      {/* Exercise Library Popup for changing exercise via three-dot menu */}
      {changeExerciseTarget && (
        <ExerciseLibraryPopup
          isOpen={!!changeExerciseTarget}
          onClose={() => setChangeExerciseTarget(null)}
          onSelectExercises={(exercises) => {
            if (exercises.length > 0) {
              const ex = exercises[0];
              onExerciseChange?.(
                changeExerciseTarget.dayDate,
                changeExerciseTarget.sessionIndex,
                changeExerciseTarget.sectionId,
                changeExerciseTarget.exerciseId,
                {
                  exerciseId: ex.exerciseId,
                  exerciseName: ex.exerciseName,
                  libraryId: ex.library,
                }
              );
              setChangeExerciseTarget(null);
            }
          }}
          singleSelect={true}
          selectedExerciseIds={[]}
          onExerciseCreated={() => {}}
        />
      )}
    </div>
  );
}
