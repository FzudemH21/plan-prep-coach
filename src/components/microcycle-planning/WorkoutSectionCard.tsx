import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, GripVertical } from 'lucide-react';
import { WorkoutSection, WorkoutExercise } from '@/types/workout';
import { WorkoutExerciseCard } from './WorkoutExerciseCard';
import { Droppable, Draggable } from '@hello-pangea/dnd';

interface WorkoutSectionCardProps {
  section: WorkoutSection;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onParameterChange: (exerciseId: string, paramName: string, value: string | number) => void;
  onUnitChange: (exerciseId: string, paramName: string, unit: string) => void;
  onLinkSuperset: (exerciseId: string) => void;
  onDuplicateExercise: (exerciseId: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onAddExercise: () => void;
  getSupersetLabel: (exerciseId: string) => string | undefined;
  sectionDragHandleProps?: any;
}

export function WorkoutSectionCard({
  section,
  isCollapsed,
  onToggleCollapse,
  onParameterChange,
  onUnitChange,
  onLinkSuperset,
  onDuplicateExercise,
  onDeleteExercise,
  onAddExercise,
  getSupersetLabel,
  sectionDragHandleProps
}: WorkoutSectionCardProps) {
  return (
    <div className="border rounded-lg bg-card">
      {/* Section Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
        <div {...sectionDragHandleProps} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-6 w-6 p-0"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <h3 className="font-semibold text-sm flex-1">{section.name}</h3>
        <span className="text-xs text-muted-foreground">
          {section.exercises.length} {section.exercises.length === 1 ? 'exercise' : 'exercises'}
        </span>
      </div>

      {/* Section Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-3">
          <Droppable droppableId={section.id} type="EXERCISE">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`space-y-3 min-h-[60px] rounded-md transition-colors ${
                  snapshot.isDraggingOver ? 'bg-accent/50' : ''
                }`}
              >
                {section.exercises.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No exercises yet. Add one to get started.
                  </div>
                )}
                {section.exercises.map((exercise, index) => (
                  <Draggable
                    key={exercise.id}
                    draggableId={exercise.id}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={snapshot.isDragging ? 'opacity-50' : ''}
                      >
                        <WorkoutExerciseCard
                          exercise={exercise}
                          isInSuperset={!!exercise.supersetId}
                          supersetLabel={getSupersetLabel(exercise.id)}
                          onParameterChange={(paramName, value) =>
                            onParameterChange(exercise.id, paramName, value)
                          }
                          onUnitChange={(paramName, unit) =>
                            onUnitChange(exercise.id, paramName, unit)
                          }
                          onLinkSuperset={() => onLinkSuperset(exercise.id)}
                          onDuplicate={() => onDuplicateExercise(exercise.id)}
                          onDelete={() => onDeleteExercise(exercise.id)}
                          dragHandleProps={provided.dragHandleProps}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Add Exercise Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onAddExercise}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </div>
      )}
    </div>
  );
}
