import React, { useState, useMemo, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, GripVertical, Search } from 'lucide-react';
import { ExtendedMesocycle } from '@/features/planner/types';
import { cn } from '@/lib/utils';
import { ExerciseDistribution } from '@/types/microcycle-planning';

interface ExerciseLibraryPanelProps {
  exercisesByMethod: Record<string, Record<string, Array<{
    exerciseId: string;
    exerciseName: string;
    subCategory?: string;
  }>>>;
  exerciseDistribution: ExerciseDistribution[];
  mesocycle: ExtendedMesocycle;
  /** methodName → exerciseCategory[] from the toolbox — methods absent here are not split */
  methodExerciseCategories?: Record<string, string[]>;
  /** Dates belonging to the currently viewed microcycle — count badge is scoped to these */
  currentMicrocycleDates?: string[];
}

// Helper to detect invalid/corrupted category names
const isInvalidCategory = (cat: string): boolean => {
  if (!cat || cat === '') return true;
  if (cat.length <= 2) return true;
  if (/^(meso|micro|main|undefined|null)\d*$/i.test(cat)) return true;
  return false;
};

export function ExerciseLibraryPanel({
  exercisesByMethod,
  exerciseDistribution,
  mesocycle,
  methodExerciseCategories,
  currentMicrocycleDates,
}: ExerciseLibraryPanelProps) {
  const [expandedTopCategories, setExpandedTopCategories] = useState<Set<string>>(new Set());
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggle = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setFn(next);
  };

  // Count how many times an exercise is placed in the currently viewed microcycle
  const getExerciseAllocationCount = (exerciseId: string) => {
    const dist = currentMicrocycleDates && currentMicrocycleDates.length > 0
      ? exerciseDistribution.filter(ex => currentMicrocycleDates.includes(ex.dayDate))
      : exerciseDistribution;
    return dist.filter(ex => ex.exerciseId === exerciseId).length;
  };

  // Apply search + allocated-only filters
  const filteredExercises = useMemo(() => {
    let filtered = { ...exercisesByMethod };

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = Object.entries(filtered).reduce((acc, [methodId, categories]) => {
        const filteredCategories = Object.entries(categories).reduce((catAcc, [catName, exercises]) => {
          const filteredExs = exercises.filter(ex =>
            ex.exerciseName.toLowerCase().includes(query) ||
            methodId.toLowerCase().includes(query) ||
            catName.toLowerCase().includes(query)
          );
          if (filteredExs.length > 0) catAcc[catName] = filteredExs;
          return catAcc;
        }, {} as Record<string, any[]>);
        if (Object.keys(filteredCategories).length > 0) acc[methodId] = filteredCategories;
        return acc;
      }, {} as typeof filtered);
    }

    return filtered;
  }, [exercisesByMethod, searchQuery]);

  // Group methods by top-level category (part before " - ")
  const groupedByTopCategory = useMemo(() => {
    const grouped: Record<string, Array<{
      methodId: string;
      subCategory: string;
      categories: Record<string, Array<{ exerciseId: string; exerciseName: string; subCategory?: string }>>;
    }>> = {};

    Object.entries(filteredExercises).forEach(([methodId, categories]) => {
      const dashIdx = methodId.indexOf(' - ');
      const topCategory = dashIdx > -1 ? methodId.slice(0, dashIdx) : 'General';
      const subCategory = dashIdx > -1 ? methodId.slice(dashIdx + 3) : methodId;
      if (!grouped[topCategory]) grouped[topCategory] = [];
      grouped[topCategory].push({ methodId, subCategory, categories });
    });

    return grouped;
  }, [filteredExercises]);

  // Auto-expand all top categories and methods when exercises load
  useEffect(() => {
    const topCats = new Set(Object.keys(groupedByTopCategory));
    setExpandedTopCategories(topCats);
    const methods = new Set(
      Object.values(groupedByTopCategory).flatMap(ms => ms.map(m => m.methodId))
    );
    setExpandedMethods(methods);
  }, [groupedByTopCategory]);

  const renderExercise = (
    exercise: { exerciseId: string; exerciseName: string },
    index: number
  ) => {
    const count = getExerciseAllocationCount(exercise.exerciseId);
    return (
      <Draggable key={exercise.exerciseId} draggableId={`lib-${exercise.exerciseId}`} index={index}>
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
            {count > 0 && (
              <span className="flex items-center gap-0.5 ml-1 flex-shrink-0">
                {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "inline-block rounded-full w-1.5 h-1.5",
                      count === 1 && "bg-emerald-500",
                      count === 2 && "bg-yellow-400",
                      count === 3 && "bg-orange-400",
                      count >= 4 && "bg-red-500"
                    )}
                  />
                ))}
              </span>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-lg">Methods & Exercises</CardTitle>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4">
          <div className="space-y-1 pb-4">

            {/* Level 1: Top category */}
            {Object.entries(groupedByTopCategory).map(([topCategory, methods]) => {
              const isTopOpen = expandedTopCategories.has(topCategory);
              return (
                <Collapsible
                  key={topCategory}
                  open={isTopOpen}
                  onOpenChange={() => toggle(expandedTopCategories, setExpandedTopCategories, topCategory)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm font-semibold hover:bg-muted px-2"
                    >
                      {isTopOpen
                        ? <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
                        : <ChevronRight className="mr-2 h-4 w-4 shrink-0" />}
                      <span className="truncate">{topCategory}</span>
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="ml-3 space-y-0.5">

                    {/* Level 2: Sub-category (method) */}
                    {methods.map(({ methodId, subCategory, categories }) => {
                      const isMethodOpen = expandedMethods.has(methodId);
                      const categoryEntries = Object.entries(categories);
                      // A method is only shown with category sub-groups when the toolbox
                      // explicitly defines exercise categories for it. Methods absent from
                      // methodExerciseCategories (or with an empty list) are not split —
                      // show their exercises flat regardless of any categoryName on the data.
                      const methodIsSplit = (methodExerciseCategories?.[methodId]?.length ?? 0) > 0;
                      const hasNoRealCategories =
                        !methodIsSplit ||
                        (categoryEntries.length === 1 && isInvalidCategory(categoryEntries[0][0]));

                      return (
                        <Collapsible
                          key={methodId}
                          open={isMethodOpen}
                          onOpenChange={() => toggle(expandedMethods, setExpandedMethods, methodId)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs font-medium hover:bg-muted/60 px-2"
                            >
                              {isMethodOpen
                                ? <ChevronDown className="mr-2 h-3 w-3 shrink-0" />
                                : <ChevronRight className="mr-2 h-3 w-3 shrink-0" />}
                              <span className="truncate">{subCategory}</span>
                            </Button>
                          </CollapsibleTrigger>

                          <CollapsibleContent className="ml-3 space-y-0.5">
                            {hasNoRealCategories ? (
                              // No real exercise categories — show all exercises flat
                              <Droppable
                                droppableId={`library-${methodId}::`}
                                type="EXERCISE"
                                isDropDisabled={true}
                              >
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="space-y-1 mt-1"
                                  >
                                    {categoryEntries.flatMap(([, exs]) => exs).map((ex, idx) => renderExercise(ex, idx))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            ) : (
                              // Level 3: Exercise categories
                              categoryEntries.map(([categoryName, exercises]) => {
                                const categoryKey = `${methodId}::${categoryName}`;
                                const isCatOpen = expandedCategories.has(categoryKey);
                                return (
                                  <Collapsible
                                    key={categoryKey}
                                    open={isCatOpen}
                                    onOpenChange={() => toggle(expandedCategories, setExpandedCategories, categoryKey)}
                                  >
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-xs hover:bg-muted/40 px-2"
                                      >
                                        {isCatOpen
                                          ? <ChevronDown className="mr-2 h-3 w-3 shrink-0" />
                                          : <ChevronRight className="mr-2 h-3 w-3 shrink-0" />}
                                        <span className="truncate">{categoryName}</span>
                                      </Button>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent className="ml-3 mt-1">
                                      {/* Level 4: Exercises (draggable) */}
                                      <Droppable
                                        droppableId={`library-${methodId}::${categoryName}`}
                                        type="EXERCISE"
                                        isDropDisabled={true}
                                      >
                                        {(provided) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className="space-y-1"
                                          >
                                            {exercises.map((ex, idx) => renderExercise(ex, idx))}
                                            {provided.placeholder}
                                          </div>
                                        )}
                                      </Droppable>
                                    </CollapsibleContent>
                                  </Collapsible>
                                );
                              })
                            )}
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
