import React, { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Save, PanelRightClose, PanelRight } from 'lucide-react';
import { WorkoutSection, WorkoutExercise, WorkoutSession, SupersetMapping } from '@/types/workout';
import { WorkoutSectionCard } from './WorkoutSectionCard';
import { WorkoutArrangementSidebar } from './WorkoutArrangementSidebar';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { getParametersForMethod } from '@/data/methodParameters';

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
  onSaveParameters
}: WorkoutSessionSheetProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [sidebarCollapsedSections, setSidebarCollapsedSections] = useState<Record<string, boolean>>({});
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
    onClose();
  };

  const handleAddExercise = (sectionId: string) => {
    // TODO: Open exercise library dialog
    console.log('Add exercise to section:', sectionId);
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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-full p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Workout Session</SheetTitle>
              <SheetDescription>
                {format(new Date(dayDate), 'EEEE, MMMM d, yyyy')} • Session {sessionIndex + 1}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
}
