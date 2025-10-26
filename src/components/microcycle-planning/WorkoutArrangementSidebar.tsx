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
        
          <Droppable droppableId="sidebar-sections" type="SIDEBAR_SECTION">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {sections.map((section, index) => {
                  const isCollapsed = collapsedSections[section.id];
                  return (
                    <Draggable key={section.id} draggableId={`sidebar-section-${section.id}`} index={index}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} className="space-y-1">
                          {/* Section Header */}
                          <div className="flex items-center gap-1">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onToggleSectionCollapse(section.id)}
                              className="flex-1 justify-start h-8 px-2"
                            >
                              {isCollapsed ? <ChevronRight className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                              <span className="text-xs font-medium truncate">{section.name}</span>
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {section.exercises.length}
                              </Badge>
                            </Button>
                          </div>

                          {/* Exercise List */}
                          {!isCollapsed && (
                            <Droppable droppableId={`sidebar-exercises-${section.id}`} type="SIDEBAR_EXERCISE">
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`pl-4 space-y-1 ${snapshot.isDraggingOver ? 'bg-accent/30 rounded-md' : ''}`}
                                >
                                  {(() => {
                                    // Group exercises by superset
                                    const exerciseGroups: Array<{
                                      exercises: typeof section.exercises;
                                      supersetLabel?: string;
                                    }> = [];
                                    const processed = new Set<string>();
                                    
                                    section.exercises.forEach(exercise => {
                                      if (processed.has(exercise.id)) return;
                                      
                                      const supersetLabel = getSupersetLabel(exercise.id);
                                      if (supersetLabel) {
                                        // Find all exercises in this superset
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
                                        // Superset group with visual connection
                                        return (
                                          <div key={`superset-${groupIndex}`} className="border-l-2 border-primary/50 pl-2 space-y-1 mb-2">
                                            {group.exercises.map((exercise, exIndex) => {
                                              const exerciseIndex = section.exercises.indexOf(exercise);
                                              return (
                                                <Draggable
                                                  key={exercise.id}
                                                  draggableId={`sidebar-ex-${exercise.id}`}
                                                  index={exerciseIndex}
                                                >
                                                  {(provided, snapshot) => (
                                                    <div
                                                      ref={provided.innerRef}
                                                      {...provided.draggableProps}
                                                      className={`flex items-center w-full h-7 px-2 rounded-md bg-primary/5 hover:bg-primary/10 ${
                                                        snapshot.isDragging ? 'opacity-50 shadow-lg' : ''
                                                      }`}
                                                    >
                                                      <div 
                                                        {...provided.dragHandleProps} 
                                                        className="cursor-grab active:cursor-grabbing flex items-center mr-1"
                                                      >
                                                        <GripVertical className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                      </div>
                                                      
                                                      <button
                                                        onClick={() => onScrollToExercise(exercise.id)}
                                                        className="flex-1 flex items-center justify-start gap-1 text-xs text-left truncate hover:text-primary transition-colors"
                                                      >
                                                        <span className="truncate">
                                                          {exercise.exerciseName}
                                                        </span>
                                                        {exIndex === 0 && (
                                                          <Badge variant="outline" className="ml-1 h-4 px-1 text-xs shrink-0">
                                                            <Link2 className="h-2 w-2 mr-0.5 fill-current" />
                                                            {group.supersetLabel}
                                                          </Badge>
                                                        )}
                                                      </button>
                                                    </div>
                                                  )}
                                                </Draggable>
                                              );
                                            })}
                                          </div>
                                        );
                                      } else {
                                        // Single exercise
                                        const exercise = group.exercises[0];
                                        const exerciseIndex = section.exercises.indexOf(exercise);
                                        return (
                                          <Draggable
                                            key={exercise.id}
                                            draggableId={`sidebar-ex-${exercise.id}`}
                                            index={exerciseIndex}
                                          >
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`flex items-center w-full h-7 px-2 rounded-md hover:bg-accent ${
                                                  snapshot.isDragging ? 'opacity-50 shadow-lg' : ''
                                                }`}
                                              >
                                                <div 
                                                  {...provided.dragHandleProps} 
                                                  className="cursor-grab active:cursor-grabbing flex items-center mr-1"
                                                >
                                                  <GripVertical className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                </div>
                                                
                                                <button
                                                  onClick={() => onScrollToExercise(exercise.id)}
                                                  className="flex-1 flex items-center justify-start gap-1 text-xs text-left truncate hover:text-primary transition-colors"
                                                >
                                                  <span className="truncate">
                                                    {exercise.exerciseName}
                                                  </span>
                                                </button>
                                              </div>
                                            )}
                                          </Draggable>
                                        );
                                      }
                                    });
                                  })()}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        
      </ScrollArea>
    </div>
  );
}
