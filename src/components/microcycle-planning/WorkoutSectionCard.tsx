import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, GripVertical, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
  onRenameSection: (newName: string) => void;
  onDeleteSection: () => void;
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
  onRenameSection,
  onDeleteSection,
  getSupersetLabel,
  sectionDragHandleProps
}: WorkoutSectionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(section.name);

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
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[60] bg-popover">
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
                  {section.exercises.map((exercise, index) => (
                    <Draggable key={exercise.id} draggableId={exercise.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={provided.draggableProps.style}
                          className={snapshot.isDragging ? 'opacity-50' : ''}
                        >
                          <WorkoutExerciseCard
                            exercise={exercise}
                            isInSuperset={!!exercise.supersetId}
                            supersetLabel={getSupersetLabel(exercise.id)}
                            onParameterChange={(paramName, value) => onParameterChange(exercise.id, paramName, value)}
                            onUnitChange={(paramName, unit) => onUnitChange(exercise.id, paramName, unit)}
                            onLinkSuperset={() => onLinkSuperset(exercise.id)}
                            onDuplicate={() => onDuplicateExercise(exercise.id)}
                            onDelete={() => onDeleteExercise(exercise.id)}
                            dragHandleProps={provided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
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
