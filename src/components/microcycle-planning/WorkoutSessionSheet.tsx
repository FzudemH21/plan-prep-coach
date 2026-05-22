import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { Plus, Save, PanelRightClose, PanelRight, Pencil, MessageSquare, ChevronDown, X, Trophy, Calendar as CalendarIcon, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkoutSection, WorkoutExercise, WorkoutSession, SupersetMapping } from '@/types/workout';
import { IntensityLevel } from '@/types/training';
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
import { FocusedSessionContext } from '@/components/wizard/WizardAIAssistant';

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
  getIntensityColor?: (intensity: IntensityLevel) => string;
  intensityLevels?: IntensityLevel[];
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
  getIntensityColor,
  intensityLevels,
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
}: WorkoutSessionSheetProps) {
  const { toast } = useToast();
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
  const [sessionIntensity, setSessionIntensity] = useState<IntensityLevel>('moderate');
  const [dayIntensityPopoverOpen, setDayIntensityPopoverOpen] = useState(false);
  const [sessionIntensityPopoverOpen, setSessionIntensityPopoverOpen] = useState(false);
  const [isTestEventDialogOpen, setIsTestEventDialogOpen] = useState(false);
  const [testsEventsExpanded, setTestsEventsExpanded] = useState(true);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  
  // Parameters database hook for test method dropdown
  const { data: parametersData, addParameter } = useParametersDataV2();
  const { data: parametersToolboxData } = useToolboxData();
  
  // Exercise detail dialog state
  const [detailExercise, setDetailExercise] = useState<WorkoutExercise | null>(null);

  // Circuit card detail dialog state (clicking circuit name)
  const [circuitDetailExercise, setCircuitDetailExercise] = useState<WorkoutExercise | null>(null);

  // Circuit sub-exercise detail dialog state (clicking sub-exercise name)
  const [circuitSubDetail, setCircuitSubDetail] = useState<{ exerciseId: string; libraryId: string; exerciseName: string } | null>(null);

  // Change exercise library popup state
  const [changeExerciseTarget, setChangeExerciseTarget] = useState<string | null>(null);

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
                  const setCount = 3; // Default blank
                  
                  // Build BLANK parameters
                  const blankParameters: Record<string, string | number> = {};
                  blankParameters[setParamName] = setCount;
                  
                  methodEntries.forEach(entry => {
                    if (entry.isFrequencyParameter) return;
                    const paramName = entry.parameterName;
                    
                    // Add unit if quantitative
                    if (entry.parameterType === 'quantitative' && entry.options?.length > 0) {
                      blankParameters[`${paramName}_unit`] = entry.options[0];
                    }
                    
                    // Create per-set keys (all blank)
                    if (!entry.isSetParameter && setCount > 0) {
                      for (let i = 1; i <= setCount; i++) {
                        blankParameters[`${paramName}_set${i}`] = '';
                      }
                    }
                  });
                  
                  // Detect auto-calc units
                  let has1RMUnit = false;
                  let hasMaxHRUnit = false;
                  for (const entry of methodEntries) {
                    if (entry.parameterType === 'quantitative' && entry.options) {
                      if (entry.options.includes('%1RM')) has1RMUnit = true;
                      if (entry.options.includes('%maxHR') || entry.options.includes('%HRmax')) hasMaxHRUnit = true;
                    }
                  }
                  
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
                    autoCalculateWeight: has1RMUnit ? true : undefined,
                    autoCalculateTargetHR: hasMaxHRUnit ? true : undefined,
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
                
                // Try chronological session index FIRST for split methods, then fallback to session 0
                const storedParams = 
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[chronologicalSessionIndex] ||
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[0] ||
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[chronologicalSessionIndex] ||
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[0] ||
                  {};
                
                // PRIMARY: Derive parameters from storedParams (method periodization grid)
                let methodParams: { name: string; type: string; isSetParameter?: boolean; defaultValue?: any; unit?: string }[] = Object.keys(storedParams)
                  .filter(k => !k.endsWith('_unit'))
                  .map((name) => ({
                    name,
                    type: typeof (storedParams as any)[name] === 'number' ? 'number' : 'text',
                    isSetParameter: /^sets?$/i.test(name) || /ground contacts/i.test(name),
                    defaultValue: (storedParams as any)[name],
                    unit: undefined
                  }));
                
                // FALLBACK: Only use static dictionary if storedParams is empty
                if (methodParams.length === 0) {
                  methodParams = getParametersForMethod(ex.methodId) || [];
                }
                
                let exerciseParams: Record<string, string | number> = {};
                if (storedParams && typeof storedParams === 'object' && !Array.isArray(storedParams)) {
                  exerciseParams = storedParams as Record<string, string | number>;
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
                
                // Detect %1RM and %maxHR units from toolbox data for auto-calculation defaults
                let has1RMUnit = false;
                let hasMaxHRUnit = false;
                
                if (toolboxData) {
                  // Parse methodId to match toolbox category/subCategory structure
                  // e.g., "Lower Body Resistance Training - Strength" -> category: "Lower Body Resistance Training", subCategory: "Strength"
                  const methodParts = (ex.methodId ?? '').split(' - ');
                  const methodCategory = methodParts[0];
                  const methodSubCategory = methodParts.length > 1 ? methodParts.slice(1).join(' - ') : '';
                  
                  const methodEntries = toolboxData.entries.filter(entry => {
                    return entry.category === methodCategory && 
                           (methodSubCategory === '' || entry.subCategory === methodSubCategory);
                  });
                  
                  for (const entry of methodEntries) {
                    if (entry.parameterType === 'quantitative' && entry.options) {
                      if (entry.options.includes('%1RM')) {
                        has1RMUnit = true;
                      }
                      if (entry.options.includes('%maxHR') || entry.options.includes('%HRmax')) {
                        hasMaxHRUnit = true;
                      }
                    }
                  }
                }
                
                // Use existing values if set, otherwise default to true when relevant unit exists
                const existingAutoWeight = (ex as any).autoCalculateWeight;
                const existingAutoHR = (ex as any).autoCalculateTargetHR;
                
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
                  autoCalculateWeight: existingAutoWeight !== undefined ? existingAutoWeight : (has1RMUnit ? true : undefined),
                  autoCalculateTargetHR: existingAutoHR !== undefined ? existingAutoHR : (hasMaxHRUnit ? true : undefined)
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
        const setCount = 3; // Default blank
        
        // Build BLANK parameters
        const blankParameters: Record<string, string | number> = {};
        blankParameters[setParamName] = setCount;
        
        methodEntries.forEach(entry => {
          if (entry.isFrequencyParameter) return;
          const paramName = entry.parameterName;
          
          // Add unit if quantitative
          if (entry.parameterType === 'quantitative' && entry.options?.length > 0) {
            blankParameters[`${paramName}_unit`] = entry.options[0];
          }
          
          // Create per-set keys (all blank)
          if (!entry.isSetParameter && setCount > 0) {
            for (let i = 1; i <= setCount; i++) {
              blankParameters[`${paramName}_set${i}`] = '';
            }
          }
        });
        
        // Detect auto-calc units
        let has1RMUnit = false;
        let hasMaxHRUnit = false;
        for (const entry of methodEntries) {
          if (entry.parameterType === 'quantitative' && entry.options) {
            if (entry.options.includes('%1RM')) has1RMUnit = true;
            if (entry.options.includes('%maxHR') || entry.options.includes('%HRmax')) hasMaxHRUnit = true;
          }
        }
        
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
          autoCalculateWeight: has1RMUnit ? true : undefined,
          autoCalculateTargetHR: hasMaxHRUnit ? true : undefined,
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
      
      // Try chronological session index FIRST for split methods, then fallback to session 0
      const storedParams = 
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[chronologicalSessionIndex] ||
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[0] ||
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[chronologicalSessionIndex] ||
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[0] ||
        {};
      
      // PRIMARY: Derive parameters from storedParams (method periodization grid)
      let methodParams: { name: string; type: string; isSetParameter?: boolean; defaultValue?: any; unit?: string }[] = Object.keys(storedParams)
        .filter(k => !k.endsWith('_unit'))
        .map((name) => ({
          name,
          type: typeof (storedParams as any)[name] === 'number' ? 'number' : 'text',
          isSetParameter: /^sets?$/i.test(name) || /ground contacts/i.test(name),
          defaultValue: (storedParams as any)[name],
          unit: undefined
        }));
      
      // FALLBACK: Only use static dictionary if storedParams is empty
      if (methodParams.length === 0) {
        methodParams = getParametersForMethod(ex.methodId) || [];
      }
      
      let exerciseParams: Record<string, string | number> = {};
      if (storedParams && typeof storedParams === 'object' && !Array.isArray(storedParams)) {
        exerciseParams = storedParams as Record<string, string | number>;
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
      
      // Detect %1RM and %maxHR units from toolbox data for auto-calculation defaults
      let has1RMUnit = false;
      let hasMaxHRUnit = false;
      
      if (toolboxData) {
        // Parse methodId to match toolbox category/subCategory structure
        // e.g., "Lower Body Resistance Training - Strength" -> category: "Lower Body Resistance Training", subCategory: "Strength"
        const methodParts = (ex.methodId ?? '').split(' - ');
        const methodCategory = methodParts[0];
        const methodSubCategory = methodParts.length > 1 ? methodParts.slice(1).join(' - ') : '';
        
        const methodEntries = toolboxData.entries.filter(entry => {
          return entry.category === methodCategory && 
                 (methodSubCategory === '' || entry.subCategory === methodSubCategory);
        });
        
        for (const entry of methodEntries) {
          if (entry.parameterType === 'quantitative' && entry.options) {
            if (entry.options.includes('%1RM')) {
              has1RMUnit = true;
            }
            if (entry.options.includes('%maxHR') || entry.options.includes('%HRmax')) {
              hasMaxHRUnit = true;
            }
          }
        }
      }
      
      // Use existing values if set, otherwise default to true when relevant unit exists
      const existingAutoWeight = (ex as any).autoCalculateWeight;
      const existingAutoHR = (ex as any).autoCalculateTargetHR;
      
      sectionsMap.get(sectionName)!.push({
        id: (ex as any).id || ex.exerciseId,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        methodId: ex.methodId,
        categoryName: ex.categoryName || '',
        order: index,
        parameters,
        notes: ex.notes,
        autoCalculateWeight: existingAutoWeight !== undefined ? existingAutoWeight : (has1RMUnit ? true : undefined),
        autoCalculateTargetHR: existingAutoHR !== undefined ? existingAutoHR : (hasMaxHRUnit ? true : undefined)
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
    // PRIORITY: Fresh exercises prop takes precedence over stale localStorage
    if (exercises.length > 0) {
      return buildSectionsFromExercises(exercises, parameterValues);
    }
    
    // Only use localStorage if exercises prop is empty (backward compatibility)
    const sectionsKey = `workoutSections_${mesocycleId}_${dayDate}_${sessionIndex}`;
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
      // 2. Exercises were added (count increased)
      // 3. Dialog just opened (hasInitializedRef is false)
      if (!hasInitializedRef.current || currentCount > prevCount) {
        const newSections = buildSectionsFromExercises(exercises, parameterValues);
        
        // MERGE: Preserve existing exercise parameters (especially toolbox-sourced blank ones)
        // Build a map of existing exercise IDs to their state
        const existingExerciseMap = new Map<string, WorkoutExercise>();
        workoutSections.forEach(section => {
          section.exercises.forEach(ex => {
            existingExerciseMap.set(ex.id, ex);
          });
        });
        
        // Merge: for each exercise in newSections, if it already exists in workoutSections
        // OR was just added via handleAdHocMethodSelected (freshly added), preserve its parameters.
        const mergedSections = newSections.map(section => ({
          ...section,
          exercises: section.exercises.map(newEx => {
            const existing = existingExerciseMap.get(newEx.id);
            const isFreshlyAdded = freshlyAddedExerciseIdsRef.current.has(newEx.id);
            
            if (existing) {
              // Preserve existing state (parameters, notes, parameterSource, etc.) - don't overwrite with rebuilt values
              return {
                ...newEx,
                parameters: existing.parameters,
                notes: existing.notes,
                eachSide: existing.eachSide,
                autoCalculateWeight: existing.autoCalculateWeight,
                autoCalculateTargetHR: existing.autoCalculateTargetHR,
                parameterSource: (existing as any).parameterSource, // Preserve parameterSource marker
              };
            }
            
            if (isFreshlyAdded) {
              // Freshly added via ad-hoc dialog - skip rebuild, keep blank params from handleAdHocMethodSelected
              return newEx;
            }
            
            // New exercise - use the built parameters
            return newEx;
          })
        }));
        
        // Clear freshly added IDs after merge
        freshlyAddedExerciseIdsRef.current.clear();
        
        setWorkoutSections(mergedSections);
        hasInitializedRef.current = true;
      }
      
      prevExerciseCountRef.current = currentCount;
    }
  }, [isOpen, exercises.length, dayDate, sessionIndex, parameterValuesKey]);
  
  // Reset initialization flag when dialog closes
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen]);

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
                  autoCalculateWeight: existing.autoCalculateWeight,
                  autoCalculateTargetHR: existing.autoCalculateTargetHR,
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

  // Get current intensity for the day
  const currentIntensity = useMemo(() => {
    if (!dailyIntensityData) return 'moderate' as IntensityLevel;
    const dayIntensity = dailyIntensityData.find(di => di.date === dayDate);
    return dayIntensity?.intensity || 'moderate' as IntensityLevel;
  }, [dailyIntensityData, dayDate]);

  // Load session metadata, intensity, and supersets from localStorage
  useEffect(() => {
    if (isOpen) {
      // Use session name from trainingDay.sessionNames (synced with Step 1)
      setSessionName(sessionNameFromState || `Session ${sessionIndex + 1}`);
      
      // Load comments from localStorage (workoutSessions_* format)
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

      // Load session intensity - behavior depends on context
      if (useExternalIntensityOnly) {
        // In Athlete Calendar context: always use day intensity from props
        // Don't read from global localStorage keys that won't match shifted dates
        setSessionIntensity(currentIntensity || 'moderate');
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
  }, [isOpen, mesocycleId, dayDate, sessionIndex, currentIntensity]);

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
    // Try sessionIndex=0 first (for non-split methods), then actual sessionIndex
    const storedParams = 
      parameterValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[0] ||
      parameterValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[sessionIndex] ||
      parameterValues[mesocycleId]?.[microcycleIndex]?.[methodId]?.[0] ||
      parameterValues[mesocycleId]?.[microcycleIndex]?.[methodId]?.[sessionIndex] ||
      {};

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

    // Create new exercises with parameterSource marker
    const newExercises = selectedExercisesForMethod.map((ex, index) => {
      return {
        id: `${ex.exerciseId}-${Date.now()}-${index}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        methodId,
        categoryName: categoryName || section.name,
        order: section.exercises.length + index,
        parameters: buildExerciseParams(),
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
        parameterSource: 'toolbox' as const, // Mark as toolbox-sourced to skip periodization
      }));
      
      onDistributionChange([...allExerciseDistribution, ...newDistributionEntries]);
    }

    // Store parameter visibility overrides
    if (Object.keys(parameterVisibility).length > 0) {
      const metadataKey = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
      try {
        const existing = localStorage.getItem(metadataKey);
        const parsed = existing ? JSON.parse(existing) : {};
        
        // Merge visibility overrides per exercise
        newExercises.forEach(ex => {
          parsed.parameterVisibility = parsed.parameterVisibility || {};
          parsed.parameterVisibility[ex.id] = parameterVisibility;
        });
        
        localStorage.setItem(metadataKey, JSON.stringify(parsed));
        setParameterVisibilityOverrides(parsed.parameterVisibility || {});
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
  const handleOpenChangeLibrary = (exerciseId: string) => {
    setChangeExerciseTarget(exerciseId);
    setIsLibraryOpen(true);
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

  const handleAutoCalculateWeightChange = (exerciseId: string, autoCalculateWeight: boolean) => {
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.map(ex => 
          ex.id === exerciseId ? { ...ex, autoCalculateWeight } : ex
        )
      }))
    );
  };

  const handleAutoCalculateTargetHRChange = (exerciseId: string, autoCalculateTargetHR: boolean) => {
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.map(ex => 
          ex.id === exerciseId ? { ...ex, autoCalculateTargetHR } : ex
        )
      }))
    );
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
    const newSectionNumber = workoutSections.length + 1;
    const newSection: WorkoutSection = {
      id: `section-${Date.now()}`,
      name: `Section ${newSectionNumber}`,
      order: workoutSections.length,
      exercises: []
    };
    
    setWorkoutSections([...workoutSections, newSection]);
    
    // Sync to Step 1
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
      const currentSections = sessionSectionsProp?.filter(
        s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
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
    onAutoCalculateWeightChange: handleAutoCalculateWeightChange,
    onAutoCalculateTargetHRChange: handleAutoCalculateTargetHRChange,
    onOpenExerciseDetail: handleOpenExerciseDetail,
    onOpenCircuitExerciseDetail: handleOpenCircuitExerciseDetail,
    onChangeExercise: handleChangeExercise,
    onOpenChangeLibrary: handleOpenChangeLibrary,
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
    handleAutoCalculateWeightChange,
    handleAutoCalculateTargetHRChange,
    handleOpenExerciseDetail,
    handleOpenCircuitExerciseDetail,
    handleChangeExercise,
    handleOpenChangeLibrary,
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
                {dayDate ? format(parseISO(dayDate), 'EEEE, MMMM d, yyyy') : 'New Session'}
              </DialogDescription>
              
              {/* Editable Day Intensity */}
              {getIntensityColor && intensityLevels && onIntensityChange && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">
                    Day intensity:
                  </span>
                  <Popover open={dayIntensityPopoverOpen} onOpenChange={setDayIntensityPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="flex items-center gap-2 h-7 px-2 hover:bg-accent"
                      >
                        <div 
                          className={cn(
                            "w-5 h-5 rounded-sm border shrink-0",
                            getIntensityColor(currentIntensity)
                          )}
                        />
                        <span className="text-xs font-medium capitalize">
                          {currentIntensity.replace('-', ' ')}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-52 p-2 z-[120] bg-popover" 
                      align="start"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-medium mb-2 text-muted-foreground">
                          Change Day Intensity
                        </p>
                        {intensityLevels.map((level) => (
                          <button
                            key={level}
                            onClick={(e) => {
                              e.stopPropagation();
                              onIntensityChange(dayDate, level);
                              // If single session, also update session intensity state AND persist
                              if (isSingleSessionDay) {
                                setSessionIntensity(level);
                                if (onSessionIntensityChange) {
                                  onSessionIntensityChange(dayDate, sessionIndex, level);
                                }
                              }
                              setDayIntensityPopoverOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left",
                              level === currentIntensity && "bg-accent"
                            )}
                          >
                            <div 
                              className={cn(
                                "w-4 h-4 rounded-sm border shrink-0",
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
                </div>
              )}

              {/* Editable Session Intensity */}
              {getIntensityColor && intensityLevels && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">
                    Session intensity:
                  </span>
                  <Popover open={sessionIntensityPopoverOpen} onOpenChange={setSessionIntensityPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="flex items-center gap-2 h-7 px-2 hover:bg-accent"
                      >
                        <div 
                          className={cn(
                            "w-5 h-5 rounded-sm border shrink-0",
                            getIntensityColor(sessionIntensity)
                          )}
                        />
                        <span className="text-xs font-medium capitalize">
                          {sessionIntensity.replace('-', ' ')}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-52 p-2 z-[120] bg-popover" 
                      align="start"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-medium mb-2 text-muted-foreground">
                          Change Session Intensity
                          {isSingleSessionDay && (
                            <span className="block text-[10px] text-muted-foreground/70 mt-0.5">
                              (Linked to day intensity)
                            </span>
                          )}
                        </p>
                        {intensityLevels.map((level) => (
                          <button
                            key={level}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionIntensity(level);
                              // Immediately persist session intensity
                              if (onSessionIntensityChange) {
                                onSessionIntensityChange(dayDate, sessionIndex, level);
                              }
                              // If single session, also update day intensity
                              if (isSingleSessionDay && onIntensityChange) {
                                onIntensityChange(dayDate, level);
                              }
                              setSessionIntensityPopoverOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left",
                              level === sessionIntensity && "bg-accent"
                            )}
                          >
                            <div 
                              className={cn(
                                "w-4 h-4 rounded-sm border shrink-0",
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
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pr-10">
              {onOpenAIAssistant && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const uniqueMethods = [...new Set(exercises.map(e => e.categoryName))];
                    // Build a lookup of current params from workoutSections state
                    const paramLookup = new Map<string, Record<string, string | number>>();
                    workoutSections.forEach(sec => {
                      sec.exercises.forEach(ex => {
                        paramLookup.set(ex.exerciseId, ex.parameters ?? {});
                      });
                    });
                    onOpenAIAssistant({
                      dayDate,
                      dayLabel: format(parseISO(`${dayDate}T12:00:00`), 'EEEE d MMMM yyyy'),
                      sessionIndex,
                      sessionName,
                      methods: uniqueMethods,
                      exercises: exercises.map(e => ({
                        name: e.exerciseName,
                        methodName: e.categoryName,
                        params: paramLookup.get(e.exerciseId) ?? {},
                      })),
                    });
                  }}
                  title="Open AI Assistant"
                >
                  <Bot className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
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
        singleSelect={!!changeExerciseTarget}
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
    </WorkoutSessionProvider>
  );
}
