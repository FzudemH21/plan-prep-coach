import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Link2, GripVertical } from 'lucide-react';
import { WorkoutSection } from '@/types/workout';
import { Droppable, Draggable } from '@hello-pangea/dnd';

interface WorkoutArrangementSidebarProps {
  sections: WorkoutSection[];
  collapsedSections: Record<string, boolean>;
  onToggleSectionCollapse: (sectionId: string) => void;
  onScrollToExercise: (exerciseId: string) => void;
  getSupersetLabel: (exerciseId: string) => string | undefined;
}

export function WorkoutArrangementSidebar({
  sections,
  collapsedSections,
  onToggleSectionCollapse,
  onScrollToExercise,
  getSupersetLabel
}: WorkoutArrangementSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-muted/30 border-l">
      <div className="p-4 border-b bg-background">
        <h3 className="font-semibold">Workout Arrangement</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Quick navigation and organization
        </p>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {sections.map((section, index) => {
                const isCollapsed = collapsedSections[section.id];
                return (
                  <div key={section.id} className="space-y-1">
                    {/* Section Header */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSectionCollapse(section.id)}
                      className="w-full justify-start h-8 px-2"
                    >
                      {isCollapsed ? <ChevronRight className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                      <span className="text-xs font-medium truncate">{section.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {section.exercises.length}
                      </Badge>
                    </Button>

                    {/* Exercise List */}
                    {!isCollapsed && (
                      <Droppable droppableId={section.id} type="EXERCISE">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`pl-4 space-y-1 ${snapshot.isDraggingOver ? 'bg-accent/30 rounded-md' : ''}`}
                          >
                            {section.exercises.map((exercise, exerciseIndex) => {
                              const supersetLabel = getSupersetLabel(exercise.id);
                              return (
                                <Draggable
                                  key={exercise.id}
                                  draggableId={exercise.id}
                                  index={exerciseIndex}
                                >
                                  {(provided, snapshot) => (
                                    <Button
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onScrollToExercise(exercise.id)}
                                      className={`w-full justify-start h-7 px-2 text-xs hover:bg-accent ${
                                        snapshot.isDragging ? 'opacity-50 shadow-lg' : ''
                                      }`}
                                    >
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing flex items-center">
                                        <GripVertical className="h-3 w-3 mr-1 text-muted-foreground" />
                                      </div>
                                      <span className="truncate flex-1 text-left">
                                        {exercise.exerciseName}
                                      </span>
                                      {supersetLabel && (
                                        <Badge variant="outline" className="ml-1 h-4 px-1 text-xs">
                                          <Link2 className="h-2 w-2 mr-0.5" />
                                          {supersetLabel}
                                        </Badge>
                                      )}
                                    </Button>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                );
              })}
        </div>
      </ScrollArea>
    </div>
  );
}
