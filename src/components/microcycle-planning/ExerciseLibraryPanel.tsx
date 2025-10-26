import React, { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { ExtendedMesocycle } from '@/features/planner/types';
import { cn } from '@/lib/utils';

interface ExerciseDistribution {
  id: string;
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
  order: number;
  sectionId?: string;
  supersetId?: string;
}

interface ExerciseLibraryPanelProps {
  exercisesByMethod: Record<string, Record<string, Array<{
    exerciseId: string;
    exerciseName: string;
    subCategory?: string;
  }>>>;
  exerciseDistribution: ExerciseDistribution[];
  mesocycle: ExtendedMesocycle;
}

export function ExerciseLibraryPanel({
  exercisesByMethod,
  exerciseDistribution,
  mesocycle,
}: ExerciseLibraryPanelProps) {
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleMethod = (methodId: string) => {
    const newExpanded = new Set(expandedMethods);
    if (newExpanded.has(methodId)) {
      newExpanded.delete(methodId);
    } else {
      newExpanded.add(methodId);
    }
    setExpandedMethods(newExpanded);
  };

  const toggleCategory = (key: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCategories(newExpanded);
  };

  const getExerciseAllocationCount = (exerciseId: string) => {
    return exerciseDistribution.filter(ex => ex.exerciseId === exerciseId).length;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Methods & Exercises</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4">
          <div className="space-y-2 pb-4">
            {Object.entries(exercisesByMethod).map(([methodId, categories]) => {
              const isMethodExpanded = expandedMethods.has(methodId);
              
              return (
                <Collapsible
                  key={methodId}
                  open={isMethodExpanded}
                  onOpenChange={() => toggleMethod(methodId)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm font-semibold hover:bg-muted"
                    >
                      {isMethodExpanded ? (
                        <ChevronDown className="mr-2 h-4 w-4" />
                      ) : (
                        <ChevronRight className="mr-2 h-4 w-4" />
                      )}
                      <span className="truncate">{methodId}</span>
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="ml-4 space-y-1">
                    {Object.entries(categories).map(([categoryName, exercises]) => {
                      const categoryKey = `${methodId}::${categoryName}`;
                      const isCategoryExpanded = expandedCategories.has(categoryKey);
                      
                      return (
                        <Collapsible
                          key={categoryKey}
                          open={isCategoryExpanded}
                          onOpenChange={() => toggleCategory(categoryKey)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs hover:bg-muted/50"
                            >
                              {isCategoryExpanded ? (
                                <ChevronDown className="mr-2 h-3 w-3" />
                              ) : (
                                <ChevronRight className="mr-2 h-3 w-3" />
                              )}
                              <span className="truncate">{categoryName}</span>
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {exercises.length}
                              </Badge>
                            </Button>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent className="ml-4 mt-1">
                            <Droppable
                              droppableId={`library-${methodId}::${categoryName}`}
                              type="EXERCISE"
                              isDropDisabled={true}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className="space-y-1"
                                >
                                  {exercises.map((exercise, index) => {
                                    const allocationCount = getExerciseAllocationCount(exercise.exerciseId);
                                    
                                    return (
                                      <Draggable
                                        key={exercise.exerciseId}
                                        draggableId={`lib-${exercise.exerciseId}`}
                                        index={index}
                                      >
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn(
                                              "flex items-center gap-2 p-2 rounded-md border bg-card text-xs",
                                              "hover:bg-accent hover:text-accent-foreground cursor-grab active:cursor-grabbing",
                                              snapshot.isDragging && "opacity-50 shadow-lg"
                                            )}
                                          >
                                            <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                            <span className="flex-1 truncate">{exercise.exerciseName}</span>
                                            {allocationCount > 0 && (
                                              <Badge variant="outline" className="text-xs px-1">
                                                {allocationCount}
                                              </Badge>
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
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
