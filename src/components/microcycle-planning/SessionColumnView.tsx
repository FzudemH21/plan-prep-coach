import React, { useState, useMemo } from 'react';
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
import { GripVertical, MoreVertical, Trash2, Plus, Link2, Edit2, Pencil, Check, X, ChevronUp } from 'lucide-react';
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
  totalSessionsOnDay: number;
  onDeleteExercise: (exerciseId: string) => void;
  onAddSection: () => void;
  onRenameSection: (sectionId: string, newName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleSuperset: (dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string) => void;
  onRemoveSession?: (dayDate: string, sessionIndex: number) => void;
  onRenameSession?: (dayDate: string, sessionIndex: number, newName: string) => void;
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
  totalSessionsOnDay,
  onDeleteExercise,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onToggleSuperset,
  onRemoveSession,
  onRenameSession,
}: SessionColumnViewProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);
  const [editingSessionNameValue, setEditingSessionNameValue] = useState('');

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

  const handleStartEditingSessionName = () => {
    setIsEditingSessionName(true);
    setEditingSessionNameValue(sessionName);
  };

  const handleSaveSessionName = () => {
    if (onRenameSession && editingSessionNameValue.trim()) {
      onRenameSession(day.date, sessionIndex, editingSessionNameValue.trim());
    }
    setIsEditingSessionName(false);
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

  // Group exercises by section
  const exercisesBySection = useMemo(() => {
    const unsectioned: ExerciseDistribution[] = [];
    const sectioned: Record<string, ExerciseDistribution[]> = {};
    
    // Initialize sectioned object with all sections
    sections.forEach(section => {
      sectioned[section.id] = [];
    });
    
    // Distribute exercises
    exercises.forEach(ex => {
      if (ex.sectionId && sectioned[ex.sectionId]) {
        sectioned[ex.sectionId].push(ex);
      } else {
        unsectioned.push(ex);
      }
    });
    
    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    
    return { unsectioned, sectioned, sortedSections };
  }, [exercises, sections]);

  // Safety check for undefined date
  if (!day || !day.date) {
    console.error('SessionColumnView: day or day.date is undefined', { day, sessionIndex });
    return null;
  }
  
  const dateObj = parseISO(day.date);
  const dayName = format(dateObj, 'EEEE');
  const dateStr = format(dateObj, 'MMM d');
  const sessionName = day.sessionNames?.[sessionIndex] || `Session ${sessionIndex + 1}`;
  const intensityClass = intensityColors[day.intensity] || 'bg-gray-200';

  // Superset color scheme for better visual grouping
  const getSupersetColor = (supersetId: string): string => {
    const label = getSupersetLabel(supersetId);
    const number = parseInt(label.replace('SS', ''));
    const colors = [
      'border-l-blue-400 bg-blue-50/50',
      'border-l-green-400 bg-green-50/50',
      'border-l-purple-400 bg-purple-50/50',
      'border-l-orange-400 bg-orange-50/50',
      'border-l-pink-400 bg-pink-50/50',
      'border-l-cyan-400 bg-cyan-50/50',
    ];
    return colors[(number - 1) % colors.length] || colors[0];
  };

  const renderExerciseCard = (exercise: ExerciseDistribution, index: number, allExercises: ExerciseDistribution[]) => {
    const supersetId = getSuperset(exercise.id);
    const nextExercise = allExercises[index + 1];
    const nextSupersetId = nextExercise ? getSuperset(nextExercise.id) : undefined;
    const hasLinkToNext = supersetId && supersetId === nextSupersetId;

    return (
      <Draggable key={exercise.id} draggableId={exercise.id} index={index}>
        {(provided, snapshot) => (
          <div>
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              className="group relative"
            >
              <div
                className={cn(
                  "flex items-start gap-2 p-2 rounded-md border-l-4 border-muted bg-card text-xs",
                  supersetId && getSupersetColor(supersetId),
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
                    <Badge variant="default" className="text-[10px] mt-1 px-1.5 font-semibold">
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
  };

  return (
    <>
      <Card className="w-80 flex-shrink-0 flex flex-col h-[600px]">
        <CardHeader className="pb-3 border-b">
          <div className="space-y-2">
            {/* Day and Date */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  {dayName}
                </div>
                <div className="text-lg font-semibold">
                  {format(dateObj, 'MMM d, yyyy')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {totalSessionsOnDay > 1 && onRemoveSession && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={() => onRemoveSession(day.date, sessionIndex)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Session Name - Editable */}
            <div className="flex items-center gap-2">
              {isEditingSessionName ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    type="text"
                    value={editingSessionNameValue}
                    onChange={(e) => setEditingSessionNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveSessionName();
                      } else if (e.key === 'Escape') {
                        setIsEditingSessionName(false);
                      }
                    }}
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={handleSaveSessionName}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setIsEditingSessionName(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  className="text-sm font-medium hover:text-foreground flex items-center gap-1 group"
                  onClick={handleStartEditingSessionName}
                >
                  <span>{sessionName}</span>
                  <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
            
            {/* Intensity Badge - Larger and More Prominent */}
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs font-medium px-2 py-1", intensityClass)}>
                {day.intensity.replace('-', ' ').toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-3 pt-0">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {/* Unsectioned exercises */}
              {exercisesBySection.unsectioned.length > 0 && (
                <Droppable droppableId={`session-${day.date}::${sessionIndex}`} type="EXERCISE">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "rounded-md border-2 border-dashed p-2",
                        snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-muted"
                      )}
                    >
                      <div className="space-y-2">
                        {exercisesBySection.unsectioned.map((exercise, index) => 
                          renderExerciseCard(exercise, index, exercisesBySection.unsectioned)
                        )}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              )}

              {/* Empty state when no exercises at all */}
              {exercises.length === 0 && (
                <Droppable droppableId={`session-${day.date}::${sessionIndex}`} type="EXERCISE">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "rounded-md border-2 border-dashed p-8 min-h-[200px] flex items-center justify-center",
                        snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-muted"
                      )}
                    >
                      <div className="text-xs text-muted-foreground text-center">
                        Drag exercises here
                      </div>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}

              {/* Sections with their exercises */}
              {exercisesBySection.sortedSections.map(section => (
                <div key={section.id} className="space-y-2">
                  {/* Section Container with Background */}
                  <div className="rounded-lg border-2 bg-muted/20 p-3 space-y-2">
                    {/* Section Header */}
                    <div className="flex items-center justify-between pb-2 border-b">
                      {editingSectionId === section.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            value={editingSectionName}
                            onChange={(e) => setEditingSectionName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRenameSection();
                              if (e.key === 'Escape') {
                                setEditingSectionId(null);
                                setEditingSectionName('');
                              }
                            }}
                            className="h-6 text-xs px-2 flex-1"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={handleSaveRenameSection}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setEditingSectionId(null);
                              setEditingSectionName('');
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">{section.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {exercisesBySection.sectioned[section.id]?.length || 0}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-accent"
                              onClick={() => handleStartRenameSection(section)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:bg-accent"
                              onClick={() => onDeleteSection(section.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Section exercises droppable area */}
                    <Droppable droppableId={`section-${section.id}`} type="EXERCISE">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "rounded-md border-2 border-dashed p-2 min-h-[60px] transition-colors",
                            snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-muted/50 bg-background"
                          )}
                        >
                          <div className="space-y-2">
                            {exercisesBySection.sectioned[section.id]?.length === 0 ? (
                              <div className="text-xs text-muted-foreground text-center py-4">
                                Drop exercises here
                              </div>
                            ) : (
                              exercisesBySection.sectioned[section.id]?.map((exercise, index) => 
                                renderExerciseCard(exercise, index, exercisesBySection.sectioned[section.id])
                              )
                            )}
                            {provided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              ))}

              {/* Add Section Button */}
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
          </ScrollArea>
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
