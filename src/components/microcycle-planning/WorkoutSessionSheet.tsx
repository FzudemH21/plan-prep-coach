import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Save, PanelRightClose, PanelRight, Pencil, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkoutSection, WorkoutExercise, WorkoutSession, SupersetMapping } from '@/types/workout';
import { IntensityLevel } from '@/types/training';
import { WorkoutSectionCard } from './WorkoutSectionCard';
import { WorkoutArrangementSidebar } from './WorkoutArrangementSidebar';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { MethodSelectionDialog } from './MethodSelectionDialog';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { getParametersForMethod } from '@/data/methodParameters';
import { ExerciseSelection } from '@/types/microcycle-planning';
import { cn } from '@/lib/utils';

interface ExerciseDistribution {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
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
  getIntensityColor?: (intensity: IntensityLevel) => string;
  intensityLevels?: IntensityLevel[];
  totalSessionsOnDay?: number;
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
  getIntensityColor,
  intensityLevels,
  totalSessionsOnDay = 1
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
  const [workoutSections, setWorkoutSections] = useState<WorkoutSection[]>(() => {
    // Initialize sections from exercises
    const sectionsMap = new Map<string, WorkoutExercise[]>();
    
    exercises.forEach((ex, index) => {
      const sectionName = ex.categoryName || 'Main Work';
      if (!sectionsMap.has(sectionName)) {
        sectionsMap.set(sectionName, []);
      }
      
      // Get stored parameters from Method Periodization (prefer category-scoped key)
      const fullMethodKey = ex.categoryName ? `${ex.methodId}::${ex.categoryName}` : ex.methodId;
      const storedParams = parameterValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[sessionIndex]
        || parameterValues[mesocycleId]?.[microcycleIndex]?.[ex.methodId]?.[sessionIndex]
        || {};
      // Derive parameter definitions: prefer predefined list; fallback to keys present in stored params
      let methodParams = getParametersForMethod(ex.methodId);
      if (!methodParams || methodParams.length === 0) {
        methodParams = Object.keys(storedParams)
          .filter(k => !k.endsWith('_unit'))
          .map((name) => ({
            name,
            type: typeof (storedParams as any)[name] === 'number' ? 'number' : 'text'
          }));
      }
      
      console.log(`[WorkoutSessionSheet] Fetching params for:`, {
        mesocycleId,
        microcycleIndex,
        methodId: ex.methodId,
        sessionIndex,
        exerciseId: ex.exerciseId,
        storedParams,
        parameterValuesKeys: Object.keys(parameterValues),
        microcycleData: parameterValues[mesocycleId]?.[microcycleIndex]
      });
      
      // Parameters are stored directly by parameter name at the method level, not nested under exerciseId
      let exerciseParams: Record<string, string | number> = {};
      if (storedParams && typeof storedParams === 'object' && !Array.isArray(storedParams)) {
        exerciseParams = storedParams as Record<string, string | number>;
      }
      
      // Merge with defaults and prefill per-set values from method-level params
      const setParamName = methodParams.find(p => p.isSetParameter)?.name || 
                          methodParams.find(p => /^sets?$/i.test(p.name))?.name;
      const setCount = setParamName ? Number(exerciseParams[setParamName] || 0) : 0;
      
      const parameters: Record<string, string | number> = {};
      methodParams.forEach(param => {
        if (param.unit) {
          parameters[`${param.name}_unit`] = param.unit;
        }
        
        if (param.name === setParamName) {
          // Store the set count
          parameters[param.name] = Number(exerciseParams[param.name] ?? param.defaultValue ?? 0);
        } else if (setCount > 0) {
          // Prefill per-set values from method-level parameters
          for (let i = 1; i <= setCount; i++) {
            const perSetKey = `${param.name}_set${i}`;
            const legacyKey = `${ex.exerciseId}_${param.name}`;
            parameters[perSetKey] = 
              (exerciseParams as any)[perSetKey] ??  // Already per-set
              exerciseParams[param.name] ??          // Method-level value (fan out)
              (exerciseParams as any)[legacyKey] ??  // Legacy format
              param.defaultValue ?? '';
          }
          // ALSO store the base parameter name so fallback logic can detect it
          parameters[param.name] = exerciseParams[param.name] ?? param.defaultValue ?? '';
        } else {
          // No sets, use single value
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
        parameters
      });
    });
    
    return Array.from(sectionsMap.entries()).map(([name, exs], idx) => ({
      id: `section-${idx}`,
      name,
      order: idx,
      exercises: exs.sort((a, b) => a.order - b.order)
    }));
  });
  
  const [supersets, setSupersets] = useState<SupersetMapping>({});

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

  // Load session metadata and intensity from localStorage
  useEffect(() => {
    if (isOpen) {
      // Load session name and comments
      const key = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const { sessionName: name, comments } = JSON.parse(stored);
          setSessionName(name || `Session ${sessionIndex + 1}`);
          setSessionComments(comments || '');
        } catch {
          setSessionName(`Session ${sessionIndex + 1}`);
          setSessionComments('');
        }
      } else {
        setSessionName(`Session ${sessionIndex + 1}`);
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
    }
  }, [isOpen, mesocycleId, dayDate, sessionIndex, currentIntensity]);

  // Sync session intensity with day intensity for single session days
  useEffect(() => {
    if (isSingleSessionDay && currentIntensity && sessionIntensity !== currentIntensity) {
      setSessionIntensity(currentIntensity);
    }
  }, [isSingleSessionDay, currentIntensity]);

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
    const daySuperset = supersets[dayDate]?.[sessionIndex];
    if (!daySuperset) return undefined;
    
    for (const [supersetId, exerciseIds] of Object.entries(daySuperset)) {
      if (exerciseIds.includes(exerciseId)) {
        return `SS${supersetId.slice(-1)}`;
      }
    }
    return undefined;
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'SECTION') {
      // Reorder sections
      const newSections = Array.from(workoutSections);
      const [removed] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, removed);
      setWorkoutSections(newSections.map((s, idx) => ({ ...s, order: idx })));
      return;
    }

    if (type === 'EXERCISE') {
      // Moving exercises within or between sections
      const sourceSectionId = source.droppableId;
      const destSectionId = destination.droppableId;
      
      const sourceSection = workoutSections.find(s => s.id === sourceSectionId);
      const destSection = workoutSections.find(s => s.id === destSectionId);
      
      if (!sourceSection || !destSection) return;

      if (sourceSectionId === destSectionId) {
        // Moving within same section
        const newExercises = Array.from(sourceSection.exercises);
        const [removed] = newExercises.splice(source.index, 1);
        newExercises.splice(destination.index, 0, removed);
        
        setWorkoutSections(workoutSections.map(s =>
          s.id === sourceSectionId
            ? { ...s, exercises: newExercises.map((ex, idx) => ({ ...ex, order: idx })) }
            : s
        ));
      } else {
        // Moving between sections
        const sourceExercises = Array.from(sourceSection.exercises);
        const destExercises = Array.from(destSection.exercises);
        const [removed] = sourceExercises.splice(source.index, 1);
        destExercises.splice(destination.index, 0, removed);
        
        setWorkoutSections(workoutSections.map(s => {
          if (s.id === sourceSectionId) {
            return { ...s, exercises: sourceExercises.map((ex, idx) => ({ ...ex, order: idx })) };
          }
          if (s.id === destSectionId) {
            return { ...s, exercises: destExercises.map((ex, idx) => ({ ...ex, order: idx })) };
          }
          return s;
        }));
      }
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
    // Save session metadata (name and comments)
    const metadataKey = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(metadataKey, JSON.stringify({
      sessionName: sessionName || `Session ${sessionIndex + 1}`,
      comments: sessionComments
    }));

    // Save session intensity
    const intensityKey = `sessionIntensity_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(intensityKey, sessionIntensity);

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

    // Fetch parameters from Method Periodization
    const fullMethodKey = categoryName ? `${methodId}::${categoryName}` : methodId;
    const storedParams = parameterValues[mesocycleId]?.[microcycleIndex]?.[fullMethodKey]?.[sessionIndex]
      || parameterValues[mesocycleId]?.[microcycleIndex]?.[methodId]?.[sessionIndex]
      || {};

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

  const handleLinkSuperset = (exerciseId: string) => {
    // TODO: Implement superset linking dialog
    console.log('Link superset for exercise:', exerciseId);
  };

  const handleScrollToExercise = (exerciseId: string) => {
    const element = document.getElementById(`exercise-${exerciseId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditingName(false);
                    if (e.key === 'Escape') {
                      const key = `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;
                      const stored = localStorage.getItem(key);
                      const name = stored ? JSON.parse(stored).sessionName : `Session ${sessionIndex + 1}`;
                      setSessionName(name || `Session ${sessionIndex + 1}`);
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
                              // If single session, also update session intensity
                              if (isSingleSessionDay) {
                                setSessionIntensity(level);
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

        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className={`flex-1 overflow-hidden ${sidebarOpen ? 'w-0' : 'w-full'}`}>
            <DragDropContext onDragEnd={handleDragEnd}>
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4">
                  <Droppable droppableId="sections" type="SECTION">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                        {workoutSections.map((section, index) => (
                          <Draggable key={section.id} draggableId={section.id} index={index}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.draggableProps}>
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
                                  onLinkSuperset={handleLinkSuperset}
                                  onDuplicateExercise={handleDuplicateExercise}
                                  onDeleteExercise={handleDeleteExercise}
                                  onAddExercise={() => handleAddExercise(section.id)}
                                  getSupersetLabel={getSupersetLabel}
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
                </div>
              </ScrollArea>
            </DragDropContext>
          </div>

          {/* Sidebar */}
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
    </Dialog>
  );
}
