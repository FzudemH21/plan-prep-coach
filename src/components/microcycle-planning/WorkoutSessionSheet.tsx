import React, { useState, useMemo, useEffect } from 'react';
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
import { Plus, Save, PanelRightClose, PanelRight, Pencil, MessageSquare, ChevronDown, X, Trophy, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkoutSection, WorkoutExercise, WorkoutSession, SupersetMapping } from '@/types/workout';
import { IntensityLevel } from '@/types/training';
import { TrainingDay } from '@/types/daily-intensity';
import { WorkoutSectionCard } from './WorkoutSectionCard';
import { WorkoutArrangementSidebar } from './WorkoutArrangementSidebar';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { MethodSelectionDialog } from './MethodSelectionDialog';
import { CombinedTestEventDialog } from './CombinedTestEventDialog';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { getParametersForMethod } from '@/data/methodParameters';
import { ExerciseSelection } from '@/types/microcycle-planning';
import { cn } from '@/lib/utils';

interface ExerciseDistribution {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
  order?: number;
  sectionId?: string;
  supersetId?: string;
  notes?: string;
}

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
  onSupersetsChange
}: WorkoutSessionSheetProps) {
  const { toast } = useToast();
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

  // DEBUG: Log parameterValues structure
  console.log('[WorkoutSessionSheet] Props received:', {
    mesocycleId,
    microcycleIndex,
    dayDate,
    sessionIndex,
    exercisesCount: exercises.length,
    parameterValuesTopLevelKeys: Object.keys(parameterValues),
    parameterValuesForMeso: parameterValues[mesocycleId] ? Object.keys(parameterValues[mesocycleId]) : 'NOT FOUND',
    parameterValuesForMicro: parameterValues[mesocycleId]?.[microcycleIndex] ? Object.keys(parameterValues[mesocycleId][microcycleIndex]) : 'NOT FOUND',
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
                // Priority lookup: category-specific first (for split methods), then base method
                const hasValidCategory = ex.categoryName && 
                  ex.categoryName !== 'Uncategorized' && 
                  ex.categoryName !== '';
                const fullMethodKey = hasValidCategory 
                  ? `${ex.methodId}::${ex.categoryName}` 
                  : ex.methodId;
                // Try sessionIndex=0 first (for non-split methods), then actual sessionIndex
                const storedParams = 
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[0] ||
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[sessionIndex] ||
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[0] ||
                  currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[sessionIndex] ||
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
                
                return {
                  id: (ex as any).id || `${ex.exerciseId}-${idx}`,
                  exerciseId: ex.exerciseId,
                  exerciseName: ex.exerciseName,
                  methodId: ex.methodId,
                  categoryName: ex.categoryName || '',
                  order: (ex as any).order ?? idx,
                  supersetId: (ex as any).supersetId,
                  parameters,
                  notes: ex.notes
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
      
      // Priority lookup: category-specific first (for split methods), then base method
      const hasValidCategory = ex.categoryName && 
        ex.categoryName !== 'Uncategorized' && 
        ex.categoryName !== '';
      const fullMethodKey = hasValidCategory 
        ? `${ex.methodId}::${ex.categoryName}` 
        : ex.methodId;
      // Try base method first (matches how MesocyclePage saves), then category-specific
      const storedParams = 
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[0] ||
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[sessionIndex] ||
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[0] ||
        currentParamValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[sessionIndex] ||
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
      
      sectionsMap.get(sectionName)!.push({
        id: `${ex.exerciseId}-${index}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        methodId: ex.methodId,
        categoryName: ex.categoryName || '',
        order: index,
        parameters,
        notes: ex.notes
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

  // Sync workoutSections when dialog opens, exercises change, or parameterValues become available
  useEffect(() => {
    if (isOpen && exercises.length > 0) {
      const newSections = buildSectionsFromExercises(exercises, parameterValues);
      setWorkoutSections(newSections);
    }
  }, [isOpen, exercises.length, dayDate, sessionIndex, parameterValuesKey]);
  
  // Force rebuild when dialog opens (separate effect to ensure fresh data)
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure parameterValues are loaded
      const timeoutId = setTimeout(() => {
        if (exercises.length > 0) {
          const newSections = buildSectionsFromExercises(exercises, parameterValues);
          setWorkoutSections(newSections);
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

      // Load session intensity - default to day intensity
      const intensityKey = `sessionIntensity_${mesocycleId}_${dayDate}_${sessionIndex}`;
      const storedIntensity = localStorage.getItem(intensityKey);
      
      if (storedIntensity) {
        setSessionIntensity(storedIntensity as IntensityLevel);
      } else {
        // Always initialize from day intensity
        setSessionIntensity(currentIntensity || 'moderate');
      }

      // Load supersets - prioritize prop, then localStorage
      if (supersetsProp && supersetsProp[dayDate]?.[sessionIndex]) {
        console.log('[WorkoutSessionSheet] Using supersets from Step 1 prop');
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

  const getSupersetLabel = (exerciseId: string): string | undefined => {
    // Use supersetsProp (from Step 1) as primary source, fallback to local state
    const sessionSupersets = (supersetsProp || supersets)?.[dayDate]?.[sessionIndex];
    if (!sessionSupersets) return undefined;
    
    // Check all sections (including unsectioned)
    for (const [sectionId, sectionSupersets] of Object.entries(sessionSupersets)) {
      for (const [supersetId, exerciseIds] of Object.entries(sectionSupersets)) {
        if (exerciseIds.includes(exerciseId)) {
          const match = supersetId.match(/superset-(\d+)/);
          return match ? `SS${match[1]}` : `SS?`;
        }
      }
    }
    return undefined;
  };

  const getSupersetPartners = (exerciseId: string): string[] => {
    // Use supersetsProp (from Step 1) as primary source, fallback to local state
    const sessionSupersets = (supersetsProp || supersets)?.[dayDate]?.[sessionIndex];
    if (!sessionSupersets) return [];
    
    // Check all sections (including unsectioned)
    for (const [sectionId, sectionSupersets] of Object.entries(sessionSupersets)) {
      for (const [supersetId, exerciseIds] of Object.entries(sectionSupersets)) {
        if (exerciseIds.includes(exerciseId)) {
          // Return all OTHER exercises in the same superset
          return exerciseIds.filter(id => id !== exerciseId);
        }
      }
    }
    return [];
  };

  const handleDragEnd = (result: DropResult) => {
    console.log('🎯 Drag end:', result);
    const { source, destination, type } = result;

    if (!destination) {
      console.log('❌ No destination - drag cancelled');
      return;
    }

    if (type === 'SECTION' || type === 'SIDEBAR_SECTION') {
      console.info(`📦 Reordering sections via ${type}`);
      const newSections = Array.from(workoutSections);
      const [removed] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, removed);
      setWorkoutSections(newSections.map((s, idx) => ({ ...s, order: idx })));
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
    // Save session comments only (session name is now synced via onRenameSession to trainingDays.sessionNames)
    const metadataKey = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(metadataKey, JSON.stringify({
      comments: sessionComments
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
    if (!currentSectionId) return;
    
    // Store exercises and open method selection dialog
    setSelectedExercisesForMethod(exercises);
    setIsLibraryOpen(false);
    setIsMethodSelectionOpen(true);
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

    // Clean up
    setIsMethodSelectionOpen(false);
    setSelectedExercisesForMethod([]);
    setCurrentSectionId(null);
  };

  const handleExerciseCreated = (exercise: ExerciseSelection) => {
    // When a new exercise is created, automatically add it
    handleExercisesSelected([exercise]);
  };

  const handleDuplicateExercise = (exerciseId: string) => {
    setWorkoutSections(sections =>
      sections.map(section => {
        const exIndex = section.exercises.findIndex(ex => ex.id === exerciseId);
        if (exIndex === -1) return section;
        
        const original = section.exercises[exIndex];
        const duplicate: WorkoutExercise = {
          ...original,
          id: `${original.id}-copy-${Date.now()}`,
          order: exIndex + 1
        };
        
        const newExercises = [...section.exercises];
        newExercises.splice(exIndex + 1, 0, duplicate);
        
        return {
          ...section,
          exercises: newExercises.map((ex, idx) => ({ ...ex, order: idx }))
        };
      })
    );
  };

  const handleDeleteExercise = (exerciseId: string) => {
    setWorkoutSections(sections =>
      sections.map(section => ({
        ...section,
        exercises: section.exercises.filter(ex => ex.id !== exerciseId).map((ex, idx) => ({ ...ex, order: idx }))
      }))
    );
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
  };

  const handleToggleSuperset = (exerciseId1: string, exerciseId2: string, sectionId?: string) => {
    const sectionKey = sectionId || '__unsectioned__';
    
    // Read from supersetsProp (authoritative source from Step 1) instead of local state
    const sessionSupersets = supersetsProp?.[dayDate]?.[sessionIndex] || {};
    const sectionSupersets = sessionSupersets[sectionKey] || {};
    const daySuperset: Record<string, string[]> = JSON.parse(JSON.stringify(sectionSupersets));
    
    // Find if exercises are in any superset
    let superset1: string | null = null;
    let superset2: string | null = null;
    
    for (const [supersetId, exerciseIds] of Object.entries(daySuperset)) {
      if (exerciseIds.includes(exerciseId1)) superset1 = supersetId;
      if (exerciseIds.includes(exerciseId2)) superset2 = supersetId;
    }
    
    if (superset1 && superset1 === superset2) {
      // UNLINK: split the superset at this connection point
      const currentIds = daySuperset[superset1];
      const index1 = currentIds.indexOf(exerciseId1);
      const index2 = currentIds.indexOf(exerciseId2);
      
      // Only unlink if they are adjacent in the array
      if (Math.abs(index1 - index2) === 1) {
        const splitPoint = Math.min(index1, index2) + 1;
        const firstGroup = currentIds.slice(0, splitPoint);
        const secondGroup = currentIds.slice(splitPoint);
        
        // Keep first group in original superset (if 2+ exercises)
        if (firstGroup.length >= 2) {
          daySuperset[superset1] = firstGroup;
        } else {
          delete daySuperset[superset1];
        }
        
        // Create new superset for second group (if 2+ exercises)
        if (secondGroup.length >= 2) {
          const existingSupersetIds = Object.keys(daySuperset).map(id => {
            const match = id.match(/superset-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
          const nextId = existingSupersetIds.length > 0 ? Math.max(...existingSupersetIds) + 1 : 1;
          const newSupersetId = `superset-${nextId}`;
          daySuperset[newSupersetId] = secondGroup;
        }
        
        toast({ title: "Exercises unlinked", description: "Connection removed" });
      } else {
        // Not adjacent - shouldn't happen with current UI, but handle gracefully
        toast({ title: "Cannot unlink", description: "Exercises must be adjacent" });
      }
    } else if (superset1 && superset2 && superset1 !== superset2) {
      // MERGE two different supersets
      const merged = Array.from(new Set([...(daySuperset[superset1] || []), ...(daySuperset[superset2] || [])]));
      daySuperset[superset1] = merged;
      delete daySuperset[superset2];
      toast({ title: "Exercises linked", description: "Supersets merged" });
    } else if (superset1 && !superset2) {
      // Add exercise2 to superset1
      daySuperset[superset1] = Array.from(new Set([...(daySuperset[superset1] || []), exerciseId2]));
      toast({ title: "Exercises linked", description: "Added to superset" });
    } else if (!superset1 && superset2) {
      // Add exercise1 to superset2
      daySuperset[superset2] = Array.from(new Set([...(daySuperset[superset2] || []), exerciseId1]));
      toast({ title: "Exercises linked", description: "Added to superset" });
    } else {
      // Create new superset
      const existingSupersetIds = Object.keys(daySuperset).map(id => {
        const match = id.match(/superset-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextId = existingSupersetIds.length > 0 ? Math.max(...existingSupersetIds) + 1 : 1;
      const newSupersetId = `superset-${nextId}`;
      daySuperset[newSupersetId] = [exerciseId1, exerciseId2];
      toast({ title: "Exercises linked", description: "Superset created" });
    }
    
    // Update state - use supersetsProp as base to sync with Step 1
    const newSupersets = structuredClone(supersetsProp || {});
    if (!newSupersets[dayDate]) newSupersets[dayDate] = {};
    if (!newSupersets[dayDate][sessionIndex]) newSupersets[dayDate][sessionIndex] = {};
    newSupersets[dayDate][sessionIndex][sectionKey] = daySuperset;
    
    setSupersets(newSupersets);
    
    // Persist to localStorage
    const key = `workoutSupersets_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(key, JSON.stringify(newSupersets[dayDate][sessionIndex]));
    
    // Propagate to Step 1
    onSupersetsChange?.(newSupersets);
  };

  const handleScrollToExercise = (exerciseId: string) => {
    const element = document.getElementById(`exercise-${exerciseId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleAddSection = () => {
    const newSectionNumber = workoutSections.length + 1;
    const newSection: WorkoutSection = {
      id: `section-${Date.now()}`,
      name: `Section ${newSectionNumber}`,
      order: workoutSections.length,
      exercises: []
    };
    
    setWorkoutSections([...workoutSections, newSection]);
    
    toast({
      title: "Section added",
      description: "New section created successfully",
    });
  };

  const handleRenameSection = (sectionId: string, newName: string) => {
    setWorkoutSections(sections =>
      sections.map(s => s.id === sectionId ? { ...s, name: newName } : s)
    );
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
    
    toast({
      title: "Section duplicated",
      description: `"${section.name}" copied with ${section.exercises.length} exercise(s)`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0">
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
                {format(new Date(dayDate), 'EEEE, MMMM d, yyyy')}
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
                                onParameterChange={handleParameterChange}
                                onUnitChange={handleUnitChange}
                                onToggleSuperset={(ex1, ex2, sectionId) => handleToggleSuperset(ex1, ex2, sectionId)}
                                onDuplicateExercise={handleDuplicateExercise}
                                onDeleteExercise={handleDeleteExercise}
                                onAddExercise={() => handleAddExercise(section.id)}
                                onRenameSection={(newName) => handleRenameSection(section.id, newName)}
                                onDeleteSection={() => handleDeleteSection(section.id)}
                                onDuplicateSection={() => handleDuplicateSection(section.id)}
                                getSupersetLabel={getSupersetLabel}
                                sectionDragHandleProps={provided.dragHandleProps}
                                onExerciseNotesChange={handleExerciseNotesChange}
                                onSectionCommentsChange={handleSectionCommentsChange}
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
        }}
        onSelectExercises={handleExercisesSelected}
        selectedExerciseIds={[]}
        onExerciseCreated={handleExerciseCreated}
      />

      {/* Method Selection Dialog */}
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
      />

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
    </Dialog>
  );
}
