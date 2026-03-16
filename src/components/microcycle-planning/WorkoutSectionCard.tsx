import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, GripVertical, MoreVertical, Pencil, Trash2, Link2, Copy, MessageSquare } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WorkoutSection, WorkoutExercise } from '@/types/workout';
import { WorkoutExerciseCard } from './WorkoutExerciseCard';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { ToolboxEntry } from '@/types/toolbox';
import { useWorkoutSession } from './WorkoutSessionContext';

interface WorkoutSectionCardProps {
  // Section-specific data (different per instance)
  section: WorkoutSection;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onAddExercise: () => void;
  onRenameSection: (newName: string) => void;
  onDeleteSection: () => void;
  onDuplicateSection: () => void;
  sectionDragHandleProps?: any;
}

export function WorkoutSectionCard({
  section,
  isCollapsed,
  onToggleCollapse,
  onAddExercise,
  onRenameSection,
  onDeleteSection,
  onDuplicateSection,
  sectionDragHandleProps,
}: WorkoutSectionCardProps) {
  // Pull shared callbacks from context instead of individual props
  const {
    onParameterChange,
    onUnitChange,
    onToggleSuperset,
    onDuplicateExercise,
    onDeleteExercise,
    getSupersetLabel,
    onExerciseNotesChange,
    onExerciseEachSideChange,
    onSectionCommentsChange,
    toolboxData,
    visibilityOverrides,
    onVisibilityChange,
    onShowAllParams,
    onResetParamsToDefaults,
    onAutoCalculateWeightChange,
    onAutoCalculateTargetHRChange,
    onOpenExerciseDetail,
    onChangeExercise,
    onOpenChangeLibrary,
  } = useWorkoutSession();

  // Helper to get toolbox params for an exercise based on method
  const getToolboxParamsForExercise = (exercise: WorkoutExercise): ToolboxEntry[] => {
    if (!toolboxData?.entries) return [];

    const methodId = exercise.methodId; // e.g., "Lower Body Resistance Training - Strength"

    return toolboxData.entries.filter(entry => {
      // Build the full method identifier from toolbox entry
      const toolboxMethodId = entry.subCategory
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;

      // Match parameters by method only - exercise categories don't affect parameter visibility
      return toolboxMethodId === methodId;
    });
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(section.name);
  // Track collapsed exercises
  const [collapsedExercises, setCollapsedExercises] = useState<Record<string, boolean>>({});

  const toggleExerciseCollapse = (exerciseId: string) => {
    setCollapsedExercises(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };

  const handleSaveRename = () => {
    if (editedName.trim() && editedName !== section.name) {
      onRenameSection(editedName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditedName(section.name);
    setIsEditing(false);
  };

  const areExercisesLinked = (exerciseId1: string, exerciseId2: string): boolean => {
    const label1 = getSupersetLabel(exerciseId1);
    const label2 = getSupersetLabel(exerciseId2);
    return !!(label1 && label2 && label1 === label2);
  };

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

        {/* Editable Section Name with Pencil Icon */}
        {isEditing ? (
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename();
              if (e.key === 'Escape') handleCancelRename();
            }}
            autoFocus
            className="h-7 text-sm font-semibold flex-1"
          />
        ) : (
          <div className="flex items-center gap-1 flex-1">
            <h3
              className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditing(true)}
            >
              {section.name}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-transparent"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        )}

        <span className="text-xs text-muted-foreground">
          {section.exercises.length} {section.exercises.length === 1 ? 'exercise' : 'exercises'}
        </span>

        {/* Section Delete Menu */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              aria-label="Open section actions"
              onPointerDown={(e) => { e.stopPropagation(); }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[60] bg-popover">
            <DropdownMenuItem onClick={onDuplicateSection}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate Section
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDeleteSection}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Section Content */}
      <div className="p-3 space-y-3">
        {/* Section Notes from Step 1 */}
        {!isCollapsed && (section.comments || onSectionCommentsChange) && (
          <div className="pb-2 border-b">
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Section Notes
            </label>
            <Textarea
              value={section.comments || ''}
              onChange={(e) => onSectionCommentsChange?.(section.id, e.target.value)}
              placeholder="Add notes for this section..."
              className="min-h-[50px] text-xs resize-none"
            />
          </div>
        )}
        <Droppable droppableId={`main-exercises-${section.id}`} type="EXERCISE">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-3 rounded-md transition-colors ${
                snapshot.isDraggingOver ? 'bg-accent/50' : ''
              }`}
            >
              {isCollapsed ? (
                <div className="h-2 rounded-md hover:bg-accent/40 transition-colors" />
              ) : (
                <>
                  {section.exercises.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No exercises yet. Add one to get started.
                    </div>
                  )}
                  {(() => {
                    // Group exercises by superset
                    const exerciseGroups: Array<{ exercises: typeof section.exercises; supersetLabel?: string }> = [];
                    const processed = new Set<string>();

                    section.exercises.forEach((exercise) => {
                      if (processed.has(exercise.id)) return;

                      const supersetLabel = getSupersetLabel(exercise.id);
                      if (supersetLabel) {
                        // Find all exercises with the same superset label
                        const supersetExercises = section.exercises.filter(ex =>
                          getSupersetLabel(ex.id) === supersetLabel
                        );
                        exerciseGroups.push({
                          exercises: supersetExercises,
                          supersetLabel
                        });
                        supersetExercises.forEach(ex => processed.add(ex.id));
                      } else {
                        exerciseGroups.push({
                          exercises: [exercise]
                        });
                        processed.add(exercise.id);
                      }
                    });

                    return exerciseGroups.map((group, groupIndex) => {
                      if (group.supersetLabel) {
                        // Superset group - render with visual pairing
                        return (
                          <React.Fragment key={`group-${groupIndex}`}>
                            <div className="border-l-4 border-primary/40 pl-3 pr-1 py-2 rounded-md bg-primary/5 space-y-2">
                              {group.exercises.map((exercise, exIndex) => {
                                const exerciseIndex = section.exercises.indexOf(exercise);
                                return (
                                  <React.Fragment key={exercise.id}>
                                    <Draggable draggableId={exercise.id} index={exerciseIndex}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          style={provided.draggableProps.style}
                                          className={snapshot.isDragging ? 'opacity-50' : ''}
                                        >
                                        <WorkoutExerciseCard
                                            exercise={exercise}
                                            isInSuperset={!!getSupersetLabel(exercise.id)}
                                            supersetLabel={getSupersetLabel(exercise.id)}
                                            onParameterChange={(paramName, value) => onParameterChange(exercise.id, paramName, value)}
                                            onUnitChange={(paramName, unit) => onUnitChange(exercise.id, paramName, unit)}
                                            onDuplicate={() => onDuplicateExercise(exercise.id)}
                                            onDelete={() => onDeleteExercise(exercise.id)}
                                            dragHandleProps={provided.dragHandleProps}
                                            notes={exercise.notes}
                                            onNotesChange={(notes) => onExerciseNotesChange?.(exercise.id, notes)}
                                            eachSide={exercise.eachSide}
                                            onEachSideChange={(value) => onExerciseEachSideChange?.(exercise.id, value)}
                                            toolboxParams={getToolboxParamsForExercise(exercise)}
                                            visibilityOverrides={visibilityOverrides}
                                            onVisibilityChange={onVisibilityChange}
                                            onShowAllParams={onShowAllParams}
                                            onResetParamsToDefaults={onResetParamsToDefaults}
                                            autoCalculateWeight={exercise.autoCalculateWeight}
                                            onAutoCalculateWeightChange={(value) => onAutoCalculateWeightChange?.(exercise.id, value)}
                                            autoCalculateTargetHR={exercise.autoCalculateTargetHR}
                                            onAutoCalculateTargetHRChange={(value) => onAutoCalculateTargetHRChange?.(exercise.id, value)}
                                            isCollapsed={collapsedExercises[exercise.id] || false}
                                            onToggleCollapse={() => toggleExerciseCollapse(exercise.id)}
                                            onOpenDetail={() => onOpenExerciseDetail?.(exercise)}
                                            onChangeExercise={onChangeExercise ? (newEx) => onChangeExercise(exercise.id, newEx) : undefined}
                                            onOpenChangeLibrary={onOpenChangeLibrary ? () => onOpenChangeLibrary(exercise.id) : undefined}
                                          />
                                        </div>
                                      )}
                                    </Draggable>

                                    {/* Chain icon between superset exercises */}
                                    {exIndex < group.exercises.length - 1 && (
                                      <div className="flex justify-center -my-1 relative z-10">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 rounded-full bg-primary/20 text-primary hover:bg-primary/30"
                                          onClick={() => onToggleSuperset(exercise.id, group.exercises[exIndex + 1].id, section.id)}
                                        >
                                          <Link2 className="h-3 w-3 fill-current" />
                                        </Button>
                                      </div>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                            {(() => {
                              const lastInGroup = group.exercises[group.exercises.length - 1];
                              const lastIndex = section.exercises.indexOf(lastInGroup);
                              const nextExercise = section.exercises[lastIndex + 1];
                              return nextExercise ? (
                                <div className="flex justify-center -my-2 relative z-10">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
                                    onClick={() => onToggleSuperset(lastInGroup.id, nextExercise.id, section.id)}
                                  >
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : null;
                            })()}
                          </React.Fragment>
                        );
                      } else {
                        // Single exercise
                        const exercise = group.exercises[0];
                        const exerciseIndex = section.exercises.indexOf(exercise);
                        const nextExercise = section.exercises[exerciseIndex + 1];

                        return (
                          <React.Fragment key={exercise.id}>
                            <Draggable draggableId={exercise.id} index={exerciseIndex}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={provided.draggableProps.style}
                                  className={snapshot.isDragging ? 'opacity-50' : ''}
                                >
                                  <WorkoutExerciseCard
                                    exercise={exercise}
                                    isInSuperset={!!getSupersetLabel(exercise.id)}
                                    supersetLabel={getSupersetLabel(exercise.id)}
                                    onParameterChange={(paramName, value) => onParameterChange(exercise.id, paramName, value)}
                                    onUnitChange={(paramName, unit) => onUnitChange(exercise.id, paramName, unit)}
                                    onDuplicate={() => onDuplicateExercise(exercise.id)}
                                    onDelete={() => onDeleteExercise(exercise.id)}
                                    dragHandleProps={provided.dragHandleProps}
                                    notes={exercise.notes}
                                    onNotesChange={(notes) => onExerciseNotesChange?.(exercise.id, notes)}
                                    eachSide={exercise.eachSide}
                                    onEachSideChange={(value) => onExerciseEachSideChange?.(exercise.id, value)}
                                    toolboxParams={getToolboxParamsForExercise(exercise)}
                                    visibilityOverrides={visibilityOverrides}
                                    onVisibilityChange={onVisibilityChange}
                                    onShowAllParams={onShowAllParams}
                                    onResetParamsToDefaults={onResetParamsToDefaults}
                                    autoCalculateWeight={exercise.autoCalculateWeight}
                                    onAutoCalculateWeightChange={(value) => onAutoCalculateWeightChange?.(exercise.id, value)}
                                    autoCalculateTargetHR={exercise.autoCalculateTargetHR}
                                    onAutoCalculateTargetHRChange={(value) => onAutoCalculateTargetHRChange?.(exercise.id, value)}
                                    isCollapsed={collapsedExercises[exercise.id] || false}
                                    onToggleCollapse={() => toggleExerciseCollapse(exercise.id)}
                                    onOpenDetail={() => onOpenExerciseDetail?.(exercise)}
                                    onChangeExercise={onChangeExercise ? (newEx) => onChangeExercise(exercise.id, newEx) : undefined}
                                    onOpenChangeLibrary={onOpenChangeLibrary ? () => onOpenChangeLibrary(exercise.id) : undefined}
                                  />
                                </div>
                              )}
                            </Draggable>

                            {/* Chain icon between non-superset exercises */}
                            {nextExercise && (
                              <div className="flex justify-center -my-2 relative z-10">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
                                  onClick={() => onToggleSuperset(exercise.id, nextExercise.id, section.id)}
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      }
                    });
                  })()}
                </>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Add Exercise Button */}
        {!isCollapsed && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddExercise}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        )}
      </div>
    </div>
  );
}
