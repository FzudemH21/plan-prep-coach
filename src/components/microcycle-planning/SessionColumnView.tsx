import React, { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GripVertical, MoreVertical, Trash2, Plus, Link2, Edit2, Pencil } from 'lucide-react';
import { TrainingDay } from '@/types/daily-intensity';
import { format, parseISO } from 'date-fns';
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

interface SessionSection {
  id: string;
  dayDate: string;
  sessionIndex: number;
  name: string;
  order: number;
}

interface SessionColumnViewProps {
  day: TrainingDay;
  sessionIndex: number;
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  supersets: Record<string, string[]>;
  onDeleteExercise: (exerciseId: string) => void;
  onAddSection: () => void;
  onRenameSection: (sectionId: string, newName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleSuperset: (dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string) => void;
}

const intensityColors: Record<string, string> = {
  'off': 'bg-gray-200 text-gray-800',
  'deload': 'bg-green-200 text-green-800',
  'easy': 'bg-blue-200 text-blue-800',
  'easy-moderate': 'bg-cyan-200 text-cyan-800',
  'moderate': 'bg-yellow-200 text-yellow-800',
  'moderate-hard': 'bg-orange-200 text-orange-800',
  'hard': 'bg-red-200 text-red-800',
  'extremely-hard': 'bg-purple-200 text-purple-800',
};

export function SessionColumnView({
  day,
  sessionIndex,
  exercises,
  sections,
  supersets,
  onDeleteExercise,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onToggleSuperset,
}: SessionColumnViewProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);

  const getSuperset = (exerciseId: string): string | undefined => {
    return Object.entries(supersets).find(([_, ids]) => ids.includes(exerciseId))?.[0];
  };

  const getSupersetLabel = (supersetId: string): string => {
    const match = supersetId.match(/superset-(\d+)/);
    return match ? `SS${match[1]}` : 'SS';
  };

  const handleStartRenameSection = (section: SessionSection) => {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  };

  const handleSaveRenameSection = () => {
    if (editingSectionId && editingSectionName.trim()) {
      onRenameSection(editingSectionId, editingSectionName.trim());
    }
    setEditingSectionId(null);
    setEditingSectionName('');
  };

  const handleDeleteExerciseClick = (exerciseId: string) => {
    setExerciseToDelete(exerciseId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteExercise = () => {
    if (exerciseToDelete) {
      onDeleteExercise(exerciseToDelete);
    }
    setDeleteDialogOpen(false);
    setExerciseToDelete(null);
  };

  const dateObj = parseISO(day.date);
  const dayName = format(dateObj, 'EEEE');
  const dateStr = format(dateObj, 'MMM d');
  const sessionName = day.sessionNames?.[sessionIndex] || `Session ${sessionIndex + 1}`;
  const intensityClass = intensityColors[day.intensity] || 'bg-gray-200';

  return (
    <>
      <Card className="w-80 flex-shrink-0 flex flex-col h-[600px]">
        <CardHeader className="pb-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{dayName}</div>
            <Badge variant="outline" className={cn('text-xs', intensityClass)}>
              {day.intensity}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{dateStr}</div>
          <div className="text-xs font-medium">{sessionName}</div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-3 pt-0">
          <Droppable droppableId={`session-${day.date}::${sessionIndex}`} type="EXERCISE">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "h-full rounded-md border-2 border-dashed p-2 overflow-auto",
                  snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-muted"
                )}
              >
                <div className="space-y-2 min-h-full">
                  {exercises.length === 0 && (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                      Drag exercises here
                    </div>
                  )}

                  {exercises.map((exercise, index) => {
                    const supersetId = getSuperset(exercise.id);
                    const nextExercise = exercises[index + 1];
                    const nextSupersetId = nextExercise ? getSuperset(nextExercise.id) : undefined;
                    const hasLinkToNext = supersetId && supersetId === nextSupersetId;

                    return (
                      <Draggable key={exercise.id} draggableId={exercise.id} index={index}>
                        {(provided, snapshot) => (
                          <div>
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "group relative",
                                supersetId && "border-l-4 border-primary pl-2 bg-primary/5"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex items-start gap-2 p-2 rounded-md border bg-card text-xs",
                                  snapshot.isDragging && "opacity-50 shadow-lg"
                                )}
                              >
                                <div {...provided.dragHandleProps} className="pt-1">
                                  <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{exercise.exerciseName}</div>
                                  <div className="text-muted-foreground truncate text-[10px]">
                                    {exercise.methodId}
                                  </div>
                                  {supersetId && (
                                    <Badge variant="secondary" className="text-[10px] mt-1 px-1">
                                      {getSupersetLabel(supersetId)}
                                    </Badge>
                                  )}
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteExerciseClick(exercise.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-3 w-3" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Superset link button */}
                            {nextExercise && (
                              <div className="flex justify-center -my-1 relative z-10">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 rounded-full hover:bg-primary/10"
                                  onClick={() => onToggleSuperset(day.date, sessionIndex, exercise.id, nextExercise.id)}
                                >
                                  <Link2
                                    className={cn(
                                      "h-3 w-3",
                                      hasLinkToNext ? "text-primary fill-primary" : "text-muted-foreground"
                                    )}
                                  />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}

                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>

          <div className="mt-2 space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={onAddSection}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Section
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this exercise from the session?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteExercise}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
