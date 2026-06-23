import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Save, PanelRightClose, PanelRight, Pencil, MessageSquare, ChevronDown, X, Trophy, Calendar as CalendarIcon, TrendingUp, TrendingDown, Check, RefreshCw, BookmarkPlus, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkoutSection, WorkoutExercise, WorkoutSession, SupersetMapping } from '@/types/workout';
import { IntensityLevel } from '@/types/training';
import { BORG_LEVELS, getBorgBg, getBorgFg, getBorgLabel, getBorgLabelFull, migrateLegacyIntensity } from '@/utils/intensityScale';
import { TrainingDay } from '@/types/daily-intensity';
import { WorkoutSectionCard } from './WorkoutSectionCard';
import { WorkoutSessionProvider, WorkoutSessionContextValue } from './WorkoutSessionContext';
import { WorkoutArrangementSidebar } from './WorkoutArrangementSidebar';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { MethodSelectionDialog } from './MethodSelectionDialog';
import { AdHocMethodSelectionDialog } from './AdHocMethodSelectionDialog';
import { CombinedTestEventDialog } from './CombinedTestEventDialog';
import { ParameterVisibilityPopover, ParameterVisibilityOverrides } from './ParameterVisibilityPopover';
import { ExerciseDetailDialog } from '@/components/shared/ExerciseDetailDialog';
import { CircuitBuilderDialog } from '@/components/templates/CircuitBuilderDialog';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import type { Circuit } from '@/contexts/CustomLibrariesContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format, parseISO } from 'date-fns';
import { getParametersForMethod } from '@/data/methodParameters';
import { ExerciseDistribution, ExerciseSelection } from '@/types/microcycle-planning';
import { ToolboxDatabase } from '@/types/toolbox';
import { cn } from '@/lib/utils';
import { toggleSuperset, getSupersetLabelFromMapping, cleanupSupersetsOnExerciseDelete } from '@/utils/supersetUtils';
import { getMethodSessionIndex, getModuloSessionIndex } from '@/utils/sessionIndexUtils';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { AthletePerformanceParameter } from '@/types/athlete';
import { useAthletes } from '@/hooks/useAthletes';
import { FocusedSessionContext } from '@/components/wizard/WizardAIAssistant';
import { SaveToLibraryDialog } from '@/components/session-library/SaveToLibraryDialog';
import { ExerciseHistorySheet, type HistoryEntry } from '@/components/shared/ExerciseHistorySheet';
import { PrintSessionView } from '@/components/print/PrintSessionView';
import { useExerciseMetrics } from '@/hooks/useExerciseMetrics';

interface SessionSectionProp {
  id: string;
  dayDate: string;
  sessionIndex: number;
  name: string;
  order: number;
  comments?: string;
}

interface SupersetMappingProp {
  [dayDate: string]: {
    [sessionIndex: number]: {
      [sectionId: string]: {
        [supersetId: string]: string[];
      };
    };
  };
}

interface WorkoutSessionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dayDate: string;
  sessionIndex: number;
  exercises: ExerciseDistribution[];
  mesocycleId: string;
  microcycleIndex: number;
  parameterValues: Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>;
  onSaveParameters: (
    mesocycleId: string,
    microcycleIndex: number,
    methodId: string,
    sessionIndex: number,
    exerciseId: string,
    parameters: Record<string, string | number>
  ) => void;
  dailyIntensityData?: any[];
  onIntensityChange?: (date: string, intensity: IntensityLevel) => void;
  onSessionIntensityChange?: (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => void;
  totalSessionsOnDay?: number;
  trainingDay?: TrainingDay;
  availableTests?: any[];
  availableEvents?: any[];
  onAddTestEvent?: (dayDate: string, type: 'test' | 'event', testEventId: string, testEventName: string, isNew: boolean, comments?: string) => void;
  onDeleteTestEvent?: (dayDate: string, type: 'test' | 'event', name: string) => void;
  onUpdateTestComment?: (testId: string, comments: string) => void;
  onUpdateTestValues?: (testId: string, updates: { preTestValue?: number; goalValue?: number; comments?: string }) => void;
  onUpdateEventComment?: (eventId: string, comments: string) => void;
  copiedSession?: { exercises: ExerciseDistribution[]; sections?: any[]; sourceDate: string; sessionIndex: number } | null;
  copiedSection?: { exercises: ExerciseDistribution[]; sections: any[]; sourceSectionId: string; sourceDayDate: string; sourceSessionIndex: number } | null;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onCopySection?: (sectionId: string) => void;
  onPasteSection?: (dayDate: string, sessionIndex: number) => void;
  sessionNameFromState?: string;
  onRenameSession?: (dayDate: string, sessionIndex: number, newName: string) => void;
  // Props for sections and supersets from Step 1
  sessionSections?: SessionSectionProp[];
  supersets?: SupersetMappingProp;
  onSectionsChange?: (sections: SessionSectionProp[]) => void;
  onSupersetsChange?: (supersets: SupersetMappingProp) => void;
  // Toolbox data for parameter visibility
  toolboxData?: ToolboxDatabase;
  // Sync exercise distribution changes back to Step 1
  allExerciseDistribution?: ExerciseDistribution[];
  onDistributionChange?: (distribution: ExerciseDistribution[]) => void;
  // Microcycle dates for chronological session parameter assignment
  microcycleDates?: string[];
  // When true, skip reading session intensity from global localStorage keys
  // and always derive from dailyIntensityData (used in Athlete Calendar context)
  useExternalIntensityOnly?: boolean;
  // When true, use AdHocMethodSelectionDialog instead of MethodSelectionDialog
  // Allows selecting from all toolbox methods instead of periodization-configured methods
  isAdHocSession?: boolean;
  // Athlete context for baseline value auto-fill
  selectedAthleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
  // Callback to open the AI assistant panel from within the dialog
  onOpenAIAssistant?: (ctx: FocusedSessionContext) => void;
  // Increment to force a full rebuild of exercise parameters from updated parameterValues
  forceParamRefresh?: number;
  // When true the sheet is opened from the Session Library — hide the "Save to Library"
  // button (already in the library) and show only "Save Changes"
  isLibrarySession?: boolean;
  // Athlete connection ID — when present, the exercise history icon appears on each exercise row
  athleteConnectionId?: string;
  // Live athlete_schedule entry — when present, param overrides from mobile coach edits
  // are applied on top of the plan-derived params so desktop sees mobile changes.
  liveScheduleEntry?: {
    rowId: string;
    /** Day-level intensity edited on mobile. */
    rowIntensity?: string | null;
    sessions: Array<{
      id: string;
      /** Session-level notes edited on mobile. */
      notes?: string;
      /** Session-level intensity edited on mobile. */
      intensity?: string | null;
      exercises: Array<{
        id: string;
        /** Stable library exercise ID — used as fallback lookup key when the
         *  ExerciseDistribution.id has changed since the row was last synced. */
        exerciseLibraryId?: string;
        plannedParams?: Record<string, string | number>;
        /** Exercise-level notes edited on mobile. */
        notes?: string;
        /** Section ID this exercise belongs to — used to apply section notes. */
        sectionId?: string;
        /** Section-level notes edited on mobile. */
        sectionNotes?: string;
        /** True when this exercise was added via the mobile coach app (not in the plan). */
        mobileAdded?: boolean;
        mobileEdited?: boolean;
        // Fields needed to render mobile-added exercises on desktop:
        name?: string;
        order?: number;
        isCircuit?: boolean;
        methodKey?: string;
        plannedSets?: number;
        sectionName?: string;
        sectionOrder?: number;
        supersetId?: string;
        circuitRounds?: string;
        /** Which parameter columns the mobile coach made visible — used to restore
         *  column visibility on the desktop so hidden params stay hidden. */
        visibleParams?: string[];
      }>;
    }>;
  };
}

/**
 * Converts LiveScheduleExercise[] → WorkoutSection[] so that exercises added
 * via the mobile coach app (mobileAdded: true) can be rendered on the desktop
 * even when the plan's exerciseDistribution has no entries for that date.
 */
type LiveExerciseForDesktop = {
  id: string;
  exerciseLibraryId?: string;
  plannedParams?: Record<string, string | number>;
  notes?: string;
  sectionId?: string;
  sectionNotes?: string;
  mobileAdded?: boolean;
  name?: string;
  order?: number;
  isCircuit?: boolean;
  methodKey?: string;
  plannedSets?: number;
  sectionName?: string;
  sectionOrder?: number;
  supersetId?: string;
  circuitRounds?: string;
  visibleParams?: string[];
};

/**
 * Computes ParameterVisibilityOverrides from mobile-set visibleParams.
 * Params in visibleParams → true, all others found in plannedParams → false.
 */
function computeLiveVisibilityOverrides(
  liveExercises: LiveExerciseForDesktop[]
): ParameterVisibilityOverrides {
  const overrides: ParameterVisibilityOverrides = {};
  for (const ex of liveExercises) {
    if (!ex.visibleParams || ex.visibleParams.length === 0) continue;
    const visible = new Set(ex.visibleParams);
    // Collect all parameter base names from plannedParams
    for (const key of Object.keys(ex.plannedParams ?? {})) {
      if (/^sets?$/i.test(key)) continue;
      if (key.endsWith('_unit')) continue;
      const m = key.match(/^(.+)_set\d+$/);
      const base = m ? m[1] : key;
      overrides[base] = visible.has(base);
    }
  }
  return overrides;
}

/**
 * Normalizes per-set parameter values by propagating plain-key values to empty
 * per-set keys. Mobile's getPlannedValue() displays the plain key as a visual
 * fallback when a per-set key is empty, making ALL sets appear filled even though
 * only Reps_set1/Reps are stored. This function makes the stored data match what
 * mobile shows, so desktop renders identical values for all sets.
 */
function propagatePlainKeyValues(
  params: Record<string, string | number>
): Record<string, string | number> {
  const setsKey = Object.keys(params).find(k => /^sets?$/i.test(k));
  const setCount = setsKey ? Number(params[setsKey]) : 0;
  if (setCount === 0) return params;

  const result = { ...params };
  for (const key of Object.keys(params)) {
    if (/^sets?$/i.test(key) || /_set\d+$/i.test(key) || key.endsWith('_unit')) continue;
    const plainVal = params[key];
    if (plainVal === '' || plainVal === null || plainVal === undefined) continue;
    for (let si = 1; si <= setCount; si++) {
      const perSetKey = `${key}_set${si}`;
      const cur = result[perSetKey];
      if (!(perSetKey in result) || cur === '' || cur === null || cur === undefined) {
        result[perSetKey] = plainVal;
      }
    }
  }
  return result;
}

function buildSectionsFromLiveExercises(
  liveExercises: LiveExerciseForDesktop[]
): WorkoutSection[] {
  const sectionMap = new Map<string, { section: WorkoutSection; sectionOrder: number }>();

  for (let i = 0; i < liveExercises.length; i++) {
    const ex = liveExercises[i];
    const sectionId = ex.sectionId ?? 'section-0';

    if (!sectionMap.has(sectionId)) {
      sectionMap.set(sectionId, {
        sectionOrder: ex.sectionOrder ?? 0,
        section: {
          id: sectionId,
          name: ex.sectionName ?? 'Workout',
          order: ex.sectionOrder ?? 0,
          comments: ex.sectionNotes,
          exercises: [],
        },
      });
    }

    // Propagate plain-key values to empty per-set keys so all set rows show the
    // same value that mobile displayed via its getPlannedValue() fallback.
    const parameters = propagatePlainKeyValues({ ...(ex.plannedParams ?? {}) });

    const workoutEx: WorkoutExercise = {
      id: ex.id,
      exerciseId: ex.exerciseLibraryId ?? ex.id,
      exerciseName: ex.name ?? 'Exercise',
      methodId: ex.methodKey ?? '',
      categoryName: '',
      order: ex.order ?? i,
      parameters,
      notes: ex.notes,
      supersetId: ex.supersetId,
      isCircuit: ex.isCircuit,
      circuitRounds: ex.circuitRounds,
      parameterSource: 'toolbox',
    };

    sectionMap.get(sectionId)!.section.exercises.push(workoutEx);
  }

  return Array.from(sectionMap.values())
    .sort((a, b) => a.sectionOrder - b.sectionOrder)
    .map(({ section }) => ({
      ...section,
      exercises: section.exercises.sort((a, b) => a.order - b.order),
    }));
}

export function WorkoutSessionSheet({
  isOpen,
  onClose,
  dayDate,
  sessionIndex,
  exercises,
  mesocycleId,
  microcycleIndex,
  parameterValues,
  onSaveParameters,
  dailyIntensityData,
  onIntensityChange,
  onSessionIntensityChange,
  totalSessionsOnDay = 1,
  trainingDay,
  availableTests,
  availableEvents,
  onAddTestEvent,
  onDeleteTestEvent,
  onUpdateTestComment,
  onUpdateTestValues,
  onUpdateEventComment,
  copiedSession,
  copiedSection,
  onCopySession,
  onCopySection,
  onPasteSection,
  sessionNameFromState,
  onRenameSession,
  sessionSections: sessionSectionsProp,
  supersets: supersetsProp,
  onSectionsChange,
  onSupersetsChange,
  toolboxData,
  allExerciseDistribution,
  onDistributionChange,
  microcycleDates,
  useExternalIntensityOnly = false,
  isAdHocSession = false,
  selectedAthleteId,
  athletePerformanceParameters,
  onOpenAIAssistant,
  forceParamRefresh,
  isLibrarySession = false,
  athleteConnectionId,
  liveScheduleEntry,
}: WorkoutSessionSheetProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { libraries, updateExerciseInLibrary } = useCustomLibraries();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [sidebarCollapsedSections, setSidebarCollapsedSections] = useState<Record<string, boolean>>({});
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [isMethodSelectionOpen, setIsMethodSelectionOpen] = useState(false);
  const [selectedExercisesForMethod, setSelectedExercisesForMethod] = useState<ExerciseSelection[]>([]);
  const [sessionName, setSessionName] = useState<string>('');
  const [sessionComments, setSessionComments] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [sessionIntensity, setSessionIntensity] = useState<IntensityLevel>('5');
  const [dayIntensityPopoverOpen, setDayIntensityPopoverOpen] = useState(false);
  const [sessionIntensityPopoverOpen, setSessionIntensityPopoverOpen] = useState(false);
  const [isTestEventDialogOpen, setIsTestEventDialogOpen] = useState(false);
  const [testsEventsExpanded, setTestsEventsExpanded] = useState(true);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const [saveLibOpen, setSaveLibOpen] = useState(false);
  
  // Parameters database hook for test method dropdown
  const { data: parametersData, addParameter } = useParametersDataV2();
  const { data: parametersToolboxData } = useToolboxData();
  
  // Exercise detail dialog state
  const [detailExercise, setDetailExercise] = useState<WorkoutExercise | null>(null);

  // Exercise history sheet state — exercise name when open, null when closed
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);

  // History cache: pre-fetched when the sheet opens so the panel shows instantly.
  // null = fetch in flight, Map = ready (keyed by lowercased exercise name).
  const [historyCache, setHistoryCache] = useState<Map<string, HistoryEntry[]> | null>(null);
  useEffect(() => {
    if (!isOpen || !athleteConnectionId) { setHistoryCache(null); return; }
    setHistoryCache(null);
    supabase
      .from('athlete_session_logs')
      .select('date, session_name, sets_logged')
      .eq('athlete_connection_id', athleteConnectionId)
      .not('completed_at', 'is', null)
      .order('date', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const cache = new Map<string, HistoryEntry[]>();
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          const setsLogged = (row.sets_logged as Array<{
            exerciseName: string;
            sets?: Array<{ setNumber: number; values: Record<string, string> }>;
          }>) ?? [];
          for (const ex of setsLogged) {
            if (!ex.exerciseName || !ex.sets?.length) continue;
            const key = ex.exerciseName.toLowerCase();
            if (!cache.has(key)) cache.set(key, []);
            const entries = cache.get(key)!;
            if (entries.length < 10) {
              entries.push({
                date: row.date as string,
                sessionName: row.session_name as string,
                sets: ex.sets.map(s => ({ setNumber: s.setNumber, values: s.values ?? {} })),
              });
            }
          }
        }
        setHistoryCache(cache);
      })
      .catch(() => setHistoryCache(new Map()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, athleteConnectionId]);

  // Circuit card detail dialog state (clicking circuit name)
  const [circuitDetailExercise, setCircuitDetailExercise] = useState<WorkoutExercise | null>(null);

  // Circuit sub-exercise detail dialog state (clicking sub-exercise name)
  const [circuitSubDetail, setCircuitSubDetail] = useState<{ exerciseId: string; libraryId: string; exerciseName: string } | null>(null);

  // Change exercise library popup state
  const [changeExerciseTarget, setChangeExerciseTarget] = useState<string | null>(null);

  // Progression/regression chain picker state
  interface ChainPickerEntry { id: string; toExerciseId: string; toExerciseName: string; direction: 'progression' | 'regression'; level: number; notes: string | null; }
  const [chainPickerTarget, setChainPickerTarget] = useState<{ exId: string; exerciseId: string; exerciseName: string } | null>(null);
  const [chainPickerEntries, setChainPickerEntries] = useState<ChainPickerEntry[]>([]);
  const [chainPickerLoading, setChainPickerLoading] = useState(false);

  // Parameter visibility overrides (loaded from localStorage, saved on save)
  const [parameterVisibilityOverrides, setParameterVisibilityOverrides] = useState<ParameterVisibilityOverrides>(() => {
    const metadataKey = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
    try {
      const stored = localStorage.getItem(metadataKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.parameterVisibility || {};
      }
    } catch {}
    return {};
  });

  // Helper function to build sections from exercises - accepts parameterValues explicitly to avoid stale closure
  const buildSectionsFromExercises = (
    exercisesList: ExerciseDistribution[],
    currentParamValues: typeof parameterValues
  ): WorkoutSection[] => {
    // Use sessionSections prop if available (from Step 1)
    if (sessionSectionsProp && sessionSectionsProp.length > 0) {
      const sessionSpecificSections = sessionSectionsProp.filter(
        s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
      );
      
      if (sessionSpecificSections.length > 0) {
        return sessionSpecificSections
          .sort((a, b) => a.order - b.order)
          .map(section => {
            const sectionExercises = exercisesList
              .filter((ex: any) => ex.sectionId === section.id)
              .map((ex, idx) => {
                // ===== CIRCUIT BLOCKS: Pass circuit fields through directly =====
                if (ex.isCircuit) {
                  return {
                    id: ex.id || ex.exerciseId,
                    exerciseId: ex.exerciseId,
                    exerciseName: ex.exerciseName,
                    methodId: ex.methodId,
                    categoryName: ex.categoryName || '',
                    order: ex.order ?? idx,
                    parameters: {},
                    isCircuit: true,
                    circuitId: ex.circuitId,
                    circuitLibraryId: ex.circuitLibraryId,
                    circuitExercises: ex.circuitExercises,
                    circuitRounds: ex.circuitRounds,
                    circuitRestBetweenRounds: ex.circuitRestBetweenRounds,
                    circuitRestBetweenExercises: ex.circuitRestBetweenExercises,
                    circuitComments: ex.circuitComments,
                  } as WorkoutExercise;
                }

                // ===== TOOLBOX-SOURCED EXERCISES: Generate blank parameters =====
                // If this exercise was added via ad-hoc dialog (parameterSource === 'toolbox'),
                // skip periodization lookup entirely and build blank parameters from toolbox
                if ((ex as any).parameterSource === 'toolbox') {
                  // Get method parameters from toolbox
                  const methodParts = (ex.methodId ?? '').split(' - ');
                  const toolboxCategory = methodParts[0];
                  const toolboxSubCategory = methodParts.length > 1 ? methodParts.slice(1).join(' - ') : '';
                  
                  const methodEntries = toolboxData?.entries.filter(entry => {
                    const categoryMatch = entry.category.toLowerCase().trim() === toolboxCategory.toLowerCase().trim();
                    const subCategoryMatch = toolboxSubCategory === '' 
                      ? (!entry.subCategory || entry.subCategory.trim() === '')
                      : (entry.subCategory?.toLowerCase().trim() === toolboxSubCategory.toLowerCase().trim());
                    return categoryMatch && subCategoryMatch;
                  }) || [];
                  
                  // Find set parameter
                  const setParamEntry = methodEntries.find(e => e.isSetParameter);
                  const setParamName = setParamEntry?.parameterName ||
                                      methodEntries.find(e => /^sets?$/i.test(e.parameterName))?.parameterName ||
                                      'Sets';

                  // Restore previously saved values for this toolbox exercise
                  let savedParamsA: Record<string, string | number> =
                    (currentParamValues?.[mesocycleId]?.[microcycleIndex]?.[ex.methodId ?? '']?.[sessionIndex] as Record<string, string | number>) ?? {};
                  // Fallback: read from saved workoutSections localStorage when parameterValues has no entry
                  if (Object.keys(savedParamsA).length === 0) {
                    try {
                      const savedJson = localStorage.getItem(`workoutSections_${mesocycleId}_${dayDate}_${sessionIndex}`);
                      if (savedJson) {
                        const savedSects = JSON.parse(savedJson) as WorkoutSection[];
                        const savedEx = savedSects.flatMap(s => s.exercises).find(e => e.exerciseId === ex.exerciseId);
                        if (savedEx?.parameters) savedParamsA = savedEx.parameters as Record<string, string | number>;
                      }
                    } catch {}
                  }
                  // Fallback: adhocPlannedParams on the exercise itself (preserved across copy-paste)
                  if (Object.keys(savedParamsA).length === 0) {
                    const adhoc = (ex as any).adhocPlannedParams;
                    if (adhoc && typeof adhoc === 'object' && Object.keys(adhoc).length > 0) {
                      savedParamsA = adhoc as Record<string, string | number>;
                    }
                  }
                  const savedSetCountA = savedParamsA[setParamName];
                  const setCount = (savedSetCountA !== undefined && savedSetCountA !== '' && !isNaN(Number(savedSetCountA)))
                    ? Number(savedSetCountA)
                    : 3;

                  // Build parameters, restoring saved values where available
                  const blankParameters: Record<string, string | number> = {};
                  blankParameters[setParamName] = setCount;

                  methodEntries.forEach(entry => {
                    if (entry.isFrequencyParameter) return;
                    const paramName = entry.parameterName;

                    // Add unit if quantitative (restore saved or default to first option)
                    if (entry.parameterType === 'quantitative' && entry.options?.length > 0) {
                      blankParameters[`${paramName}_unit`] = savedParamsA[`${paramName}_unit`] ?? entry.options[0];
                    }

                    // Add base key (required for WorkoutExerciseCard column derivation)
                    if (!entry.isSetParameter) {
                      blankParameters[paramName] = savedParamsA[paramName] ?? '';
                    }

                    // Create per-set keys, restoring saved values
                    if (!entry.isSetParameter && setCount > 0) {
                      for (let i = 1; i <= setCount; i++) {
                        blankParameters[`${paramName}_set${i}`] = savedParamsA[`${paramName}_set${i}`] ?? '';
                      }
                    }
                  });
                  
                  return {
                    id: (ex as any).id || ex.exerciseId,
                    exerciseId: ex.exerciseId,
                    exerciseName: ex.exerciseName,
                    methodId: ex.methodId,
                    categoryName: ex.categoryName || '',
                    order: (ex as any).order ?? idx,
                    supersetId: (ex as any).supersetId,
                    parameters: blankParameters,
                    notes: ex.notes,
                    parameterSource: 'toolbox' as const,
                  };
                }

                // ===== PERIODIZATION-SOURCED EXERCISES: Use method periodization table =====
                // Priority lookup: category-specific first (for split methods), then base method
                const hasValidCategory = ex.categoryName && 
                  ex.categoryName !== 'Uncategorized' && 
                  ex.categoryName !== '';
                const fullMethodKey = hasValidCategory 
                  ? `${ex.methodId}::${ex.categoryName}` 
                  : ex.methodId;
                
                // Calculate chronological session index for this exercise within the MICROCYCLE
                // This ensures exercises get the correct split method parameters based on their order
                const exerciseForLookup = {
                  id: ex.id || ex.exerciseId,
                  exerciseId: ex.exerciseId,
                  methodId: ex.methodId,
                  categoryName: ex.categoryName || '',
                  dayDate: ex.dayDate,
                  sessionIndex: ex.sessionIndex,
                  order: ex.order ?? idx,
                };
                
                const rawChronologicalIndex = getMethodSessionIndex(
                  exerciseForLookup,
                  (allExerciseDistribution || []).map(e => ({
                    id: e.id || e.exerciseId,
                    exerciseId: e.exerciseId,
                    methodId: e.methodId,
                    categoryName: e.categoryName || '',
                    dayDate: e.dayDate,
                    sessionIndex: e.sessionIndex,
                    order: e.order ?? 0,
                  })),
                  microcycleDates || []
                );
                
                // Count how many session parameter sets are defined for this method
                const methodParamsForSession = currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey] ||
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId] || {};
                const sessionCount = Object.keys(methodParamsForSession).filter(k => !isNaN(Number(k))).length;
                
                // Apply modulo if there are more exercises than sessions
                const chronologicalSessionIndex = sessionCount > 0
                  ? getModuloSessionIndex(rawChronologicalIndex, sessionCount)
                  : rawChronologicalIndex;

                // Debug: log param lookup details to help trace offset bugs
                if (process.env.NODE_ENV !== 'production') {
                  console.log('[WSS param lookup]', {
                    exerciseName: ex.exerciseName ?? ex.exerciseId,
                    method: fullMethodKey,
                    mesocycleId,
                    microcycleIndex,
                    rawChronologicalIndex,
                    sessionCount,
                    chronologicalSessionIndex,
                    allSessions: currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey],
                  });
                }

                // Merge ALL matching key-format paths so base params (Periodization Table, stored
                // under ex.methodId) survive even when per-set edits created a sparse fullMethodKey
                // entry. More-specific entries spread last and override less-specific ones.
                const baseMethodKeyForLookup = (ex.methodId ?? '').split('::')[0];
                const storedParams: Record<string, string | number> = {
                  // Base session 0 – least specific first
                  ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[baseMethodKeyForLookup]?.[0] || {}),
                  ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[0] || {}),
                  ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[0] || {}),
                  // Chronological session overrides
                  ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[baseMethodKeyForLookup]?.[chronologicalSessionIndex] || {}),
                  ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[chronologicalSessionIndex] || {}),
                  ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[chronologicalSessionIndex] || {}),
                };

                // PRIMARY: Derive parameters from storedParams (method periodization grid)
                // Filter out _unit keys and per-set keys (e.g. Reps_set1) — the latter can
                // appear when storedParams was previously written by handleSave which stores
                // the full expanded exercise.parameters (base + per-set).  Treating per-set
                // keys as base params causes column bloat and can make visibleParams empty.
                let methodParams: { name: string; type: string; isSetParameter?: boolean; defaultValue?: any; unit?: string }[] = Object.keys(storedParams)
                  .filter(k => !k.endsWith('_unit') && !/_set\d+$/i.test(k))
                  .map((name) => ({
                    name,
                    type: typeof (storedParams as any)[name] === 'number' ? 'number' : 'text',
                    isSetParameter: /^sets?$/i.test(name) || /ground contacts/i.test(name),
                    defaultValue: (storedParams as any)[name],
                    unit: undefined
                  }));

                // Filter out stale keys from old template loads — only show params defined in
                // the current toolbox for this method. If toolbox isn't loaded or has no entries
                // for this method, fall back to showing all (safe default).
                // Strip ::Category suffix for split methods (e.g. "LBRT - Strength::Squat" → "LBRT - Strength")
                // so the toolbox lookup matches the base method entry.
                const _baseMethodId1 = (ex.methodId ?? '').split('::')[0];
                const _tbEntries1 = (parametersToolboxData?.entries ?? []).filter(te => {
                  const mid = te.subCategory ? `${te.category} - ${te.subCategory}` : te.category;
                  return mid === _baseMethodId1;
                });
                if (_tbEntries1.length > 0) {
                  const _validNames1 = new Set(_tbEntries1.map(te => te.parameterName));
                  methodParams = methodParams.filter(p => /^sets?$/i.test(p.name) || _validNames1.has(p.name));
                }

                // FALLBACK: Only use static dictionary if storedParams is empty
                if (methodParams.length === 0) {
                  methodParams = getParametersForMethod(ex.methodId) || [];
                }
                
                let exerciseParams: Record<string, string | number> = {};
                if (storedParams && typeof storedParams === 'object' && !Array.isArray(storedParams)) {
                  exerciseParams = storedParams as Record<string, string | number>;
                }
                // Per-exercise overrides take precedence over method-level params
                if (ex.parameterOverrides && Object.keys(ex.parameterOverrides).length > 0) {
                  exerciseParams = { ...exerciseParams, ...ex.parameterOverrides };
                }

                const setParamName = methodParams.find(p => p.isSetParameter)?.name ||
                                    methodParams.find(p => /^sets?$/i.test(p.name))?.name;
                const setCount = setParamName ? Number(exerciseParams[setParamName] || 0) : 0;
                
                const parameters: Record<string, string | number> = {};
                methodParams.forEach(param => {
                  if (param.unit) {
                    parameters[`${param.name}_unit`] = param.unit;
                  }
                  
                  if (param.name === setParamName) {
                    parameters[param.name] = Number(exerciseParams[param.name] ?? param.defaultValue ?? 0);
                  } else if (setCount > 0) {
                    for (let i = 1; i <= setCount; i++) {
                      const perSetKey = `${param.name}_set${i}`;
                      const legacyKey = `${ex.exerciseId}_${param.name}`;
                      parameters[perSetKey] = 
                        (exerciseParams as any)[perSetKey] ?? 
                        exerciseParams[param.name] ?? 
                        (exerciseParams as any)[legacyKey] ?? 
                        param.defaultValue ?? '';
                    }
                    parameters[param.name] = exerciseParams[param.name] ?? param.defaultValue ?? '';
                  } else {
                    const legacyKey = `${ex.exerciseId}_${param.name}`;
                    parameters[param.name] = 
                      exerciseParams[param.name] ?? 
                      (exerciseParams as any)[legacyKey] ?? 
                      param.defaultValue ?? '';
                  }
                });
                
                return {
                  id: (ex as any).id || ex.exerciseId,
                  exerciseId: ex.exerciseId,
                  exerciseName: ex.exerciseName,
                  methodId: ex.methodId,
                  categoryName: ex.categoryName || '',
                  order: (ex as any).order ?? idx,
                  supersetId: (ex as any).supersetId,
                  parameters,
                  notes: ex.notes,
                };
              })
              .sort((a, b) => a.order - b.order);
            
            return {
              id: section.id,
              name: section.name,
              order: section.order,
              exercises: sectionExercises,
              comments: section.comments
            };
          });
      }
    }
    
    // Fallback: Group exercises by categoryName
    const sectionsMap = new Map<string, WorkoutExercise[]>();
    
    exercisesList.forEach((ex, index) => {
      const sectionName = ex.categoryName || 'Main Work';
      if (!sectionsMap.has(sectionName)) {
        sectionsMap.set(sectionName, []);
      }

      // ===== CIRCUIT BLOCKS: Pass circuit fields through directly =====
      if (ex.isCircuit) {
        sectionsMap.get(sectionName)!.push({
          id: ex.id || ex.exerciseId,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          methodId: ex.methodId,
          categoryName: ex.categoryName || '',
          order: ex.order ?? index,
          parameters: {},
          isCircuit: true,
          circuitId: ex.circuitId,
          circuitLibraryId: ex.circuitLibraryId,
          circuitExercises: ex.circuitExercises,
          circuitRounds: ex.circuitRounds,
          circuitRestBetweenRounds: ex.circuitRestBetweenRounds,
          circuitRestBetweenExercises: ex.circuitRestBetweenExercises,
          circuitComments: ex.circuitComments,
        } as WorkoutExercise);
        return;
      }

      // ===== TOOLBOX-SOURCED EXERCISES: Generate blank parameters =====
      // If this exercise was added via ad-hoc dialog (parameterSource === 'toolbox'),
      // skip periodization lookup entirely and build blank parameters from toolbox
      if ((ex as any).parameterSource === 'toolbox') {
        // Get method parameters from toolbox
        const methodParts = (ex.methodId ?? '').split(' - ');
        const toolboxCategory = methodParts[0];
        const toolboxSubCategory = methodParts.length > 1 ? methodParts.slice(1).join(' - ') : '';
        
        const methodEntries = toolboxData?.entries.filter(entry => {
          const categoryMatch = entry.category.toLowerCase().trim() === toolboxCategory.toLowerCase().trim();
          const subCategoryMatch = toolboxSubCategory === '' 
            ? (!entry.subCategory || entry.subCategory.trim() === '')
            : (entry.subCategory?.toLowerCase().trim() === toolboxSubCategory.toLowerCase().trim());
          return categoryMatch && subCategoryMatch;
        }) || [];
        
        // Find set parameter
        const setParamEntry = methodEntries.find(e => e.isSetParameter);
        const setParamName = setParamEntry?.parameterName ||
                            methodEntries.find(e => /^sets?$/i.test(e.parameterName))?.parameterName ||
                            'Sets';

        // Restore previously saved values for this toolbox exercise
        let savedParamsB: Record<string, string | number> =
          (currentParamValues?.[mesocycleId]?.[microcycleIndex]?.[ex.methodId ?? '']?.[sessionIndex] as Record<string, string | number>) ?? {};
        // Fallback: read from saved workoutSections localStorage when parameterValues has no entry
        if (Object.keys(savedParamsB).length === 0) {
          try {
            const savedJson = localStorage.getItem(`workoutSections_${mesocycleId}_${dayDate}_${sessionIndex}`);
            if (savedJson) {
              const savedSects = JSON.parse(savedJson) as WorkoutSection[];
              const savedEx = savedSects.flatMap(s => s.exercises).find(e => e.exerciseId === ex.exerciseId);
              if (savedEx?.parameters) savedParamsB = savedEx.parameters as Record<string, string | number>;
            }
          } catch {}
        }
        // Fallback: adhocPlannedParams on the exercise itself (preserved across copy-paste)
        if (Object.keys(savedParamsB).length === 0) {
          const adhoc = (ex as any).adhocPlannedParams;
          if (adhoc && typeof adhoc === 'object' && Object.keys(adhoc).length > 0) {
            savedParamsB = adhoc as Record<string, string | number>;
          }
        }
        const savedSetCountB = savedParamsB[setParamName];
        const setCount = (savedSetCountB !== undefined && savedSetCountB !== '' && !isNaN(Number(savedSetCountB)))
          ? Number(savedSetCountB)
          : 3;

        // Build parameters, restoring saved values where available
        const blankParameters: Record<string, string | number> = {};
        blankParameters[setParamName] = setCount;

        methodEntries.forEach(entry => {
          if (entry.isFrequencyParameter) return;
          const paramName = entry.parameterName;

          // Add unit if quantitative (restore saved or default to first option)
          if (entry.parameterType === 'quantitative' && entry.options?.length > 0) {
            blankParameters[`${paramName}_unit`] = savedParamsB[`${paramName}_unit`] ?? entry.options[0];
          }

          // Add base key (required for WorkoutExerciseCard column derivation)
          if (!entry.isSetParameter) {
            blankParameters[paramName] = savedParamsB[paramName] ?? '';
          }

          // Create per-set keys, restoring saved values
          if (!entry.isSetParameter && setCount > 0) {
            for (let i = 1; i <= setCount; i++) {
              blankParameters[`${paramName}_set${i}`] = savedParamsB[`${paramName}_set${i}`] ?? '';
            }
          }
        });
        
        sectionsMap.get(sectionName)!.push({
          id: (ex as any).id || ex.exerciseId,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          methodId: ex.methodId,
          categoryName: ex.categoryName || '',
          order: (ex as any).order ?? index,
          supersetId: (ex as any).supersetId,
          parameters: blankParameters,
          notes: ex.notes,
          parameterSource: 'toolbox' as const,
        });
        
        return; // Skip periodization lookup
      }
      
      // ===== PERIODIZATION-SOURCED EXERCISES: Use method periodization table =====
      // Priority lookup: category-specific first (for split methods), then base method
      const hasValidCategory = ex.categoryName && 
        ex.categoryName !== 'Uncategorized' && 
        ex.categoryName !== '';
      const fullMethodKey = hasValidCategory 
        ? `${ex.methodId}::${ex.categoryName}` 
        : ex.methodId;
      
      // Calculate chronological session index for this exercise within the MICROCYCLE
      const exerciseForLookup = {
        id: (ex as any).id || ex.exerciseId,
        exerciseId: ex.exerciseId,
        methodId: ex.methodId,
        categoryName: ex.categoryName || '',
        dayDate: ex.dayDate,
        sessionIndex: ex.sessionIndex,
        order: (ex as any).order ?? index,
      };
      
      const rawChronologicalIndex = getMethodSessionIndex(
        exerciseForLookup,
        (allExerciseDistribution || []).map(e => ({
          id: (e as any).id || e.exerciseId,
          exerciseId: e.exerciseId,
          methodId: e.methodId,
          categoryName: e.categoryName || '',
          dayDate: e.dayDate,
          sessionIndex: e.sessionIndex,
          order: (e as any).order ?? 0,
        })),
        microcycleDates || []
      );
      
      // Count how many session parameter sets are defined for this method
      const methodParamsForSession = currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey] ||
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId] || {};
      const sessionCount = Object.keys(methodParamsForSession).filter(k => !isNaN(Number(k))).length;
      
      // Apply modulo if there are more exercises than sessions
      const chronologicalSessionIndex = sessionCount > 0 
        ? getModuloSessionIndex(rawChronologicalIndex, sessionCount)
        : rawChronologicalIndex;
      
      // Merge ALL matching key-format paths so base params always survive even when
      // per-set edits created a sparse fullMethodKey entry.
      const baseMethodKeyB = (ex.methodId ?? '').split('::')[0];
      const storedParams: Record<string, string | number> = {
        ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[baseMethodKeyB]?.[0] || {}),
        ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[0] || {}),
        ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[0] || {}),
        ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[baseMethodKeyB]?.[chronologicalSessionIndex] || {}),
        ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[chronologicalSessionIndex] || {}),
        ...(currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[chronologicalSessionIndex] || {}),
      };



      // PRIMARY: Derive parameters from storedParams (method periodization grid)
      // Filter out _unit keys and per-set keys (e.g. Reps_set1) — the latter can
      // appear when storedParams was previously written by handleSave which stores
      // the full expanded exercise.parameters (base + per-set).  Treating per-set
      // keys as base params causes column bloat and can make visibleParams empty.
      let methodParams: { name: string; type: string; isSetParameter?: boolean; defaultValue?: any; unit?: string }[] = Object.keys(storedParams)
        .filter(k => !k.endsWith('_unit') && !/_set\d+$/i.test(k))
        .map((name) => ({
          name,
          type: typeof (storedParams as any)[name] === 'number' ? 'number' : 'text',
          isSetParameter: /^sets?$/i.test(name) || /ground contacts/i.test(name),
          defaultValue: (storedParams as any)[name],
          unit: undefined
        }));

      // Filter out stale keys from old template loads — only show params defined in
      // the current toolbox for this method. If toolbox isn't loaded or has no entries
      // for this method, fall back to showing all (safe default).
      const _tbEntries2 = (parametersToolboxData?.entries ?? []).filter(te => {
        const mid = te.subCategory ? `${te.category} - ${te.subCategory}` : te.category;
        return mid === (ex.methodId ?? '');
      });
      if (_tbEntries2.length > 0) {
        const _validNames2 = new Set(_tbEntries2.map(te => te.parameterName));
        methodParams = methodParams.filter(p => /^sets?$/i.test(p.name) || _validNames2.has(p.name));
      }

      // FALLBACK: Only use static dictionary if storedParams is empty
      if (methodParams.length === 0) {
        methodParams = getParametersForMethod(ex.methodId) || [];
      }
      
      let exerciseParams: Record<string, string | number> = {};
      if (storedParams && typeof storedParams === 'object' && !Array.isArray(storedParams)) {
        exerciseParams = storedParams as Record<string, string | number>;
      }
      // Per-exercise overrides take precedence over method-level params
      if (ex.parameterOverrides && Object.keys(ex.parameterOverrides).length > 0) {
        exerciseParams = { ...exerciseParams, ...ex.parameterOverrides };
      }

      const setParamName = methodParams.find(p => p.isSetParameter)?.name ||
                          methodParams.find(p => /^sets?$/i.test(p.name))?.name;
      const setCount = setParamName ? Number(exerciseParams[setParamName] || 0) : 0;
      
      const parameters: Record<string, string | number> = {};
      methodParams.forEach(param => {
        if (param.unit) {
          parameters[`${param.name}_unit`] = param.unit;
        }
        
        if (param.name === setParamName) {
          parameters[param.name] = Number(exerciseParams[param.name] ?? param.defaultValue ?? 0);
        } else if (setCount > 0) {
          for (let i = 1; i <= setCount; i++) {
            const perSetKey = `${param.name}_set${i}`;
            const legacyKey = `${ex.exerciseId}_${param.name}`;
            parameters[perSetKey] = 
              (exerciseParams as any)[perSetKey] ?? 
              exerciseParams[param.name] ?? 
              (exerciseParams as any)[legacyKey] ?? 
              param.defaultValue ?? '';
          }
          parameters[param.name] = exerciseParams[param.name] ?? param.defaultValue ?? '';
        } else {
          const legacyKey = `${ex.exerciseId}_${param.name}`;
          parameters[param.name] = 
            exerciseParams[param.name] ?? 
            (exerciseParams as any)[legacyKey] ?? 
            param.defaultValue ?? '';
        }
      });
      
      sectionsMap.get(sectionName)!.push({
        id: (ex as any).id || ex.exerciseId,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        methodId: ex.methodId,
        categoryName: ex.categoryName || '',
        order: index,
        parameters,
        notes: ex.notes,
      });
    });
    
    return Array.from(sectionsMap.entries()).map(([name, exs], idx) => ({
      id: `section-${idx}`,
      name,
      order: idx,
      exercises: exs.sort((a, b) => a.order - b.order)
    }));
  };

  const [workoutSections, setWorkoutSections] = useState<WorkoutSection[]>(() => {
    const sectionsKey = `workoutSections_${mesocycleId}_${dayDate}_${sessionIndex}`;

    if (exercises.length > 0) {
      const built = buildSectionsFromExercises(exercises, parameterValues);
      // Merge saved section comments back — buildSectionsFromExercises only touches
      // exercise parameters, so section-level comments are stripped on every rebuild.
      try {
        const saved = localStorage.getItem(sectionsKey);
        if (saved) {
          const savedSects = JSON.parse(saved) as WorkoutSection[];
          const commentMap = new Map(savedSects.map(s => [s.id, s.comments]));
          return built.map(s => ({ ...s, comments: commentMap.get(s.id) ?? s.comments }));
        }
      } catch { /* ignore */ }
      return built;
    }

    // Only use localStorage if exercises prop is empty (backward compatibility)
    const storedSections = localStorage.getItem(sectionsKey);
    if (storedSections) {
      try {
        return JSON.parse(storedSections);
      } catch {
        // Fall through to default
      }
    }

    // Default empty state
    return [{ id: 'section-0', name: 'Uncategorized', order: 0, exercises: [] }];
  });
  
  // Create a stable key to detect when parameterValues actually has data for this microcycle
  const parameterValuesKey = useMemo(() => {
    const microData = parameterValues[mesocycleId]?.[microcycleIndex];
    if (!microData) return 'empty';
    return JSON.stringify(Object.keys(microData).sort());
  }, [parameterValues, mesocycleId, microcycleIndex]);

  // Track previous exercise count to detect additions vs deletions
  const prevExerciseCountRef = useRef(exercises.length);
  const hasInitializedRef = useRef(false);
  // Track whether live schedule overrides have been applied in this open cycle.
  // Prevents double-apply when liveScheduleEntry is already defined at open time,
  // and enables a late-apply when it arrives after init (race-condition fix).
  const liveOverrideAppliedRef = useRef(false);
  // Track freshly added exercise IDs to skip redundant rebuilds (they already have blank params)
  const freshlyAddedExerciseIdsRef = useRef<Set<string>>(new Set());
  
  // Sync workoutSections when dialog opens or exercises are ADDED (not deleted)
  // CRITICAL: Merge existing parameters with new exercises to preserve toolbox-sourced blank params
  useEffect(() => {
    if (isOpen && exercises.length > 0) {
      const prevCount = prevExerciseCountRef.current;
      const currentCount = exercises.length;
      
      // Only rebuild if:
      // 1. First time opening (not initialized)
      // 2. Exercises were added (count increased) AND we're NOT in ad-hoc mode.
      //    In ad-hoc sessions, handleAdHocMethodSelected updates workoutSections
      //    directly with the correct section structure.  Rebuilding from the exercises
      //    prop (which groups by categoryName) would split same-section exercises into
      //    different sections or discard them, causing the "exercise disappears" bug.
      if (!hasInitializedRef.current) {
        // FRESH OPEN: use buildSectionsFromExercises directly — it already restores
        // saved parameter values from parameterValues (including toolbox exercises).
        // Do NOT merge with stale in-memory workoutSections from a previous dialog open,
        // as that would overwrite the restored values with old blank ones.
        const newSections = buildSectionsFromExercises(exercises, parameterValues);
        // Merge saved section comments — they're stripped by buildSectionsFromExercises
        const sectionsWithComments = (() => {
          try {
            const sectionsKey = `workoutSections_${mesocycleId}_${dayDate}_${sessionIndex}`;
            const saved = localStorage.getItem(sectionsKey);
            if (saved) {
              const savedSects = JSON.parse(saved) as WorkoutSection[];
              const commentMap = new Map(savedSects.map(s => [s.id, s.comments]));
              return newSections.map(s => ({ ...s, comments: commentMap.get(s.id) ?? s.comments }));
            }
          } catch { /* ignore */ }
          return newSections;
        })();
        // Apply live athlete_schedule overrides (from mobile coach edits) on top of
        // plan-derived data so desktop sees ALL changes made in the mobile coach app.
        let sectionsToSet = sectionsWithComments;
        if (liveScheduleEntry) {
          // Mark as applied so the late-override effect skips (no double-apply).
          liveOverrideAppliedRef.current = true;
          const liveSession = liveScheduleEntry.sessions[sessionIndex];
          if (liveSession) {
            // ── Session-level fields ────────────────────────────────────────────────
            if (liveSession.notes !== undefined && liveSession.notes !== null) {
              setSessionComments(liveSession.notes);
            }
            if (liveSession.intensity) {
              setSessionIntensity(liveSession.intensity as IntensityLevel);
            }

            // ── Per-exercise overrides ──────────────────────────────────────────────
            // Build override maps keyed by BOTH the stored exercise id AND the stable
            // library id (handles cases where ExerciseDistribution.id has changed).
            const overrideMap = new Map<string, Record<string, string | number>>();
            const exNotesMap = new Map<string, string>();
            const sectionNotesMapLive = new Map<string, string>();

            for (const ex of (liveSession.exercises ?? [])) {
              // plannedParams
              if (ex.plannedParams && Object.keys(ex.plannedParams).length > 0) {
                overrideMap.set(ex.id, ex.plannedParams);
                if (ex.exerciseLibraryId) overrideMap.set(ex.exerciseLibraryId, ex.plannedParams);
              }
              // exercise notes
              if (ex.notes !== undefined) {
                exNotesMap.set(ex.id, ex.notes);
                if (ex.exerciseLibraryId) exNotesMap.set(ex.exerciseLibraryId, ex.notes);
              }
              // section notes (carried per-exercise)
              if (ex.sectionId && ex.sectionNotes !== undefined) {
                sectionNotesMapLive.set(ex.sectionId, ex.sectionNotes);
              }
            }

            const hasAnyOverride = overrideMap.size > 0 || exNotesMap.size > 0 || sectionNotesMapLive.size > 0;
            if (hasAnyOverride) {
              sectionsToSet = sectionsWithComments.map(section => ({
                ...section,
                comments: sectionNotesMapLive.get(section.id) ?? section.comments,
                exercises: section.exercises.map(ex => {
                  const overrides = overrideMap.get(ex.id) ?? overrideMap.get(ex.exerciseId ?? '');
                  const liveNotes = exNotesMap.get(ex.id) ?? exNotesMap.get(ex.exerciseId ?? '');
                  if (!overrides && liveNotes === undefined) return ex;
                  return {
                    ...ex,
                    parameters: overrides
                      ? propagatePlainKeyValues({ ...ex.parameters, ...overrides })
                      : ex.parameters,
                    notes: liveNotes !== undefined ? liveNotes : ex.notes,
                  };
                }),
              }));
            }
            // Append mobile-added exercises not present in the plan for this date
            {
              const existingIds = new Set<string>();
              sectionsToSet.forEach(s => s.exercises.forEach(ex => {
                existingIds.add(ex.id);
                if (ex.exerciseId) existingIds.add(ex.exerciseId);
              }));
              const mobileOnlyExsFresh = (liveSession.exercises ?? []).filter(ex =>
                ex.mobileAdded &&
                !existingIds.has(ex.id) &&
                !existingIds.has(ex.exerciseLibraryId ?? ' ')
              );
              if (mobileOnlyExsFresh.length > 0) {
                const liveSecs = buildSectionsFromLiveExercises(mobileOnlyExsFresh);
                const sectionMap = new Map(sectionsToSet.map(s => [s.id, s]));
                liveSecs.forEach(liveSection => {
                  const existing = sectionMap.get(liveSection.id);
                  if (existing) {
                    sectionMap.set(liveSection.id, {
                      ...existing,
                      exercises: [...existing.exercises, ...liveSection.exercises],
                    });
                  } else {
                    sectionMap.set(liveSection.id, liveSection);
                  }
                });
                sectionsToSet = Array.from(sectionMap.values()).sort((a, b) => a.order - b.order);
              }
            }
          }
        }
        freshlyAddedExerciseIdsRef.current.clear();
        setWorkoutSections(sectionsToSet);
        hasInitializedRef.current = true;
      } else if (currentCount > prevCount && !isAdHocSession) {
        // EXERCISE ADDED to already-open session: merge to preserve user-entered values
        // for existing exercises while giving the new exercise its built parameters.
        const newSections = buildSectionsFromExercises(exercises, parameterValues);

        // Build a map of existing exercise IDs to their current (user-edited) state
        const existingExerciseMap = new Map<string, WorkoutExercise>();
        workoutSections.forEach(section => {
          section.exercises.forEach(ex => {
            existingExerciseMap.set(ex.id, ex);
          });
        });

        const mergedSections = newSections.map(section => ({
          ...section,
          exercises: section.exercises.map(newEx => {
            const existing = existingExerciseMap.get(newEx.id);
            const isFreshlyAdded = freshlyAddedExerciseIdsRef.current.has(newEx.id);

            if (existing) {
              // Preserve current user-edited state — don't overwrite with rebuilt values
              return {
                ...newEx,
                parameters: existing.parameters,
                notes: existing.notes,
                eachSide: existing.eachSide,
                parameterSource: (existing as any).parameterSource,
              };
            }

            if (isFreshlyAdded) {
              // Freshly added via ad-hoc dialog — keep blank params from handleAdHocMethodSelected
              return newEx;
            }

            return newEx;
          })
        }));

        freshlyAddedExerciseIdsRef.current.clear();
        setWorkoutSections(mergedSections);
      }
      
      prevExerciseCountRef.current = currentCount;
    } else if (isOpen && exercises.length === 0 && !hasInitializedRef.current) {
      // Opening for a new/empty session — no plan exercises for this date.
      // Check if there are mobile-added exercises in the live schedule (e.g. exercises
      // added by the mobile coach app on a day that has no plan exercises).
      let initSections: WorkoutSection[] = [{ id: 'section-0', name: 'Uncategorized', order: 0, exercises: [] }];
      if (liveScheduleEntry) {
        const liveSession = liveScheduleEntry.sessions[sessionIndex];
        if (liveSession) {
          if (liveSession.notes !== undefined && liveSession.notes !== null) setSessionComments(liveSession.notes);
          if (liveSession.intensity) setSessionIntensity(liveSession.intensity as IntensityLevel);
          if ((liveSession.exercises ?? []).length > 0) {
            // Only lock the override flag when we actually got exercises — if exercises
            // are empty here (Supabase sync not yet complete), leave the flag false so the
            // race-condition effect below can re-apply once the data arrives.
            liveOverrideAppliedRef.current = true;
            initSections = buildSectionsFromLiveExercises(liveSession.exercises);
            // Restore mobile-set column visibility so hidden params stay hidden on desktop
            const visOverrides = computeLiveVisibilityOverrides(liveSession.exercises);
            if (Object.keys(visOverrides).length > 0) {
              setParameterVisibilityOverrides(visOverrides);
            }
          }
        }
      }
      setWorkoutSections(initSections);
      hasInitializedRef.current = true;
      prevExerciseCountRef.current = 0;
    }
  }, [isOpen, exercises.length, dayDate, sessionIndex, parameterValuesKey]);

  // Reset initialization flags when dialog closes
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      liveOverrideAppliedRef.current = false;
    }
  }, [isOpen]);

  // Race-condition fix: liveScheduleEntry may arrive AFTER the sheet was already
  // initialized (Supabase fetch completes after dialog opens). If the init effect ran
  // without liveScheduleEntry (it was undefined at that point), re-apply overrides now.
  useEffect(() => {
    if (!isOpen || !liveScheduleEntry || !hasInitializedRef.current || liveOverrideAppliedRef.current) return;
    const liveSession = liveScheduleEntry.sessions[sessionIndex];
    liveOverrideAppliedRef.current = true;
    if (!liveSession) return;

    // Session-level fields
    if (liveSession.notes !== undefined && liveSession.notes !== null) {
      setSessionComments(liveSession.notes);
    }
    if (liveSession.intensity) {
      setSessionIntensity(liveSession.intensity as IntensityLevel);
    }

    // ── Pure mobile session: no plan exercises → replace sections entirely ──────
    // The init effect set an "Uncategorized" placeholder when liveScheduleEntry
    // was not yet available; now that live data has arrived, replace it entirely
    // instead of merging so the ghost Uncategorized section doesn't persist.
    if (exercises.length === 0 && (liveSession.exercises ?? []).length > 0) {
      const liveSecs = buildSectionsFromLiveExercises(liveSession.exercises);
      setWorkoutSections(liveSecs);
      const visOverrides = computeLiveVisibilityOverrides(liveSession.exercises);
      if (Object.keys(visOverrides).length > 0) {
        setParameterVisibilityOverrides(prev => ({ ...prev, ...visOverrides }));
      }
      return;
    }

    // Per-exercise overrides
    const overrideMap = new Map<string, Record<string, string | number>>();
    const exNotesMap = new Map<string, string>();
    const sectionNotesMapLive = new Map<string, string>();

    for (const ex of (liveSession.exercises ?? [])) {
      if (ex.plannedParams && Object.keys(ex.plannedParams).length > 0) {
        overrideMap.set(ex.id, ex.plannedParams);
        if (ex.exerciseLibraryId) overrideMap.set(ex.exerciseLibraryId, ex.plannedParams);
      }
      if (ex.notes !== undefined) {
        exNotesMap.set(ex.id, ex.notes);
        if (ex.exerciseLibraryId) exNotesMap.set(ex.exerciseLibraryId, ex.notes);
      }
      if (ex.sectionId && ex.sectionNotes !== undefined) {
        sectionNotesMapLive.set(ex.sectionId, ex.sectionNotes);
      }
    }

    const hasAnyOverride = overrideMap.size > 0 || exNotesMap.size > 0 || sectionNotesMapLive.size > 0;
    if (!hasAnyOverride) return;

    setWorkoutSections(prev => {
      // Step 1: apply overrides to plan exercises already in workoutSections
      const withOverrides = prev.map(section => ({
        ...section,
        comments: sectionNotesMapLive.get(section.id) ?? section.comments,
        exercises: section.exercises.map(ex => {
          const overrides = overrideMap.get(ex.id) ?? overrideMap.get(ex.exerciseId ?? '');
          const liveNotes = exNotesMap.get(ex.id) ?? exNotesMap.get(ex.exerciseId ?? '');
          if (!overrides && liveNotes === undefined) return ex;
          return {
            ...ex,
            parameters: overrides
              ? propagatePlainKeyValues({ ...ex.parameters, ...overrides })
              : ex.parameters,
            notes: liveNotes !== undefined ? liveNotes : ex.notes,
          };
        }),
      }));

      // Step 2: append mobile-added exercises that have no counterpart in the plan
      const existingIds = new Set<string>();
      withOverrides.forEach(s => s.exercises.forEach(ex => {
        existingIds.add(ex.id);
        if (ex.exerciseId) existingIds.add(ex.exerciseId);
      }));

      const mobileOnlyExs = (liveSession.exercises ?? []).filter(ex =>
        ex.mobileAdded &&
        !existingIds.has(ex.id) &&
        !existingIds.has(ex.exerciseLibraryId ?? ' ')
      );

      if (mobileOnlyExs.length === 0) return withOverrides;

      const liveSections = buildSectionsFromLiveExercises(mobileOnlyExs);

      // Merge live sections into plan sections (add to matching section or create new)
      const sectionMap = new Map(withOverrides.map(s => [s.id, s]));
      liveSections.forEach(liveSection => {
        const existing = sectionMap.get(liveSection.id);
        if (existing) {
          sectionMap.set(liveSection.id, {
            ...existing,
            exercises: [...existing.exercises, ...liveSection.exercises],
          });
        } else {
          sectionMap.set(liveSection.id, liveSection);
        }
      });

      return Array.from(sectionMap.values()).sort((a, b) => a.order - b.order);
    });

    // Restore mobile-set column visibility for the appended exercises
    const visOverrides = computeLiveVisibilityOverrides(liveSession.exercises ?? []);
    if (Object.keys(visOverrides).length > 0) {
      setParameterVisibilityOverrides(prev => ({ ...prev, ...visOverrides }));
    }
  }, [isOpen, liveScheduleEntry, sessionIndex]);

  // External parameter update (e.g. from AI set_exercise_params action) — full rebuild
  useEffect(() => {
    if (!forceParamRefresh || !isOpen || exercises.length === 0) return;
    setWorkoutSections(buildSectionsFromExercises(exercises, parameterValues));
  }, [forceParamRefresh]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Force rebuild when dialog opens (separate effect to ensure fresh data)
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure parameterValues are loaded
      const timeoutId = setTimeout(() => {
        if (exercises.length > 0 && !hasInitializedRef.current) {
          const newSections = buildSectionsFromExercises(exercises, parameterValues);
          
          // Same merge logic as above
          const existingExerciseMap = new Map<string, WorkoutExercise>();
          workoutSections.forEach(section => {
            section.exercises.forEach(ex => {
              existingExerciseMap.set(ex.id, ex);
            });
          });
          
          const mergedSections = newSections.map(section => ({
            ...section,
            exercises: section.exercises.map(newEx => {
              const existing = existingExerciseMap.get(newEx.id);
              const isFreshlyAdded = freshlyAddedExerciseIdsRef.current.has(newEx.id);
              
              if (existing) {
                return {
                  ...newEx,
                  parameters: existing.parameters,
                  notes: existing.notes,
                  eachSide: existing.eachSide,
                  parameterSource: (existing as any).parameterSource,
                };
              }

              if (isFreshlyAdded) {
                return newEx;
              }

              return newEx;
            })
          }));

          // Clear freshly added IDs after merge
          freshlyAddedExerciseIdsRef.current.clear();
          
          setWorkoutSections(mergedSections);
          hasInitializedRef.current = true;
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, parameterValues]);
  
  const [supersets, setSupersets] = useState<SupersetMapping>(() => {
    // Initialize from prop if available
    if (supersetsProp && supersetsProp[dayDate]?.[sessionIndex]) {
      return supersetsProp;
    }
    return {};
  });

  // Determine if this is a single session day
  const isSingleSessionDay = useMemo(() => {
    return totalSessionsOnDay === 1;
  }, [totalSessionsOnDay]);

  // Get current intensity for the day.
  // In Athlete Calendar context (useExternalIntensityOnly), prefer the Supabase row
  // intensity (mobile-edited) over the plan-derived daily intensity data.
  const currentIntensity = useMemo(() => {
    if (useExternalIntensityOnly && liveScheduleEntry?.rowIntensity) {
      return liveScheduleEntry.rowIntensity as IntensityLevel;
    }
    if (!dailyIntensityData) return 'moderate' as IntensityLevel;
    const dayIntensity = dailyIntensityData.find(di => di.date === dayDate);
    return dayIntensity?.intensity || 'moderate' as IntensityLevel;
  }, [dailyIntensityData, dayDate, useExternalIntensityOnly, liveScheduleEntry]);

  // Load session metadata, intensity, and supersets from localStorage
  useEffect(() => {
    if (isOpen) {
      // Use session name from trainingDay.sessionNames (synced with Step 1)
      setSessionName(sessionNameFromState || `Session ${sessionIndex + 1}`);
      
      // Load comments: in Athlete Calendar context prefer live Supabase session notes
      // (set by mobile coach app) — same pattern as session intensity above.
      // Fall back to localStorage in the standard Training Wizard context.
      if (useExternalIntensityOnly) {
        const liveNotes = liveScheduleEntry?.sessions[sessionIndex]?.notes;
        setSessionComments(liveNotes != null ? liveNotes : '');
      } else {
        const key = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const { comments } = JSON.parse(stored);
            setSessionComments(comments || '');
          } catch {
            setSessionComments('');
          }
        } else {
          setSessionComments('');
        }
      }

      // Load session intensity - behavior depends on context
      if (useExternalIntensityOnly) {
        // In Athlete Calendar context: prefer session-level intensity from Supabase
        // (set by mobile coach app) over the plan-derived day intensity.
        // Fall back to day intensity when Supabase data hasn't arrived yet.
        const liveSessionIntensity = liveScheduleEntry?.sessions[sessionIndex]?.intensity;
        const resolvedIntensity = (liveSessionIntensity != null && liveSessionIntensity !== '')
          ? liveSessionIntensity
          : (currentIntensity || 'moderate');
        setSessionIntensity(resolvedIntensity as IntensityLevel);
      } else {
        // In Training Wizard context: try localStorage first, then fall back to day intensity
        const intensityKey = `sessionIntensity_${mesocycleId}_${dayDate}_${sessionIndex}`;
        const storedIntensity = localStorage.getItem(intensityKey);
        
        if (storedIntensity) {
          setSessionIntensity(storedIntensity as IntensityLevel);
        } else {
          // Always initialize from day intensity
          setSessionIntensity(currentIntensity || 'moderate');
        }
      }

      // Load supersets - prioritize prop, then localStorage
      if (supersetsProp && supersetsProp[dayDate]?.[sessionIndex]) {
        setSupersets(supersetsProp);
      } else {
        const supersetsKey = `workoutSupersets_${mesocycleId}_${dayDate}_${sessionIndex}`;
        const storedSupersets = localStorage.getItem(supersetsKey);
        if (storedSupersets) {
          try {
            const parsed = JSON.parse(storedSupersets);
            setSupersets({
              ...supersets,
              [dayDate]: {
                ...supersets[dayDate],
                [sessionIndex]: parsed
              }
            });
          } catch (e) {
            console.error('Failed to load supersets:', e);
          }
        }
      }
    }
  }, [isOpen, mesocycleId, dayDate, sessionIndex, currentIntensity, liveScheduleEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local supersets state when supersetsProp changes from Step 1
  useEffect(() => {
    if (supersetsProp) {
      setSupersets(supersetsProp);
    }
  }, [supersetsProp]);

  // NOTE: Removed the sync useEffect that was causing issues
  // Session intensity is now synced on initial load only (in the above useEffect)
  // and persisted immediately via onSessionIntensityChange callback

  // Filter available methods for the current session
  const availableMethods = useMemo(() => {
    const methodsForSession = parameterValues[mesocycleId]?.[microcycleIndex];
    if (!methodsForSession) return [];
    
    return Object.keys(methodsForSession).flatMap(methodKey => {
      const sessionData = methodsForSession[methodKey];
      
      // Check if this method has data for the current session
      if (!sessionData[sessionIndex] || Object.keys(sessionData[sessionIndex]).length === 0) {
        return [];
      }
      
      // Handle both "methodId" and "methodId::categoryName" formats
      const [methodId, categoryName] = methodKey.split('::');
      return [{
        id: methodKey, // Use full key for lookup
        methodId,
        categoryName: categoryName || undefined
      }];
    });
  }, [mesocycleId, microcycleIndex, sessionIndex, parameterValues]);

  // Resolve the plain exerciseId (library id) for a given internal workout exercise id.
  // Needed because supersets may be stored with the plain exerciseId when exercises lack
  // a unique distribution `id`, while internally we use a composite id.
  const resolvePlainExerciseId = (internalId: string): string | undefined => {
    const match = exercises.find(ex => {
      const mapped = (ex as any).id || ex.exerciseId;
      return mapped === internalId;
    });
    if (match && match.exerciseId !== internalId) {
      return match.exerciseId;
    }
    return undefined;
  };

  const getSupersetLabel = (internalId: string): string | undefined => {
    // Primary lookup by internal id
    let label = getSupersetLabelFromMapping(
      supersetsProp || supersets,
      dayDate,
      sessionIndex,
      internalId
    );
    // Fallback: try plain exerciseId for cross-context compatibility.
    // Handles the case where supersets were stored with exerciseId (no distribution id)
    // but the internal workout exercise id has a composite format.
    if (!label) {
      const plainId = resolvePlainExerciseId(internalId);
      if (plainId) {
        label = getSupersetLabelFromMapping(
          supersetsProp || supersets,
          dayDate,
          sessionIndex,
          plainId
        );
      }
    }
    return label ?? undefined;
  };

  const getSupersetPartners = (internalId: string): string[] => {
    // Use supersetsProp (from Step 1) as primary source, fallback to local state
    const sessionSupersets = (supersetsProp || supersets)?.[dayDate]?.[sessionIndex];
    if (!sessionSupersets) return [];

    // Helper: check both internalId and plain exerciseId
    const plainId = resolvePlainExerciseId(internalId);
    const idsToCheck = plainId ? [internalId, plainId] : [internalId];

    // Check all sections (including unsectioned)
    for (const [, sectionSupersets] of Object.entries(sessionSupersets)) {
      for (const [, exerciseIds] of Object.entries(sectionSupersets)) {
        const matchedId = idsToCheck.find(id => exerciseIds.includes(id));
        if (matchedId) {
          return exerciseIds.filter(id => id !== matchedId);
        }
      }
    }
    return [];
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) {
      return;
    }

    if (type === 'SECTION' || type === 'SIDEBAR_SECTION') {
      console.info(`📦 Reordering sections via ${type}`);
      const newSections = Array.from(workoutSections);
      const [removed] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, removed);
      const reorderedSections = newSections.map((s, idx) => ({ ...s, order: idx }));
      setWorkoutSections(reorderedSections);
      
      // Sync to Step 1 - update section orders
      if (sessionSectionsProp && onSectionsChange) {
        const sectionOrderMap = new Map(reorderedSections.map(s => [s.id, s.order]));
        const updatedSections = sessionSectionsProp.map(s => 
          sectionOrderMap.has(s.id) ? { ...s, order: sectionOrderMap.get(s.id)! } : s
        );
        onSectionsChange(updatedSections);
      }
      
      console.info('✓ Sections reordered');
      return;
    }

    if (type === 'EXERCISE') {
      const srcId = source.droppableId.replace('main-exercises-', '');
      const dstId = destination.droppableId.replace('main-exercises-', '');
      const sourceSection = workoutSections.find(s => s.id === srcId);
      const destSection = workoutSections.find(s => s.id === dstId);
      if (!sourceSection || !destSection) {
        console.error('❌ Could not find sections (main):', { srcId, dstId });
        return;
      }

      // Check if dragged exercise is part of a superset
      const draggedExerciseId = result.draggableId;
      const supersetPartners = getSupersetPartners(draggedExerciseId);
      
      if (supersetPartners.length > 0) {
        // SUPERSET GROUP MOVEMENT
        const allMovingIds = [draggedExerciseId, ...supersetPartners];
        
        if (srcId === dstId) {
          // Reorder within same section
          console.info('🔄 Reorder superset group within section:', sourceSection.name);
          const newExercises = Array.from(sourceSection.exercises);
          
          // Remove all superset exercises
          const movingExercises = newExercises.filter(ex => allMovingIds.includes(ex.id));
          const remainingExercises = newExercises.filter(ex => !allMovingIds.includes(ex.id));
          
          // Insert at destination index (keeping superset order)
          remainingExercises.splice(destination.index, 0, ...movingExercises);
          
          setWorkoutSections(workoutSections.map(s =>
            s.id === srcId 
              ? { ...s, exercises: remainingExercises.map((ex, i) => ({ ...ex, order: i })) } 
              : s
          ));
          
          toast({
            title: "Superset moved",
            description: `Moved ${allMovingIds.length} linked exercises together`,
          });
          console.info('✓ Superset reordered within section');
        } else {
          // Move between sections
          console.info('↔️ Move superset group between sections:', sourceSection.name, '→', destSection.name);
          const sourceExercises = Array.from(sourceSection.exercises);
          const destExercises = Array.from(destSection.exercises);
          
          // Remove all superset exercises from source
          const movingExercises = sourceExercises.filter(ex => allMovingIds.includes(ex.id));
          const remainingSource = sourceExercises.filter(ex => !allMovingIds.includes(ex.id));
          
          // Insert into destination
          destExercises.splice(destination.index, 0, ...movingExercises);
          
          setWorkoutSections(workoutSections.map(s => {
            if (s.id === srcId) return { 
              ...s, 
              exercises: remainingSource.map((ex, i) => ({ ...ex, order: i })) 
            };
            if (s.id === dstId) return { 
              ...s, 
              exercises: destExercises.map((ex, i) => ({ ...ex, order: i })) 
            };
            return s;
          }));
          
          toast({
            title: "Superset moved",
            description: `Moved ${allMovingIds.length} linked exercises to ${destSection.name}`,
          });
          console.info('✓ Superset moved between sections');
        }
      } else {
        // SINGLE EXERCISE MOVEMENT
        if (srcId === dstId) {
          console.info('🔄 Reorder exercise within section:', sourceSection.name);
          const newExercises = Array.from(sourceSection.exercises);
          const [removed] = newExercises.splice(source.index, 1);
          newExercises.splice(destination.index, 0, removed);
          setWorkoutSections(workoutSections.map(s =>
            s.id === srcId ? { ...s, exercises: newExercises.map((ex, i) => ({ ...ex, order: i })) } : s
          ));
          console.info('✓ Exercise reordered within section');
        } else {
          console.info('↔️ Move exercise between sections:', sourceSection.name, '→', destSection.name);
          const sourceExercises = Array.from(sourceSection.exercises);
          const destExercises = Array.from(destSection.exercises);
          const [removed] = sourceExercises.splice(source.index, 1);
          destExercises.splice(destination.index, 0, removed);
          setWorkoutSections(workoutSections.map(s => {
            if (s.id === srcId) return { ...s, exercises: sourceExercises.map((ex, i) => ({ ...ex, order: i })) };
            if (s.id === dstId) return { ...s, exercises: destExercises.map((ex, i) => ({ ...ex, order: i })) };
            return s;
          }));
          console.info('✓ Exercise moved between sections');
        }
      }
      return;
    }

    if (type === 'SIDEBAR_EXERCISE') {
      const srcId = source.droppableId.replace('sidebar-exercises-', '');
      const dstId = destination.droppableId.replace('sidebar-exercises-', '');
      const sourceSection = workoutSections.find(s => s.id === srcId);
      const destSection = workoutSections.find(s => s.id === dstId);
      if (!sourceSection || !destSection) {
        console.error('❌ Could not find sections (sidebar):', { srcId, dstId });
        return;
      }

      // Check if dragged exercise is part of a superset
      const draggedExerciseId = result.draggableId.replace('sidebar-ex-', '');
      const supersetPartners = getSupersetPartners(draggedExerciseId);
      
      if (supersetPartners.length > 0) {
        // SUPERSET GROUP MOVEMENT
        const allMovingIds = [draggedExerciseId, ...supersetPartners];
        
        if (srcId === dstId) {
          // Reorder within same section
          console.info('🔄 Reorder superset group within sidebar section:', sourceSection.name);
          const newExercises = Array.from(sourceSection.exercises);
          
          // Remove all superset exercises
          const movingExercises = newExercises.filter(ex => allMovingIds.includes(ex.id));
          const remainingExercises = newExercises.filter(ex => !allMovingIds.includes(ex.id));
          
          // Insert at destination index
          remainingExercises.splice(destination.index, 0, ...movingExercises);
          
          setWorkoutSections(workoutSections.map(s =>
            s.id === srcId 
              ? { ...s, exercises: remainingExercises.map((ex, i) => ({ ...ex, order: i })) } 
              : s
          ));
          
          toast({
            title: "Superset moved",
            description: `Moved ${allMovingIds.length} linked exercises together`,
          });
          console.info('✓ Superset reordered within sidebar section');
        } else {
          // Move between sections
          console.info('↔️ Move superset group between sidebar sections:', sourceSection.name, '→', destSection.name);
          const sourceExercises = Array.from(sourceSection.exercises);
          const destExercises = Array.from(destSection.exercises);
          
          // Remove all superset exercises from source
          const movingExercises = sourceExercises.filter(ex => allMovingIds.includes(ex.id));
          const remainingSource = sourceExercises.filter(ex => !allMovingIds.includes(ex.id));
          
          // Insert into destination
          destExercises.splice(destination.index, 0, ...movingExercises);
          
          setWorkoutSections(workoutSections.map(s => {
            if (s.id === srcId) return { 
              ...s, 
              exercises: remainingSource.map((ex, i) => ({ ...ex, order: i })) 
            };
            if (s.id === dstId) return { 
              ...s, 
              exercises: destExercises.map((ex, i) => ({ ...ex, order: i })) 
            };
            return s;
          }));
          
          toast({
            title: "Superset moved",
            description: `Moved ${allMovingIds.length} linked exercises to ${destSection.name}`,
          });
          console.info('✓ Superset moved between sidebar sections');
        }
      } else {
        // SINGLE EXERCISE MOVEMENT
        if (srcId === dstId) {
          console.info('🔄 Reorder exercise within sidebar section:', sourceSection.name);
          const newExercises = Array.from(sourceSection.exercises);
          const [removed] = newExercises.splice(source.index, 1);
          newExercises.splice(destination.index, 0, removed);
          setWorkoutSections(workoutSections.map(s =>
            s.id === srcId ? { ...s, exercises: newExercises.map((ex, i) => ({ ...ex, order: i })) } : s
          ));
          console.info('✓ Sidebar exercise reordered within section');
        } else {
          console.info('↔️ Move exercise between sidebar sections:', sourceSection.name, '→', destSection.name);
          const sourceExercises = Array.from(sourceSection.exercises);
          const destExercises = Array.from(destSection.exercises);
          const [removed] = sourceExercises.splice(source.index, 1);
          destExercises.splice(destination.index, 0, removed);
          setWorkoutSections(workoutSections.map(s => {
            if (s.id === srcId) return { ...s, exercises: sourceExercises.map((ex, i) => ({ ...ex, order: i })) };
            if (s.id === dstId) return { ...s, exercises: destExercises.map((ex, i) => ({ ...ex, order: i })) };
            return s;
          }));
          console.info('✓ Sidebar exercise moved between sections');
        }
      }
      return;
    }
  };


  const handleParameterChange = (exerciseId: string, paramName: string, value: string | number) => {
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.map(ex =>
          ex.id === exerciseId
            ? { ...ex, parameters: { ...ex.parameters, [paramName]: value } }
            : ex
        )
      }))
    );
  };

  const handleUnitChange = (exerciseId: string, paramName: string, unit: string) => {
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.map(ex =>
          ex.id === exerciseId
            ? { ...ex, parameters: { ...ex.parameters, [`${paramName}_unit`]: unit } }
            : ex
        )
      }))
    );
  };

  const handleSave = () => {
    // Save session comments and parameter visibility (session name is now synced via onRenameSession to trainingDays.sessionNames)
    const metadataKey = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(metadataKey, JSON.stringify({
      comments: sessionComments,
      parameterVisibility: parameterVisibilityOverrides
    }));

    // Save session intensity
    const intensityKey = `sessionIntensity_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(intensityKey, sessionIntensity);

    // Save workout sections structure
    const sectionsKey = `workoutSections_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(sectionsKey, JSON.stringify(workoutSections));

    // If single session day, sync day intensity
    if (isSingleSessionDay && onIntensityChange) {
      onIntensityChange(dayDate, sessionIntensity);
    }

    // Save all parameter changes
    workoutSections.forEach(section => {
      section.exercises.forEach(exercise => {
        onSaveParameters(
          mesocycleId,
          microcycleIndex,
          exercise.methodId,
          sessionIndex,
          exercise.exerciseId,
          exercise.parameters
        );
      });
    });

    // Sync section assignments back to allExerciseDistribution so the athlete-schedule
    // sync can correctly attach sectionId to each exercise in Supabase.
    // workoutSections is the source of truth for which exercise belongs to which section;
    // without this step, exercises keep sectionId: undefined and the athlete app shows
    // every exercise in a single "Workout" fallback bucket.
    if (onDistributionChange && allExerciseDistribution) {
      // Map each exercise id → { sectionId, parameters } from the current workoutSections state.
      // workoutSections is the source of truth for both section membership and per-exercise
      // parameter values (including any edits the coach made inside the session dialog).
      const exInfoMap = new Map<string, { sectionId: string; parameters: Record<string, string | number> }>();
      workoutSections.forEach(section => {
        section.exercises.forEach(ex => {
          if (ex.id) exInfoMap.set(ex.id, { sectionId: section.id, parameters: ex.parameters });
        });
      });

      const updatedDistribution = allExerciseDistribution.map(distEx => {
        if (distEx.dayDate !== dayDate || distEx.sessionIndex !== sessionIndex) return distEx;
        const exId = (distEx as any).id || distEx.exerciseId;
        const info = exInfoMap.get(exId);
        if (!info) return distEx; // not in any section (shouldn't happen)

        let updated = distEx as any;
        // Always sync sectionId
        if (updated.sectionId !== info.sectionId) {
          updated = { ...updated, sectionId: info.sectionId };
        }
        // For toolbox exercises, sync adhocPlannedParams from the current workoutSections
        // parameters so that any edits the coach made inside the dialog are persisted
        // and flow through to the athlete app via athleteScheduleSync.
        if (updated.parameterSource === 'toolbox') {
          updated = { ...updated, adhocPlannedParams: info.parameters };
        }
        return updated;
      });

      onDistributionChange(updatedDistribution);
    }

    // Sync workoutSections → sessionSections so the athlete-schedule section lookup
    // resolves the correct section name and notes for the athlete app.
    // This is needed because:
    //   1. Programs from the wizard often have no sessionSections stored (sections were
    //      only in workoutSections_ localStorage, not in the top-level sessionSections key).
    //   2. handleRenameSection only maps over existing sessionSectionsProp entries, so
    //      renaming a section that isn't in sessionSectionsProp is silently lost.
    // By always syncing on save we ensure editing.sessionSections stays in step with
    // what the coach sees and configured inside the dialog.
    if (onSectionsChange) {
      // Preserve sections for other dates / sessions and replace only this one
      const otherSections = (sessionSectionsProp ?? []).filter(
        s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
      );
      const thisSections: SessionSectionProp[] = workoutSections.map(section => ({
        id: section.id,
        dayDate,
        sessionIndex,
        name: section.name,
        order: section.order,
        comments: section.comments,
      }));
      onSectionsChange([...otherSections, ...thisSections]);
    }

    toast({
      title: "Changes saved",
      description: "Workout session updated successfully",
    });

    onClose();
  };

  const handleAddExercise = (sectionId: string) => {
    setCurrentSectionId(sectionId);
    setIsLibraryOpen(true);
  };

  const handleExercisesSelected = (exercises: ExerciseSelection[]) => {
    // Handle change exercise mode (single-select for replacing an exercise)
    if (changeExerciseTarget && exercises.length > 0) {
      const newExercise = exercises[0];
      handleChangeExercise(changeExerciseTarget, {
        exerciseId: newExercise.exerciseId,
        exerciseName: newExercise.exerciseName,
        libraryId: newExercise.library,
      });
      setIsLibraryOpen(false);
      setChangeExerciseTarget(null);
      return;
    }

    // Normal add exercise mode
    if (!currentSectionId) return;

    // ── Circuit selections: add directly (no method dialog needed) ────────────
    const circuitSelections = exercises.filter(ex => ex.isCircuit);
    const normalSelections = exercises.filter(ex => !ex.isCircuit);

    if (circuitSelections.length > 0) {
      const section = workoutSections.find(s => s.id === currentSectionId);
      if (section) {
        const circuitWorkoutExercises: WorkoutExercise[] = circuitSelections.map((sel, idx) => ({
          id: `${sel.exerciseId}-circuit-${Date.now()}-${idx}`,
          exerciseId: sel.exerciseId,
          exerciseName: sel.exerciseName,
          methodId: 'circuit',
          categoryName: 'Circuit',
          order: section.exercises.length + idx,
          parameters: {},
          isCircuit: true,
          circuitId: sel.circuitId,
          circuitLibraryId: sel.circuitLibraryId,
          circuitExercises: sel.circuitExercises,
          circuitRounds: sel.circuitRounds,
          circuitRestBetweenRounds: sel.circuitRestBetweenRounds,
          circuitRestBetweenExercises: sel.circuitRestBetweenExercises,
          circuitComments: sel.circuitComments,
        }));
        setWorkoutSections(sections =>
          sections.map(s =>
            s.id === currentSectionId
              ? { ...s, exercises: [...s.exercises, ...circuitWorkoutExercises] }
              : s
          )
        );

        // ── Also register circuit entries in allExerciseDistribution so they are
        // persisted when the session is saved (normal exercises get this via
        // onDistributionChange inside handleMethodSelected, but circuits skip that
        // path and were previously lost on close/reopen).
        if (onDistributionChange && allExerciseDistribution) {
          const circuitDistributionEntries: ExerciseDistribution[] = circuitWorkoutExercises.map(cex => ({
            id: cex.id,
            exerciseId: cex.exerciseId,
            exerciseName: cex.exerciseName,
            methodId: cex.methodId,
            categoryName: cex.categoryName,
            dayDate,
            sessionIndex,
            order: cex.order,
            sectionId: currentSectionId,
            isCircuit: true,
            circuitId: (cex as any).circuitId,
            circuitLibraryId: (cex as any).circuitLibraryId,
            circuitExercises: (cex as any).circuitExercises,
            circuitRounds: (cex as any).circuitRounds,
            circuitRestBetweenRounds: (cex as any).circuitRestBetweenRounds,
            circuitRestBetweenExercises: (cex as any).circuitRestBetweenExercises,
            circuitComments: (cex as any).circuitComments,
            parameterSource: 'toolbox' as const,
          }));
          onDistributionChange([...allExerciseDistribution, ...circuitDistributionEntries]);
        }

        toast({ title: `Circuit${circuitSelections.length > 1 ? 's' : ''} added` });
      }
    }

    // Normal exercises proceed to method selection dialog
    if (normalSelections.length > 0) {
      setSelectedExercisesForMethod(normalSelections);
      setIsLibraryOpen(false);
      setIsMethodSelectionOpen(true);
    } else {
      setIsLibraryOpen(false);
    }
  };

  const handleMethodSelected = (methodId: string, categoryName?: string) => {
    if (!currentSectionId) return;
    
    const section = workoutSections.find(s => s.id === currentSectionId);
    if (!section) return;

    // Priority lookup: category-specific first (for split methods), then base method
    const hasValidCategory = categoryName && 
      categoryName !== 'Uncategorized' && 
      categoryName !== '';
    const fullMethodKey = hasValidCategory 
      ? `${methodId}::${categoryName}` 
      : methodId;
    // Merge ALL matching key-format paths so base params survive sparse fullMethodKey entries
    const baseMethodKeyC = methodId.split('::')[0];
    const storedParams: Record<string, string | number> = {
      ...(parameterValues[mesocycleId]?.[microcycleIndex]?.[baseMethodKeyC]?.[0] || {}),
      ...(parameterValues[mesocycleId]?.[microcycleIndex]?.[methodId]?.[0] || {}),
      ...(parameterValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[0] || {}),
      ...(parameterValues[mesocycleId]?.[microcycleIndex]?.[baseMethodKeyC]?.[sessionIndex] || {}),
      ...(parameterValues[mesocycleId]?.[microcycleIndex]?.[methodId]?.[sessionIndex] || {}),
      ...(parameterValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[sessionIndex] || {}),
    };

    // Get parameter definitions
    let methodParams = getParametersForMethod(methodId);
    if (!methodParams || methodParams.length === 0) {
      // Fallback: infer from stored params
      methodParams = Object.keys(storedParams)
        .filter(k => !k.endsWith('_unit'))
        .map((name) => ({
          name,
          type: typeof (storedParams as any)[name] === 'number' ? 'number' : 'text'
        }));
    }

    // Apply parameters to exercises
    const newExercises = selectedExercisesForMethod.map((ex, index) => {
      // Determine set count
      const setParamName = methodParams.find(p => p.isSetParameter)?.name || 
                          methodParams.find(p => /^sets?$/i.test(p.name))?.name;
      const setCount = setParamName ? Number(storedParams[setParamName] || 0) : 0;

      const parameters: Record<string, string | number> = {};
      methodParams.forEach(param => {
        if (param.unit) {
          parameters[`${param.name}_unit`] = param.unit;
        }
        
        if (param.name === setParamName) {
          // Store the set count
          parameters[param.name] = Number(storedParams[param.name] ?? param.defaultValue ?? 0);
        } else if (setCount > 0) {
          // Fan out method-level value to all sets
          for (let i = 1; i <= setCount; i++) {
            const perSetKey = `${param.name}_set${i}`;
            parameters[perSetKey] = storedParams[param.name] ?? param.defaultValue ?? '';
          }
          // Store base parameter too
          parameters[param.name] = storedParams[param.name] ?? param.defaultValue ?? '';
        } else {
          // No sets, use single value
          parameters[param.name] = storedParams[param.name] ?? param.defaultValue ?? '';
        }
      });

      return {
        id: `${ex.exerciseId}-${Date.now()}-${index}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        methodId,
        categoryName: categoryName || section.name,
        order: section.exercises.length + index,
        parameters
      } as WorkoutExercise;
    });

    // Add exercises to section
    setWorkoutSections(sections =>
      sections.map(s => {
        if (s.id === currentSectionId) {
          return {
            ...s,
            exercises: [...s.exercises, ...newExercises]
          };
        }
        return s;
      })
    );

    // Sync to Step 1 - create ExerciseDistribution entries
    if (onDistributionChange && allExerciseDistribution) {
      const newDistributionEntries = selectedExercisesForMethod.map((ex, index) => ({
        id: newExercises[index]?.id || `${ex.exerciseId}-${Date.now()}-${index}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        methodId,
        categoryName: categoryName || '',
        subCategory: ex.subCategory,
        dayDate,
        sessionIndex,
        order: section.exercises.length + index,
        sectionId: currentSectionId,
      }));
      
      onDistributionChange([...allExerciseDistribution, ...newDistributionEntries]);
    }

    // Clean up
    setIsMethodSelectionOpen(false);
    setSelectedExercisesForMethod([]);
    setCurrentSectionId(null);
  };

  // Handler for ad-hoc method selection (from toolbox, not periodization)
  const handleAdHocMethodSelected = (
    methodId: string,
    categoryName: string | undefined,
    parameterVisibility: Record<string, boolean>,
    initialParameters: Record<string, string | number>
  ) => {
    if (!currentSectionId) return;
    
    const section = workoutSections.find(s => s.id === currentSectionId);
    if (!section) return;

    // Get method parameters from toolbox with robust matching
    const methodParts = methodId.split(' - ');
    const toolboxCategory = methodParts[0];
    const toolboxSubCategory = methodParts.length > 1 ? methodParts.slice(1).join(' - ') : '';
    
    // Use case-insensitive matching with trimmed whitespace
    const methodEntries = toolboxData?.entries.filter(entry => {
      const categoryMatch = entry.category.toLowerCase().trim() === toolboxCategory.toLowerCase().trim();
      const subCategoryMatch = toolboxSubCategory === '' 
        ? (!entry.subCategory || entry.subCategory.trim() === '')
        : (entry.subCategory?.toLowerCase().trim() === toolboxSubCategory.toLowerCase().trim());
      return categoryMatch && subCategoryMatch;
    }) || [];

    // Find set parameter from multiple sources
    const setParamEntry = methodEntries.find(e => e.isSetParameter);
    const setParamName = setParamEntry?.parameterName || 
                        methodEntries.find(e => /^sets?$/i.test(e.parameterName))?.parameterName ||
                        Object.keys(initialParameters).find(k => /^sets?$/i.test(k)) ||
                        'Sets';
    const setCount = Number(initialParameters[setParamName] || 3);

    // Build parameters using initialParameters as base with per-set expansion
    const buildExerciseParams = (): Record<string, string | number> => {
      // Start with initialParameters from the dialog
      const params: Record<string, string | number> = { ...initialParameters };
      
      // Ensure set parameter is present
      if (!params[setParamName]) {
        params[setParamName] = setCount;
      }
      
      // Process toolbox entries for units and per-set keys
      methodEntries.forEach(entry => {
        if (entry.isFrequencyParameter) return;
        
        const paramName = entry.parameterName;
        
        // Add unit if quantitative
        if (entry.parameterType === 'quantitative' && entry.options.length > 0) {
          params[`${paramName}_unit`] = entry.options[0];
        }
        
        // Create per-set keys for non-set parameters
        if (!entry.isSetParameter && setCount > 0) {
          for (let i = 1; i <= setCount; i++) {
            if (params[`${paramName}_set${i}`] === undefined) {
              params[`${paramName}_set${i}`] = '';
            }
          }
        }
      });
      
      // FALLBACK: If no toolbox entries found, create structure from initialParameters
      if (methodEntries.length === 0 && Object.keys(initialParameters).length > 0) {
        Object.keys(initialParameters).forEach(paramName => {
          if (/^sets?$/i.test(paramName)) {
            params[paramName] = setCount;
          } else if (setCount > 0) {
            // Fan out to per-set keys
            for (let i = 1; i <= setCount; i++) {
              if (params[`${paramName}_set${i}`] === undefined) {
                params[`${paramName}_set${i}`] = '';
              }
            }
          }
        });
      }
      
      return params;
    };

    // Derive the list of params the athlete should see (visible columns in the set table).
    // Excludes frequency and set-count params; applies any visibility overrides the coach
    // toggled in the Configure Parameters dialog.
    const adhocVisibleParams: string[] = methodEntries
      .filter(e => !e.isFrequencyParameter && !e.isSetParameter)
      .filter(e => {
        const override = parameterVisibility[e.parameterName];
        if (typeof override === 'boolean') return override;
        return e.showInGridByDefault !== false;
      })
      .map(e => e.parameterName);

    // Build the per-set parameter map once (same for every exercise in this batch)
    const sharedParams = buildExerciseParams();

    // Create new exercises with parameterSource marker
    const newExercises = selectedExercisesForMethod.map((ex, index) => {
      return {
        id: `${ex.exerciseId}-${Date.now()}-${index}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        methodId,
        categoryName: categoryName || section.name,
        order: section.exercises.length + index,
        parameters: sharedParams,
        parameterSource: 'toolbox' as const, // Mark as toolbox-sourced
      } as WorkoutExercise;
    });

    // Track freshly added exercise IDs to prevent rebuild from overwriting blank params
    newExercises.forEach(ex => {
      freshlyAddedExerciseIdsRef.current.add(ex.id);
    });

    // Add exercises to section
    setWorkoutSections(sections =>
      sections.map(s => {
        if (s.id === currentSectionId) {
          return {
            ...s,
            exercises: [...s.exercises, ...newExercises]
          };
        }
        return s;
      })
    );

    // Auto-register the section in sessionSections if it isn't there yet.
    // This covers the initial 'section-0' placeholder (and any other section
    // created locally before the user explicitly clicks "Add Section") so that
    // exercises added to it arrive in the athlete-app sync with a proper name
    // instead of the raw section id.
    if (onSectionsChange) {
      const alreadyRegistered = sessionSectionsProp?.some(
        s => s.id === currentSectionId && s.dayDate === dayDate && s.sessionIndex === sessionIndex
      );
      if (!alreadyRegistered) {
        const otherSections = sessionSectionsProp?.filter(
          s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
        ) || [];
        const currentSections = sessionSectionsProp?.filter(
          s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
        ) || [];
        onSectionsChange([
          ...otherSections,
          ...currentSections,
          { id: section.id, dayDate, sessionIndex, name: section.name, order: section.order },
        ]);
      }
    }

    // Sync to Step 1 - create ExerciseDistribution entries with parameterSource: 'toolbox'
    if (onDistributionChange && allExerciseDistribution) {
      const newDistributionEntries = selectedExercisesForMethod.map((ex, index) => ({
        id: newExercises[index]?.id || `${ex.exerciseId}-${Date.now()}-${index}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        methodId,
        categoryName: categoryName || '',
        subCategory: ex.subCategory,
        dayDate,
        sessionIndex,
        order: section.exercises.length + index,
        sectionId: currentSectionId,
        parameterSource: 'toolbox' as const,
        // Carry planned params + visible column list so athlete_schedule
        // sync can populate the set table without a periodization lookup.
        adhocPlannedParams: newExercises[index]?.parameters ?? sharedParams,
        adhocVisibleParams,
      }));
      
      onDistributionChange([...allExerciseDistribution, ...newDistributionEntries]);
    }

    // Store parameter visibility overrides
    if (Object.keys(parameterVisibility).length > 0) {
      const metadataKey = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
      try {
        const existing = localStorage.getItem(metadataKey);
        const parsed = existing ? JSON.parse(existing) : {};
        
        // Merge visibility overrides as a flat map (paramName → bool),
        // not nested under exercise IDs.  The state and reader both expect
        // Record<string, boolean> at the top level.
        parsed.parameterVisibility = {
          ...(parsed.parameterVisibility || {}),
          ...parameterVisibility,
        };

        localStorage.setItem(metadataKey, JSON.stringify(parsed));
        setParameterVisibilityOverrides(prev => ({ ...prev, ...parameterVisibility }));
      } catch (e) {
        console.error('Failed to save parameter visibility:', e);
      }
    }

    // Clean up
    setIsMethodSelectionOpen(false);
    setSelectedExercisesForMethod([]);
    setCurrentSectionId(null);
    
    toast({
      title: "Exercise(s) Added",
      description: `Added ${newExercises.length} exercise(s) with ${methodId}`,
    });
  };

  const handleExerciseCreated = (exercise: ExerciseSelection) => {
    // When a new exercise is created, automatically add it
    handleExercisesSelected([exercise]);
  };

  const handleDuplicateExercise = (exerciseId: string) => {
    let duplicatedExercise: any = null;
    
    setWorkoutSections(sections =>
      sections.map(section => {
        const exIndex = section.exercises.findIndex(ex => ex.id === exerciseId);
        if (exIndex === -1) return section;
        
        const original = section.exercises[exIndex];
        const duplicate = {
          ...original,
          id: `${original.id}-copy-${Date.now()}`,
          order: exIndex + 1
        };
        duplicatedExercise = duplicate;
        
        const newExercises = [...section.exercises];
        newExercises.splice(exIndex + 1, 0, duplicate);
        
        return {
          ...section,
          exercises: newExercises.map((ex, idx) => ({ ...ex, order: idx }))
        };
      })
    );
    
    // Sync to Step 1 - add duplicated exercise
    if (onDistributionChange && allExerciseDistribution && duplicatedExercise) {
      const newDistributionEntry = {
        id: duplicatedExercise.id,
        exerciseId: duplicatedExercise.exerciseId,
        exerciseName: duplicatedExercise.exerciseName,
        methodId: duplicatedExercise.methodId,
        categoryName: duplicatedExercise.categoryName || '',
        subCategory: duplicatedExercise.subCategory,
        dayDate,
        sessionIndex,
        order: duplicatedExercise.order,
        sectionId: duplicatedExercise.sectionId,
      };
      onDistributionChange([...allExerciseDistribution, newDistributionEntry]);
    }
  };

  const handleDeleteExercise = (exerciseId: string) => {
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.filter(ex => ex.id !== exerciseId).map((ex, idx) => ({ ...ex, order: idx }))
      }))
    );
    
    // Clean up supersets - remove deleted exercise from all superset groups
    const cleanedSupersets = cleanupSupersetsOnExerciseDelete(supersets, exerciseId);
    setSupersets(cleanedSupersets);
    onSupersetsChange?.(cleanedSupersets);
    
    // Sync to Step 1 - remove exercise from distribution
    if (onDistributionChange && allExerciseDistribution) {
      const updatedDistribution = allExerciseDistribution.filter(ex => ex.id !== exerciseId);
      onDistributionChange(updatedDistribution);
    }
  };

  // Handler for changing an exercise to a different one from the library
  const handleChangeExercise = (
    exerciseId: string, 
    newExercise: { 
      exerciseId: string; 
      exerciseName: string; 
      libraryId: string;
      videoUrl?: string;
      description?: string;
    }
  ) => {
    // Update the exercise in workoutSections, preserving all metadata
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.map(ex => 
          ex.id === exerciseId 
            ? { 
                ...ex, 
                exerciseId: newExercise.exerciseId,
                exerciseName: newExercise.exerciseName,
                libraryId: newExercise.libraryId,
                videoUrl: newExercise.videoUrl,
                libraryDescription: newExercise.description,
                // Keep: methodId, categoryName, parameters, notes, eachSide, supersetId, order, etc.
              } 
            : ex
        )
      }))
    );
    
    // Sync to Step 1's exerciseDistribution
    if (onDistributionChange && allExerciseDistribution) {
      const updatedDistribution = allExerciseDistribution.map(ex =>
        ex.id === exerciseId 
          ? { 
              ...ex, 
              exerciseId: newExercise.exerciseId, 
              exerciseName: newExercise.exerciseName,
            } 
          : ex
      );
      onDistributionChange(updatedDistribution);
    }
    
    toast({
      title: "Exercise Changed",
      description: `Changed to ${newExercise.exerciseName}`,
    });
  };

  // Handler to open the full library popup for changing an exercise
  const handleOpenChangeLibrary = async (exerciseId: string) => {
    if (!user) { setChangeExerciseTarget(exerciseId); setIsLibraryOpen(true); return; }

    // Find the WorkoutExercise to get the library exercise ID
    let targetEx: WorkoutExercise | undefined;
    for (const sec of workoutSections) {
      targetEx = sec.exercises.find(e => e.id === exerciseId);
      if (targetEx) break;
    }
    if (!targetEx?.exerciseId) { setChangeExerciseTarget(exerciseId); setIsLibraryOpen(true); return; }

    setChainPickerLoading(true);
    setChainPickerTarget({ exId: exerciseId, exerciseId: targetEx.exerciseId, exerciseName: targetEx.exerciseName });
    setChainPickerEntries([]);

    const { data } = await supabase
      .from('exercise_progressions')
      .select('id, to_exercise_id, to_exercise_name, direction, level, notes')
      .eq('from_exercise_id', targetEx.exerciseId)
      .eq('coach_user_id', user.id)
      .order('direction').order('level');

    // Build a name map from the already-loaded libraries context
    const nameMap = new Map<string, string>();
    for (const lib of libraries) {
      const nameColId = lib.columns?.[0]?.id ?? 'exercise';
      for (const ex of lib.exercises ?? []) {
        const n = (ex.data?.[nameColId] ?? ex.data?.['name'] ?? '') as string;
        if (n) nameMap.set(ex.id, n);
      }
    }

    const entries: ChainPickerEntry[] = (data ?? []).map((r: Record<string, unknown>) => {
      const toExId = r.to_exercise_id as string;
      const storedName = (r.to_exercise_name as string) || '';
      const resolvedName = storedName || nameMap.get(toExId) || '';
      // Back-fill in DB if name was missing
      if (!storedName && resolvedName && user) {
        supabase.from('exercise_progressions').update({ to_exercise_name: resolvedName }).eq('id', r.id as string);
      }
      return {
        id: r.id as string,
        toExerciseId: toExId,
        toExerciseName: resolvedName,
        direction: r.direction as 'progression' | 'regression',
        level: r.level as number,
        notes: r.notes as string | null,
      };
    });

    setChainPickerEntries(entries);
    setChainPickerLoading(false);
  };

  const handleExerciseNotesChange = (exerciseId: string, notes: string) => {
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.map(ex => 
          ex.id === exerciseId ? { ...ex, notes } : ex
        )
      }))
    );
    
    // Sync to parent's exerciseDistribution
    if (onDistributionChange && allExerciseDistribution) {
      const updatedDistribution = allExerciseDistribution.map(ex =>
        ex.id === exerciseId ? { ...ex, notes } : ex
      );
      onDistributionChange(updatedDistribution);
    }
  };

  const handleExerciseEachSideChange = (exerciseId: string, eachSide: boolean) => {
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.map(ex => 
          ex.id === exerciseId ? { ...ex, eachSide } : ex
        )
      }))
    );
    
    // Sync to parent's exerciseDistribution
    if (onDistributionChange && allExerciseDistribution) {
      const updatedDistribution = allExerciseDistribution.map(ex =>
        ex.id === exerciseId ? { ...ex, eachSide } : ex
      );
      onDistributionChange(updatedDistribution);
    }
  };

  const handleToggleSuperset = (exerciseId1: string, exerciseId2: string, sectionId?: string) => {
    // Use shared utility for consistent behavior with Master Planner
    const result = toggleSuperset(
      supersetsProp || supersets,
      dayDate,
      sessionIndex,
      exerciseId1,
      exerciseId2,
      sectionId
    );
    
    setSupersets(result.newSupersets);
    
    // Persist to localStorage
    const key = `workoutSupersets_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(key, JSON.stringify(result.newSupersets[dayDate][sessionIndex]));
    
    // Propagate to Step 1
    onSupersetsChange?.(result.newSupersets);
    
    toast({ 
      title: result.action === 'unlinked' ? 'Exercises unlinked' : 'Exercises linked', 
      description: result.message 
    });
  };

  // Exercise detail dialog handlers
  const handleOpenExerciseDetail = (exercise: WorkoutExercise) => {
    if (exercise.isCircuit) {
      setCircuitDetailExercise(exercise);
    } else {
      setDetailExercise(exercise);
    }
  };

  const handleOpenCircuitExerciseDetail = (exerciseId: string, libraryId: string, exerciseName: string) => {
    setCircuitSubDetail({ exerciseId, libraryId, exerciseName });
  };

  /** Called when the user saves edits in the CircuitBuilderDialog (edit mode for session circuits) */
  const handleCircuitEdited = (updatedCircuit: Circuit, savedToLibraryId?: string) => {
    if (!circuitDetailExercise) return;
    const targetId = circuitDetailExercise.id;

    // Update workoutSections for immediate UI refresh
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.map(ex =>
          ex.id === targetId
            ? {
                ...ex,
                exerciseName: updatedCircuit.name,
                circuitRounds: updatedCircuit.rounds,
                circuitRestBetweenRounds: updatedCircuit.restBetweenRounds,
                circuitRestBetweenExercises: updatedCircuit.restBetweenExercises,
                circuitComments: updatedCircuit.comments,
                circuitExercises: updatedCircuit.exercises,
                ...(savedToLibraryId ? { circuitLibraryId: savedToLibraryId, circuitId: updatedCircuit.id } : {}),
              }
            : ex
        ),
      }))
    );

    // Sync back to exercise distribution (Step 1 / parent state)
    if (onDistributionChange && allExerciseDistribution) {
      const updatedDistribution = allExerciseDistribution.map(ex =>
        ex.id === targetId
          ? {
              ...ex,
              exerciseName: updatedCircuit.name,
              circuitRounds: updatedCircuit.rounds,
              circuitRestBetweenRounds: updatedCircuit.restBetweenRounds,
              circuitRestBetweenExercises: updatedCircuit.restBetweenExercises,
              circuitComments: updatedCircuit.comments,
              circuitExercises: updatedCircuit.exercises,
              ...(savedToLibraryId ? { circuitLibraryId: savedToLibraryId, circuitId: updatedCircuit.id } : {}),
            }
          : ex
      );
      onDistributionChange(updatedDistribution);
    }

    setCircuitDetailExercise(null);
  };

  const handleSaveExerciseToLibrary = (updatedData: {
    name: string;
    videoUrl: string;
    description: string;
    data: Record<string, any>;
  }) => {
    if (!detailExercise) return;
    
    // Find which library contains this exercise
    for (const lib of libraries) {
      const exercise = lib.exercises.find(e => e.id === detailExercise.exerciseId);
      if (exercise) {
        // Find the name column (usually the first column)
        const nameColumn = lib.columns.find(c => c.name.toLowerCase() === 'name' || c.name.toLowerCase() === 'exercise name') || lib.columns[0];
        
        updateExerciseInLibrary(lib.id, detailExercise.exerciseId, {
          videoUrl: updatedData.videoUrl || undefined,
          description: updatedData.description || undefined,
          data: {
            ...updatedData.data,
            ...(nameColumn ? { [nameColumn.id]: updatedData.name } : {})
          }
        });
        toast({
          title: "Exercise updated",
          description: `${updatedData.name} has been updated in the library`,
        });
        break;
      }
    }
    // Dialog handles its own close/view-mode transition
  };

  const handleScrollToExercise = (exerciseId: string) => {
    const element = document.getElementById(`exercise-${exerciseId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Stable callbacks for visibility overrides (used in context value)
  const handleVisibilityChange = React.useCallback((paramName: string, visible: boolean) => {
    setParameterVisibilityOverrides(prev => ({
      ...prev,
      [paramName]: visible
    }));
  }, []);

  const handleShowAllParams = React.useCallback(() => {
    const allParamNames = new Set<string>();
    workoutSections.forEach(s => {
      s.exercises.forEach(ex => {
        Object.keys(ex.parameters || {}).forEach(key => {
          if (!key.endsWith('_unit') && !/_set\d+$/i.test(key)) {
            allParamNames.add(key);
          }
        });
      });
    });
    const allVisible: ParameterVisibilityOverrides = {};
    allParamNames.forEach(name => { allVisible[name] = true; });
    setParameterVisibilityOverrides(allVisible);
  }, [workoutSections]);

  const handleResetParamsToDefaults = React.useCallback(() => {
    setParameterVisibilityOverrides({});
  }, []);

  const handleAddSection = () => {
    // Strip the initial 'section-0' placeholder if it is still empty so it
    // doesn't ghost alongside the user's explicitly-named sections.
    const baseSections = workoutSections.filter(
      s => !(s.id === 'section-0' && s.exercises.length === 0)
    );

    const newSectionNumber = baseSections.length + 1;
    const newSection: WorkoutSection = {
      id: `section-${Date.now()}`,
      name: `Section ${newSectionNumber}`,
      order: baseSections.length,
      exercises: [],
    };

    setWorkoutSections([...baseSections, newSection]);

    // Sync to Step 1 — also drop the placeholder from the persisted section list
    if (onSectionsChange) {
      const step1Section: SessionSectionProp = {
        id: newSection.id,
        dayDate,
        sessionIndex,
        name: newSection.name,
        order: newSection.order,
      };
      const otherSections = sessionSectionsProp?.filter(
        s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
      ) || [];
      // Exclude the placeholder ('section-0') from the persisted list
      const currentSections = sessionSectionsProp?.filter(
        s => s.dayDate === dayDate && s.sessionIndex === sessionIndex && s.id !== 'section-0'
      ) || [];
      onSectionsChange([...otherSections, ...currentSections, step1Section]);
    }

    toast({
      title: "Section added",
      description: "New section created successfully",
    });
  };

  const handleRenameSection = (sectionId: string, newName: string) => {
    setWorkoutSections(sections =>
      sections.map(s => s.id === sectionId ? { ...s, name: newName } : s)
    );
    
    // Sync to Step 1
    if (sessionSectionsProp && onSectionsChange) {
      const updatedSections = sessionSectionsProp.map(s =>
        s.id === sectionId ? { ...s, name: newName } : s
      );
      onSectionsChange(updatedSections);
    }
  };

  const handleSectionCommentsChange = (sectionId: string, comments: string) => {
    // Update local workoutSections state
    setWorkoutSections(sections =>
      sections.map(s => s.id === sectionId ? { ...s, comments } : s)
    );
    
    // Propagate to Step 1 via onSectionsChange
    if (sessionSectionsProp && onSectionsChange) {
      const updatedSections = sessionSectionsProp.map(s =>
        s.id === sectionId ? { ...s, comments } : s
      );
      onSectionsChange(updatedSections);
    }
  };

  const handleDeleteSection = (sectionId: string) => {
    const section = workoutSections.find(s => s.id === sectionId);
    if (!section) return;
    
    // If section has exercises, show confirmation
    if (section.exercises.length > 0) {
      setSectionToDelete(sectionId);
    } else {
      // Delete empty section immediately
      confirmDeleteSection(sectionId);
    }
  };

  const confirmDeleteSection = (sectionId: string) => {
    setWorkoutSections(prev =>
      prev
        .filter(s => s.id !== sectionId)
        .map((s, idx) => ({ ...s, order: idx }))
    );
    
    // Sync to Step 1 - remove section and update orders
    if (sessionSectionsProp && onSectionsChange) {
      const updatedSections = sessionSectionsProp
        .filter(s => s.id !== sectionId)
        .map((s, idx) => ({ ...s, order: idx }));
      onSectionsChange(updatedSections);
    }
    
    setSectionToDelete(null);
    
    toast({
      title: "Section deleted",
      description: "Section removed successfully",
    });
  };

  const handleDuplicateSection = (sectionId: string) => {
    const section = workoutSections.find(s => s.id === sectionId);
    if (!section) return;
    
    // Generate new IDs for duplicated exercises
    const timestamp = Date.now();
    const duplicatedExercises: WorkoutExercise[] = section.exercises.map((ex, idx) => ({
      ...ex,
      id: `${ex.id}-section-copy-${timestamp}-${idx}`,
      order: idx
    }));
    
    // Create mapping of old exercise IDs to new exercise IDs
    const exerciseIdMap = new Map<string, string>();
    section.exercises.forEach((ex, idx) => {
      exerciseIdMap.set(ex.id, duplicatedExercises[idx].id);
    });
    
    // Duplicate superset relationships
    const sessionSupersets = supersets[dayDate]?.[sessionIndex] || {};
    const updatedSessionSupersets = { ...sessionSupersets };
    
    // For each section in the session
    Object.entries(sessionSupersets).forEach(([sectionId, sectionSupersets]) => {
      if (!updatedSessionSupersets[sectionId]) {
        updatedSessionSupersets[sectionId] = {};
      }
      
      // For each superset that contains exercises from this section
      Object.entries(sectionSupersets).forEach(([supersetId, exerciseIds]) => {
        const sectionExerciseIds = exerciseIds.filter(id => 
          section.exercises.some(ex => ex.id === id)
        );
        
        // If all exercises in the superset are from this section, duplicate the superset
        if (sectionExerciseIds.length === exerciseIds.length) {
          // Create new superset with duplicated exercise IDs
          const existingSupersetIds = Object.keys(updatedSessionSupersets[sectionId]).map(id => {
            const match = id.match(/superset-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
          const nextId = existingSupersetIds.length > 0 ? Math.max(...existingSupersetIds) + 1 : 1;
          const newSupersetId = `superset-${nextId}`;
          
          const newExerciseIds = exerciseIds.map(id => exerciseIdMap.get(id) || id);
          updatedSessionSupersets[sectionId][newSupersetId] = newExerciseIds;
        }
      });
    });
    
    // Update supersets state
    setSupersets({
      ...supersets,
      [dayDate]: {
        ...supersets[dayDate],
        [sessionIndex]: updatedSessionSupersets
      }
    });
    
    // Persist supersets to localStorage
    const supersetsKey = `workoutSupersets_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(supersetsKey, JSON.stringify(updatedSessionSupersets));
    
    // Create duplicated section
    const sectionIndex = workoutSections.findIndex(s => s.id === sectionId);
    const duplicatedSection: WorkoutSection = {
      id: `section-${timestamp}`,
      name: `${section.name} (Copy)`,
      order: sectionIndex + 1,
      exercises: duplicatedExercises
    };
    
    // Insert duplicated section right after the original
    const newSections = [...workoutSections];
    newSections.splice(sectionIndex + 1, 0, duplicatedSection);
    
    // Reorder all sections
    const reorderedSections = newSections.map((s, idx) => ({ ...s, order: idx }));
    setWorkoutSections(reorderedSections);
    
    // Sync to Step 1 - add duplicated section
    if (onSectionsChange) {
      const step1Section: SessionSectionProp = {
        id: duplicatedSection.id,
        dayDate,
        sessionIndex,
        name: duplicatedSection.name,
        order: duplicatedSection.order,
      };
      const otherSections = sessionSectionsProp?.filter(
        s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
      ) || [];
      const currentSections = sessionSectionsProp?.filter(
        s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
      ) || [];
      // Reorder existing sections and add duplicated section
      const reorderedStep1Sections = currentSections.map(s => {
        const localSection = reorderedSections.find(ls => ls.id === s.id);
        return localSection ? { ...s, order: localSection.order } : s;
      });
      onSectionsChange([...otherSections, ...reorderedStep1Sections, step1Section]);
    }
    
    toast({
      title: "Section duplicated",
      description: `"${section.name}" copied with ${section.exercises.length} exercise(s)`,
    });
  };

  // ── Athlete context for auto-calculated parameters ──────────────────────────
  const { biometricDefinitions, athleteBiometrics } = useAthletes();
  // useExerciseMetrics already computes e1RM correctly using the param tags the coach
  // configured in the Exercise Metrics tab (weight param, reps param, optional RIR param).
  const { getExerciseHistory } = useExerciseMetrics(athleteConnectionId ?? null);

  const resolveAthleteDataRefs = useCallback(
    (refs: string[], exerciseName: string): Record<string, number | undefined> => {
      const result: Record<string, number | undefined> = {};
      if (!selectedAthleteId) return result;

      for (const ref of refs) {
        if (ref === 'e1RM') {
          // Primary: compute e1RM from exercise session logs (most accurate)
          const history = getExerciseHistory(exerciseName);
          const recent = [...history].reverse().find(s => s.e1rm !== null);
          if (recent?.e1rm != null) {
            result['e1RM'] = recent.e1rm;
            continue;
          }
          // Fallback: use manually-entered performance parameter named 'e1RM'
          // This covers the common case where the coach has entered an e1RM value
          // in the athlete's performance parameters but has not yet configured
          // exercise_param_tags for Epley-computed e1RM from session logs.
          const e1rmParam = parametersData?.parameters.find(
            p => p.name.toLowerCase() === 'e1rm'
          );
          if (e1rmParam) {
            const perfEntry = (athletePerformanceParameters ?? []).find(
              pp => pp.athleteId === selectedAthleteId && pp.athleticismParameterId === e1rmParam.id
            );
            if (perfEntry && perfEntry.values.length > 0) {
              const latest = [...perfEntry.values].sort(
                (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
              )[0];
              const num = parseFloat(latest.value);
              if (!isNaN(num)) {
                result['e1RM'] = num;
                continue;
              }
            }
          }
          result['e1RM'] = undefined;
          continue;
        }

        // Biometric definition ID → look up athlete's latest value by exact ID
        const bioDef = biometricDefinitions.find(d => d.id === ref && d.type === 'quantitative');
        if (bioDef) {
          const bioEntry = athleteBiometrics.find(
            ab => ab.athleteId === selectedAthleteId && ab.biometricDefinitionId === ref
          );
          if (bioEntry && bioEntry.values.length > 0) {
            const latest = [...bioEntry.values].sort(
              (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
            )[0];
            const num = parseFloat(latest.value);
            if (!isNaN(num)) result[bioDef.name] = num;
          }
          continue;
        }

        // Performance parameter ID → look up athlete's latest value by exact ID
        const perfDef = parametersData?.parameters.find(p => p.id === ref);
        if (perfDef) {
          const perfEntry = (athletePerformanceParameters ?? []).find(
            p => p.athleteId === selectedAthleteId && p.athleticismParameterId === ref
          );
          if (perfEntry && perfEntry.values.length > 0) {
            const latest = [...perfEntry.values].sort(
              (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
            )[0];
            const num = parseFloat(latest.value);
            if (!isNaN(num)) result[perfDef.name] = num;
          }
        }
      }

      return result;
    },
    [selectedAthleteId, biometricDefinitions, athleteBiometrics, athletePerformanceParameters, parametersData, getExerciseHistory],
  );

  // Build context value for WorkoutSessionProvider (avoids deep prop drilling to WorkoutSectionCard)
  const sessionContextValue: WorkoutSessionContextValue = useMemo(() => ({
    onParameterChange: handleParameterChange,
    onUnitChange: handleUnitChange,
    onToggleSuperset: handleToggleSuperset,
    onDuplicateExercise: handleDuplicateExercise,
    onDeleteExercise: handleDeleteExercise,
    getSupersetLabel,
    onExerciseNotesChange: handleExerciseNotesChange,
    onExerciseEachSideChange: handleExerciseEachSideChange,
    onSectionCommentsChange: handleSectionCommentsChange,
    toolboxData: toolboxData,
    visibilityOverrides: parameterVisibilityOverrides,
    onVisibilityChange: handleVisibilityChange,
    onShowAllParams: handleShowAllParams,
    onResetParamsToDefaults: handleResetParamsToDefaults,
    onOpenExerciseDetail: handleOpenExerciseDetail,
    onOpenCircuitExerciseDetail: handleOpenCircuitExerciseDetail,
    onChangeExercise: handleChangeExercise,
    onOpenChangeLibrary: handleOpenChangeLibrary,
    onOpenHistory: athleteConnectionId ? (exerciseName: string) => setHistoryTarget(exerciseName) : undefined,
    resolveAthleteDataRefs,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    handleParameterChange,
    handleUnitChange,
    handleToggleSuperset,
    handleDuplicateExercise,
    handleDeleteExercise,
    getSupersetLabel,
    handleExerciseNotesChange,
    handleExerciseEachSideChange,
    handleSectionCommentsChange,
    toolboxData,
    parameterVisibilityOverrides,
    handleVisibilityChange,
    handleShowAllParams,
    handleResetParamsToDefaults,
    handleOpenExerciseDetail,
    handleOpenCircuitExerciseDetail,
    handleChangeExercise,
    handleOpenChangeLibrary,
    athleteConnectionId,
    resolveAthleteDataRefs,
  ]);

  // Scroll lock — replaces the behavior normally provided by modal={true}
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <WorkoutSessionProvider value={sessionContextValue}>
      {/* Manual backdrop — modal={false} doesn't render one */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[49] bg-black/80"
          onClick={onClose}
        />
      )}
    <Dialog open={isOpen} onOpenChange={onClose} modal={false}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-4">
              {/* Editable Session Name */}
              {isEditingName ? (
                <Input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  onBlur={() => {
                    // Save session name via onRenameSession callback
                    if (onRenameSession && sessionName.trim()) {
                      onRenameSession(dayDate, sessionIndex, sessionName.trim());
                    }
                    setIsEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Save session name via onRenameSession callback
                      if (onRenameSession && sessionName.trim()) {
                        onRenameSession(dayDate, sessionIndex, sessionName.trim());
                      }
                      setIsEditingName(false);
                    }
                    if (e.key === 'Escape') {
                      // Revert to original name from state
                      setSessionName(sessionNameFromState || `Session ${sessionIndex + 1}`);
                      setIsEditingName(false);
                    }
                  }}
                  autoFocus
                  className="text-lg font-semibold h-8"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <DialogTitle 
                    className="cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => setIsEditingName(true)}
                  >
                    {sessionName || `Session ${sessionIndex + 1}`}
                  </DialogTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <DialogDescription className="mt-1">
                {dayDate && /^\d{4}-\d{2}-\d{2}$/.test(dayDate)
                  ? format(parseISO(dayDate), 'EEEE, MMMM d, yyyy')
                  : dayDate
                    ? 'Library Session'
                    : 'New Session'}
              </DialogDescription>
              
              {/* Editable Day Intensity */}
              {onIntensityChange && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">Day intensity:</span>
                  <Popover open={dayIntensityPopoverOpen} onOpenChange={setDayIntensityPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex items-center gap-2 h-7 px-2 hover:bg-accent">
                        <div
                          className="w-5 h-5 rounded-sm border shrink-0"
                          style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(currentIntensity)) }}
                        />
                        <span className="text-xs font-medium">
                          {getBorgLabelFull(migrateLegacyIntensity(currentIntensity))}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-2 z-[120] bg-popover" align="start" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <p className="text-xs font-medium mb-2 text-muted-foreground">Change Day Intensity</p>
                        {BORG_LEVELS.map((level) => (
                          <button
                            key={level}
                            onClick={(e) => {
                              e.stopPropagation();
                              onIntensityChange(dayDate, level as IntensityLevel);
                              if (isSingleSessionDay) {
                                setSessionIntensity(level as IntensityLevel);
                                if (onSessionIntensityChange) {
                                  onSessionIntensityChange(dayDate, sessionIndex, level as IntensityLevel);
                                }
                              }
                              setDayIntensityPopoverOpen(false);
                            }}
                            className={cn("w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left", level === migrateLegacyIntensity(currentIntensity) && "bg-accent")}
                          >
                            <div className="w-4 h-4 rounded-sm border shrink-0" style={{ backgroundColor: getBorgBg(level) }} />
                            <span className="text-xs">{getBorgLabelFull(level)}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Editable Session Intensity */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">Session intensity:</span>
                <Popover open={sessionIntensityPopoverOpen} onOpenChange={setSessionIntensityPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2 h-7 px-2 hover:bg-accent">
                      <div
                        className="w-5 h-5 rounded-sm border shrink-0"
                        style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(sessionIntensity)) }}
                      />
                      <span className="text-xs font-medium">
                        {getBorgLabelFull(migrateLegacyIntensity(sessionIntensity))}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2 z-[120] bg-popover" align="start" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-1">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">
                        Change Session Intensity
                        {isSingleSessionDay && (
                          <span className="block text-[10px] text-muted-foreground/70 mt-0.5">(Linked to day intensity)</span>
                        )}
                      </p>
                      {BORG_LEVELS.map((level) => (
                        <button
                          key={level}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionIntensity(level as IntensityLevel);
                            if (onSessionIntensityChange) {
                              onSessionIntensityChange(dayDate, sessionIndex, level as IntensityLevel);
                            }
                            if (isSingleSessionDay && onIntensityChange) {
                              onIntensityChange(dayDate, level as IntensityLevel);
                            }
                            setSessionIntensityPopoverOpen(false);
                          }}
                          className={cn("w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left", level === migrateLegacyIntensity(sessionIntensity) && "bg-accent")}
                        >
                          <div className="w-4 h-4 rounded-sm border shrink-0" style={{ backgroundColor: getBorgBg(level) }} />
                          <span className="text-xs">{getBorgLabelFull(level)}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-10">
              <Button variant="outline" size="sm" onClick={() => window.print()} title="Print session">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              {!isLibrarySession && (
                <Button
                  onClick={() => setSaveLibOpen(true)}
                  className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Save to Library
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex overflow-hidden">
          {/* Main scrollable content area */}
          <ScrollArea className={`flex-1 ${sidebarOpen ? '' : 'w-full'}`}>
            {/* Session Comments Section */}
            <div className="px-6 pt-4 pb-2 border-b bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="session-comments" className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Session Notes
                </Label>
                <Textarea
                  id="session-comments"
                  placeholder="Add notes, goals, or observations for this session..."
                  value={sessionComments}
                  onChange={(e) => setSessionComments(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
            </div>

            {/* Tests & Events Section */}
            <Collapsible open={testsEventsExpanded} onOpenChange={setTestsEventsExpanded}>
              <div className="px-6 py-3 bg-muted/30 border-b">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-80">
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        testsEventsExpanded && "rotate-180"
                      )} />
                      <span className="font-semibold text-sm">
                        Tests & Events for This Day
                      </span>
                      {((trainingDay?.testNames?.length || 0) + (trainingDay?.eventNames?.length || 0)) > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {(trainingDay?.testNames?.length || 0) + (trainingDay?.eventNames?.length || 0)}
                        </Badge>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTestEventDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
              
              <CollapsibleContent>
                <div className="px-6 py-4 bg-muted/30 border-b">
                  {((trainingDay?.testNames?.length || 0) + (trainingDay?.eventNames?.length || 0)) === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No tests or events scheduled for this day
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-3">
                        Tests and events apply to the entire training day
                      </p>
                      
                      {/* Tests */}
                      {trainingDay?.testNames?.map((testName, idx) => {
                        // Find the full test data from availableTests
                        const testData = availableTests?.find(test => test.testMethod === testName);
                        
                        return (
                          <div
                            key={`test-${idx}`}
                            className="p-3 rounded-md border bg-background space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
                                <span className="text-sm font-medium">{testName}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => onDeleteTestEvent?.(dayDate, 'test', testName)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {/* Comments section */}
                            {testData && (
                              <div className="space-y-1">
                                <Label htmlFor={`test-comment-${idx}`} className="text-xs text-muted-foreground">
                                  Comments:
                                </Label>
                                <Textarea
                                  id={`test-comment-${idx}`}
                                  value={testData.comments || ""}
                                  onChange={(e) => {
                                    if (testData.id && onUpdateTestComment) {
                                      onUpdateTestComment(testData.id, e.target.value);
                                    }
                                  }}
                                  placeholder="Add notes about this test..."
                                  rows={2}
                                  className="text-xs"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Events */}
                      {trainingDay?.eventNames?.map((eventName, idx) => {
                        // Find the full event data from availableEvents
                        const eventData = availableEvents?.find(event => event.name === eventName);
                        
                        return (
                          <div
                            key={`event-${idx}`}
                            className="p-3 rounded-md border bg-background space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="text-sm font-medium">{eventName}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => onDeleteTestEvent?.(dayDate, 'event', eventName)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {/* Comments section */}
                            {eventData && (
                              <div className="space-y-1">
                                <Label htmlFor={`event-comment-${idx}`} className="text-xs text-muted-foreground">
                                  Comments:
                                </Label>
                                <Textarea
                                  id={`event-comment-${idx}`}
                                  value={eventData.comments || ""}
                                  onChange={(e) => {
                                    if (eventData.id && onUpdateEventComment) {
                                      onUpdateEventComment(eventData.id, e.target.value);
                                    }
                                  }}
                                  placeholder="Add notes about this event..."
                                  rows={2}
                                  className="text-xs"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Exercises Content */}
              <div className="p-6 space-y-4">
                <Droppable droppableId="sections" type="SECTION">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                      {workoutSections.map((section, index) => (
                        <Draggable key={section.id} draggableId={section.id} index={index}>
                          {(provided, snapshot) => (
                            <div 
                              ref={provided.innerRef} 
                              {...provided.draggableProps}
                              style={provided.draggableProps.style}
                            >
                              <WorkoutSectionCard
                                section={section}
                                isCollapsed={collapsedSections[section.id] || false}
                                onToggleCollapse={() =>
                                  setCollapsedSections(prev => ({
                                    ...prev,
                                    [section.id]: !prev[section.id]
                                  }))
                                }
                                onAddExercise={() => handleAddExercise(section.id)}
                                onRenameSection={(newName) => handleRenameSection(section.id, newName)}
                                onDeleteSection={() => handleDeleteSection(section.id)}
                                onDuplicateSection={() => handleDuplicateSection(section.id)}
                                sectionDragHandleProps={provided.dragHandleProps}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                
                {/* Add New Section Button */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleAddSection}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Section
                </Button>
              </div>
          </ScrollArea>

          {/* Sidebar - stays fixed, not inside ScrollArea */}
          {sidebarOpen && (
            <div className="w-80 flex-shrink-0">
              <WorkoutArrangementSidebar
                sections={workoutSections}
                collapsedSections={sidebarCollapsedSections}
                onToggleSectionCollapse={(sectionId) =>
                  setSidebarCollapsedSections(prev => ({
                    ...prev,
                    [sectionId]: !prev[sectionId]
                  }))
                }
                onScrollToExercise={handleScrollToExercise}
                getSupersetLabel={getSupersetLabel}
              />
            </div>
          )}
        </div>
        </DragDropContext>
      </DialogContent>

      {/* Exercise Library Popup - Rendered outside DialogContent for proper overlay layering */}
      <ExerciseLibraryPopup
        isOpen={isLibraryOpen}
        onClose={() => {
          setIsLibraryOpen(false);
          setCurrentSectionId(null);
          setChangeExerciseTarget(null);
        }}
        onSelectExercises={handleExercisesSelected}
        selectedExerciseIds={[]}
        onExerciseCreated={handleExerciseCreated}
        singleSelect={true}
      />

      {/* Method Selection Dialog - conditionally render ad-hoc or regular */}
      {isAdHocSession && toolboxData ? (
        <AdHocMethodSelectionDialog
          isOpen={isMethodSelectionOpen}
          onClose={() => {
            setIsMethodSelectionOpen(false);
            setSelectedExercisesForMethod([]);
            setCurrentSectionId(null);
          }}
          onMethodSelected={handleAdHocMethodSelected}
          toolboxData={toolboxData}
          needsExplicitOverlay={true}
        />
      ) : (
        <MethodSelectionDialog
          isOpen={isMethodSelectionOpen}
          onClose={() => {
            setIsMethodSelectionOpen(false);
            setSelectedExercisesForMethod([]);
            setCurrentSectionId(null);
          }}
          onMethodSelected={handleMethodSelected}
          availableMethods={availableMethods}
          mesocycleId={mesocycleId}
          microcycleIndex={microcycleIndex}
          sessionIndex={sessionIndex}
          needsExplicitOverlay={true}
        />
      )}

      {/* Combined Test/Event Dialog */}
      <CombinedTestEventDialog
        open={isTestEventDialogOpen}
        onOpenChange={setIsTestEventDialogOpen}
        existingTests={availableTests || []}
        existingEvents={availableEvents || []}
        scheduledTestNames={trainingDay?.testNames || []}
        scheduledEventNames={trainingDay?.eventNames || []}
        onSelect={(selected) => {
          onAddTestEvent?.(
            dayDate,
            selected.type,
            selected.id,
            selected.name,
            selected.isNew,
            selected.comments
          );
          setIsTestEventDialogOpen(false);
        }}
        onDelete={(type, name) => {
          onDeleteTestEvent?.(dayDate, type, name);
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
      />

      {/* Delete Section Confirmation Dialog */}
      <AlertDialog open={!!sectionToDelete} onOpenChange={() => setSectionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>
              This section contains{' '}
              {workoutSections.find(s => s.id === sectionToDelete)?.exercises.length || 0}{' '}
              exercise(s). Deleting this section will remove all exercises in it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sectionToDelete && confirmDeleteSection(sectionToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exercise Detail Dialog */}
      {detailExercise && (
        <ExerciseDetailDialog
          isOpen={!!detailExercise}
          onClose={() => setDetailExercise(null)}
          exerciseId={detailExercise.exerciseId}
          exerciseName={detailExercise.exerciseName}
          mode="edit"
          onSave={handleSaveExerciseToLibrary}
        />
      )}

      {/* Circuit sub-exercise detail dialog (same mode as regular exercises) */}
      {circuitSubDetail && (
        <ExerciseDetailDialog
          isOpen={true}
          onClose={() => setCircuitSubDetail(null)}
          exerciseId={circuitSubDetail.exerciseId}
          exerciseName={circuitSubDetail.exerciseName}
          libraryId={circuitSubDetail.libraryId}
          mode="edit"
        />
      )}

      {/* Progression / Regression chain picker — custom overlay so it stacks above the sheet */}
      {chainPickerTarget && (
        <>
          {/* Backdrop — z-[200] sits above the sheet content (z-[110]) */}
          <div
            className="fixed inset-0 z-[200] bg-black/60"
            onClick={() => { setChainPickerTarget(null); setChainPickerEntries([]); }}
          />
          {/* Panel */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[210] w-full max-w-sm bg-background rounded-lg border shadow-xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b flex items-start justify-between gap-3 shrink-0">
              <div>
                <p className="text-base font-semibold leading-snug">Change Exercise</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Replace <span className="font-medium text-foreground">{chainPickerTarget.exerciseName}</span>
                </p>
              </div>
              <button
                onClick={() => { setChainPickerTarget(null); setChainPickerEntries([]); }}
                className="shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chain list */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1.5">
              {chainPickerLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
              ) : (() => {
                const progs = chainPickerEntries.filter(e => e.direction === 'progression').sort((a, b) => b.level - a.level);
                const regs  = chainPickerEntries.filter(e => e.direction === 'regression').sort((a, b) => a.level - b.level);
                const renderEntry = (entry: ChainPickerEntry) => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      handleChangeExercise(chainPickerTarget.exId, {
                        exerciseId: entry.toExerciseId,
                        exerciseName: entry.toExerciseName,
                        libraryId: '',
                      });
                      setChainPickerTarget(null);
                      setChainPickerEntries([]);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-muted/70 active:bg-muted transition-colors border border-transparent hover:border-border"
                  >
                    {entry.direction === 'progression'
                      ? <TrendingUp className="h-4 w-4 text-orange-500 shrink-0" />
                      : <TrendingDown className="h-4 w-4 text-blue-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.toExerciseName || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.direction === 'progression' ? 'Progression' : 'Regression'} {entry.level}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </p>
                    </div>
                  </button>
                );

                if (progs.length === 0 && regs.length === 0) {
                  return <p className="text-sm text-muted-foreground text-center py-4">No progressions or regressions defined.</p>;
                }

                return (
                  <>
                    {progs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Harder</p>
                        {progs.map(renderEntry)}
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-muted/40 border border-border/60">
                      <div className="h-4 w-4 rounded-full bg-primary shrink-0" />
                      <p className="text-sm font-medium flex-1 truncate">{chainPickerTarget.exerciseName}</p>
                      <span className="text-xs text-muted-foreground">current</span>
                    </div>
                    {regs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Easier</p>
                        {regs.map(renderEntry)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Browse library fallback */}
            <div className="px-4 pb-4 pt-3 border-t shrink-0">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setChangeExerciseTarget(chainPickerTarget.exId);
                  setChainPickerTarget(null);
                  setChainPickerEntries([]);
                  setIsLibraryOpen(true);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Browse library…
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Save to Session Library Dialog */}
      <SaveToLibraryDialog
        open={saveLibOpen}
        onOpenChange={setSaveLibOpen}
        sessionName={sessionName}
        exercises={exercises.filter(e => e.dayDate === dayDate && e.sessionIndex === sessionIndex)}
        sections={(sessionSectionsProp ?? []).filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)}
        defaultMethod={exercises.find(e => e.dayDate === dayDate && e.sessionIndex === sessionIndex)?.categoryName?.split('::')[0]}
        onSaved={() => setSaveLibOpen(false)}
      />

      {/* Circuit edit dialog — opens CircuitBuilderDialog pre-filled with current session circuit data */}
      {circuitDetailExercise && (
        <CircuitBuilderDialog
          isOpen={true}
          darkOverlay
          onClose={() => setCircuitDetailExercise(null)}
          circuit={{
            id: circuitDetailExercise.circuitId ?? circuitDetailExercise.exerciseId,
            name: circuitDetailExercise.exerciseName,
            exercises: circuitDetailExercise.circuitExercises ?? [],
            rounds: circuitDetailExercise.circuitRounds ?? '3',
            restBetweenRounds: circuitDetailExercise.circuitRestBetweenRounds ?? '60',
            restBetweenExercises: circuitDetailExercise.circuitRestBetweenExercises ?? '15',
            comments: circuitDetailExercise.circuitComments,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          } satisfies Circuit}
          onCircuitCreated={handleCircuitEdited}
        />
      )}
    </Dialog>

      {/* Exercise history sheet — renders outside the Dialog to avoid z-index stacking */}
      {athleteConnectionId && historyTarget && (
        <ExerciseHistorySheet
          open={!!historyTarget}
          onClose={() => setHistoryTarget(null)}
          exerciseName={historyTarget}
          athleteConnectionId={athleteConnectionId}
          prefetchedEntries={historyCache ? (historyCache.get(historyTarget.toLowerCase()) ?? []) : null}
        />
      )}

      {/* Print view — hidden on screen, visible only during window.print() via @media print CSS */}
      <PrintSessionView
        sessionName={sessionName || `Session ${sessionIndex + 1}`}
        date={
          dayDate && /^\d{4}-\d{2}-\d{2}$/.test(dayDate)
            ? format(parseISO(dayDate), 'EEEE, MMMM d, yyyy')
            : dayDate ? 'Library Session' : ''
        }
        dayIntensity={currentIntensity}
        sessionIntensity={sessionIntensity}
        sessionComments={sessionComments}
        sections={workoutSections}
        toolboxData={toolboxData}
        getSupersetLabel={getSupersetLabel}
        visibilityOverrides={parameterVisibilityOverrides}
      />
    </WorkoutSessionProvider>
  );
}
