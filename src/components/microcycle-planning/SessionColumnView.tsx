import React, { useState, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { GripVertical, MoreVertical, Trash2, Plus, Link2, Edit2, Pencil, Check, X, ChevronUp, MessageSquare, Copy, ArrowUp, ArrowDown, StickyNote } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { TrainingDay } from '@/types/daily-intensity';
import { IntensityLevel } from '@/types/training';
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
  notes?: string;
}

interface SessionSection {
  id: string;
  dayDate: string;
  sessionIndex: number;
  name: string;
  order: number;
  comments?: string;
}

interface SessionColumnViewProps {
  day: TrainingDay;
  sessionIndex: number;
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  supersets: Record<string, Record<string, string[]>>;  // Updated: sectionId -> supersetId -> exercise IDs
  totalSessionsOnDay: number;
  onDeleteExercise: (exerciseId: string) => void;
  onAddSection: () => void;
  onRenameSection: (sectionId: string, newName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleSuperset: (dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string, sectionId?: string) => void;
  onRemoveSession?: (dayDate: string, sessionIndex: number) => void;
  onRenameSession?: (dayDate: string, sessionIndex: number, newName: string) => void;
  onSessionIntensityChange?: (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => void;
  intensityLevels?: IntensityLevel[];
  getIntensityColor?: (intensity: IntensityLevel) => string;
  mesocycleId?: string;
  sessionComments?: string;
  onSessionCommentsChange?: (dayDate: string, sessionIndex: number, comments: string) => void;
  onSectionCommentsChange?: (sectionId: string, comments: string) => void;
  copiedSection?: { exercises: ExerciseDistribution[]; sections: any[]; sourceSectionId: string; sourceDayDate: string; sourceSessionIndex: number } | null;
  onCopySection?: (sectionId: string) => void;
  onPasteSection?: (dayDate: string, sessionIndex: number) => void;
  copiedSession?: { exercises: ExerciseDistribution[]; sections?: any[]; sourceDate: string; sessionIndex: number } | null;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionUp?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionDown?: (dayDate: string, sessionIndex: number) => void;
  onExerciseNotesChange?: (exerciseId: string, notes: string) => void;
}

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
  onSessionIntensityChange,
  intensityLevels,
  getIntensityColor,
  mesocycleId,
  sessionComments,
  onSessionCommentsChange,
  onSectionCommentsChange,
  copiedSection,
  onCopySection,
  onPasteSection,
  copiedSession,
  onCopySession,
  onMoveSessionUp,
  onMoveSessionDown,
  onExerciseNotesChange,
}: SessionColumnViewProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);
  const [editingSessionNameValue, setEditingSessionNameValue] = useState('');
  const [intensityPopoverOpen, setIntensityPopoverOpen] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const getSuperset = (exerciseId: string, sectionId?: string): string | undefined => {
    const sectionKey = sectionId || '__unsectioned__';
    const sectionSupersets = supersets[sectionKey] || {};
    return Object.entries(sectionSupersets).find(([_, ids]) => ids.includes(exerciseId))?.[0];
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
    
    // Sort exercises by order within each section
    for (const sectionId of Object.keys(sectioned)) {
      sectioned[sectionId].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    unsectioned.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
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
  
  // Get session-specific intensity or fall back to day intensity
  const sessionIntensityKey = mesocycleId ? `sessionIntensity_${mesocycleId}_${day.date}_${sessionIndex}` : '';
  const storedSessionIntensity = sessionIntensityKey ? localStorage.getItem(sessionIntensityKey) : null;
  const displayIntensity = (storedSessionIntensity || day.intensity || 'moderate') as IntensityLevel;
  const intensityClass = getIntensityColor ? getIntensityColor(displayIntensity) : 'bg-muted text-muted-foreground';

  // Superset styling - blue left border to match Master Planner
  const getSupersetColor = (supersetId: string): string => {
    return 'border-l-4 border-l-primary';
  };

  const renderExerciseCard = (exercise: ExerciseDistribution, index: number, allExercises: ExerciseDistribution[], sectionId?: string) => {
    const supersetId = getSuperset(exercise.id, sectionId);
    const nextExercise = allExercises[index + 1];
    const nextSupersetId = nextExercise ? getSuperset(nextExercise.id, sectionId) : undefined;
    const hasLinkToNext = supersetId && supersetId === nextSupersetId;
    const isNoteExpanded = expandedNoteId === exercise.id;

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
                  "text-xs bg-muted/50 border rounded-md p-2.5 shadow-sm",
                  supersetId && getSupersetColor(supersetId),
                  snapshot.isDragging && "opacity-50 shadow-lg"
                )}
              >
                <div className="flex items-start gap-2">
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

                  {/* Notes button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setExpandedNoteId(isNoteExpanded ? null : exercise.id)}
                    title={exercise.notes ? "Edit notes" : "Add notes"}
                  >
                    <StickyNote className={cn("h-3 w-3", exercise.notes ? "text-primary" : "text-muted-foreground")} />
                  </Button>

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

                {/* Expandable notes textarea */}
                {isNoteExpanded && (
                  <div className="mt-2 pt-2 border-t">
                    <Textarea
                      value={exercise.notes || ''}
                      onChange={(e) => onExerciseNotesChange?.(exercise.id, e.target.value)}
                      placeholder="Add exercise notes..."
                      className="text-xs min-h-[60px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          setExpandedNoteId(null);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Superset link button */}
            {nextExercise && (
              <div className="flex justify-center -my-1 relative z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 rounded-full hover:bg-primary/10"
                  onClick={() => onToggleSuperset(day.date, sessionIndex, exercise.id, nextExercise.id, sectionId)}
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
      <Card className="w-80 flex-shrink-0 flex flex-col h-[600px] bg-muted/20">
        <CardHeader className="pb-3 border-b">
          <div className="space-y-2">
            {/* Session Name and Actions */}
            <div className="flex items-center justify-between gap-2">
              {/* Left side: Editable Session Name */}
              <div className="flex items-center gap-1 flex-1">
                {isEditingSessionName ? (
                  <>
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
                  </>
                ) : (
                  <h3 
                    className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={handleStartEditingSessionName}
                  >
                    {sessionName}
                  </h3>
                )}
              </div>
              
              {/* Right side: Action Buttons */}
              <div className="flex items-center gap-1">
                {/* Edit Button (Pencil) */}
                {!isEditingSessionName && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 hover:bg-accent"
                    onClick={handleStartEditingSessionName}
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </Button>
                )}
                
                {/* Copy Session Button */}
                {onCopySession && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-accent"
                    onClick={() => onCopySession(day.date, sessionIndex)}
                    title="Copy session"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </Button>
                )}
                
                {/* Move Up/Down Arrows - only show when multiple sessions exist */}
                {totalSessionsOnDay > 1 && (
                  <>
                    {/* Up arrow - hidden for first session */}
                    {sessionIndex > 0 && onMoveSessionUp && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-accent"
                        onClick={() => onMoveSessionUp(day.date, sessionIndex)}
                        title="Move session up"
                      >
                        <ArrowUp className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                    
                    {/* Down arrow - hidden for last session */}
                    {sessionIndex < totalSessionsOnDay - 1 && onMoveSessionDown && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-accent"
                        onClick={() => onMoveSessionDown(day.date, sessionIndex)}
                        title="Move session down"
                      >
                        <ArrowDown className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                  </>
                )}
                
                {/* Delete Session Button (Trash) */}
                {onRemoveSession && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:bg-accent"
                    onClick={() => onRemoveSession(day.date, sessionIndex)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Intensity Badge - Editable */}
            <div className="flex items-center gap-2">
              {getIntensityColor && intensityLevels && onSessionIntensityChange ? (
                <Popover open={intensityPopoverOpen} onOpenChange={setIntensityPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-xs font-medium px-2 py-1 h-auto hover:opacity-80",
                        intensityClass
                      )}
                    >
                      {displayIntensity.replace('-', ' ').toUpperCase()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Change Session Intensity</div>
                      {intensityLevels.map((level) => (
                        <Button
                          key={level}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-xs",
                            level === displayIntensity && "bg-accent"
                          )}
                          onClick={() => {
                            onSessionIntensityChange(day.date, sessionIndex, level);
                            setIntensityPopoverOpen(false);
                          }}
                        >
                          <span
                            className={cn(
                              "inline-block w-3 h-3 rounded-full mr-2",
                              getIntensityColor(level)
                            )}
                          />
                          {level.replace('-', ' ')}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <Badge className={cn("text-xs font-medium px-2 py-1", intensityClass)}>
                  {displayIntensity.replace('-', ' ').toUpperCase()}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
              </span>
            </div>
          </div>
        </CardHeader>

        {/* Session Comments */}
        {onSessionCommentsChange && (
          <div className="px-3 pt-2 pb-2 border-b">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Session Notes
            </label>
            <Textarea
              value={sessionComments || ''}
              onChange={(e) => onSessionCommentsChange(day.date, sessionIndex, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              placeholder="Add notes or guidelines for this session..."
              className="min-h-[60px] text-xs resize-none"
            />
          </div>
        )}

        <CardContent className="flex-1 overflow-hidden p-3 pt-0">
          <div className="h-full overflow-y-auto overflow-x-hidden">
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
                          renderExerciseCard(exercise, index, exercisesBySection.unsectioned, undefined)
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
                  {/* Section Container - white background with muted header */}
                  <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                    {/* Section Header - muted background */}
                    <div className="bg-muted/20 px-3 py-2 border-b">
                      <div className="flex items-center justify-between">
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
                              {/* Copy Section Button */}
                              {onCopySection && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-accent"
                                  onClick={() => onCopySection(section.id)}
                                  title="Copy section"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
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
                    </div>

                    {/* Section Content Area - white background */}
                    <div className="p-3 space-y-2">
                      {/* Section Comments */}
                      {!editingSectionId && onSectionCommentsChange && (
                        <div className="pb-2">
                          <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Section Notes
                          </label>
                          <Textarea
                            value={section.comments || ''}
                            onChange={(e) => onSectionCommentsChange(section.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="Add notes for this section..."
                            className="min-h-[50px] text-xs resize-none"
                          />
                        </div>
                      )}

                      {/* Section exercises droppable area */}
                      <Droppable droppableId={`section-${section.id}`} type="EXERCISE">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "rounded-md border-2 border-dashed p-2 min-h-[60px] transition-colors",
                              snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-muted/50"
                            )}
                          >
                            <div className="space-y-2">
                              {exercisesBySection.sectioned[section.id]?.length === 0 ? (
                                <div className="text-xs text-muted-foreground text-center py-4">
                                  Drop exercises here
                                </div>
                              ) : (
                                exercisesBySection.sectioned[section.id]?.map((exercise, index) => 
                                  renderExerciseCard(exercise, index, exercisesBySection.sectioned[section.id], section.id)
                                )
                              )}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>
                </div>
              ))}

              {/* Persistent "Add to New Section" Drop Zone */}
              <Droppable droppableId={`new-section-${day.date}::${sessionIndex}`} type="EXERCISE">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "rounded-md border-2 border-dashed p-3 transition-colors flex items-center justify-center gap-2",
                      snapshot.isDraggingOver 
                        ? "border-primary bg-primary/10" 
                        : "border-muted-foreground/30 bg-muted/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Drop to create new section
                    </span>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

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

              {/* Paste Section Button */}
              {copiedSection && onPasteSection && (
                <Button
                  onClick={() => onPasteSection(day.date, sessionIndex)}
                  className="w-full text-xs mt-2"
                  variant="default"
                  size="sm"
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Paste Section "{copiedSection.sections[0].name}" ({copiedSection.exercises.length} exercise{copiedSection.exercises.length !== 1 ? 's' : ''})
                </Button>
              )}
            </div>
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
