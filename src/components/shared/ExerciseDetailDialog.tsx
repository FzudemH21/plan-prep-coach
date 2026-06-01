import React, { useState, useEffect, useRef } from 'react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Play, Video, ExternalLink, Link2, X, Pencil, Plus, ChevronsUpDown, Check, TrendingUp, TrendingDown, GripVertical } from 'lucide-react';
import { useCustomLibraries, CustomLibrary, CustomExercise, LibraryColumn } from '@/contexts/CustomLibrariesContext';
import { useExerciseProgressions, ProgressionDirection, ExerciseProgression } from '@/hooks/useExerciseProgressions';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';

interface ExerciseDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Exercise identification
  exerciseId: string;
  exerciseName: string;
  libraryId?: string;
  // Mode: 'create' | 'edit' | 'view'
  mode?: 'create' | 'edit' | 'view';
  // For workout views (read-only mode) - legacy prop, use mode='view' instead
  readOnly?: boolean;
  // Columns for editable mode
  columns?: LibraryColumn[];
  // Pre-fetched data (optional - if not provided, will lookup from libraries)
  exerciseData?: Record<string, any>;
  videoUrl?: string;
  description?: string;
  // Callback for saving (create/edit modes)
  onSave?: (data: {
    name: string;
    videoUrl: string;
    description: string;
    data: Record<string, any>;
  }) => void;
  // Legacy callbacks for library view
  onVideoUrlChange?: (url: string) => void;
  onDescriptionChange?: (description: string) => void;
}

// Extract YouTube video ID from various URL formats
const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

// Get YouTube thumbnail URL
const getYouTubeThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
};

// Detect if a column represents a video field (role takes priority, name-based as fallback)
const isVideoColumn = (column: LibraryColumn): boolean => {
  if (column.role === 'video') return true;
  const nameLower = column.name.toLowerCase();
  const idLower = column.id.toLowerCase();
  return nameLower.includes('video') || idLower.includes('video');
};

// Detect if a column is the designated description field
const isDescriptionColumn = (column: LibraryColumn): boolean => {
  return column.role === 'description';
};

export function ExerciseDetailDialog({
  isOpen,
  onClose,
  exerciseId,
  exerciseName,
  libraryId,
  mode: propMode,
  readOnly = false,
  columns: propColumns,
  exerciseData: propExerciseData,
  videoUrl: propVideoUrl,
  description: propDescription,
  onSave,
  onVideoUrlChange,
  onDescriptionChange,
}: ExerciseDetailDialogProps) {
  const { libraries, updateExerciseInLibrary } = useCustomLibraries();

  // Determine actual mode
  const mode = propMode || (readOnly ? 'view' : 'edit');

  // Local state for editing
  const [localName, setLocalName] = useState('');
  const [localVideoUrl, setLocalVideoUrl] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localData, setLocalData] = useState<Record<string, any>>({});
  const [showVideoEmbed, setShowVideoEmbed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Progressions & Regressions
  const { progressions, add: addProgression, remove: removeProgression, updateLevels } = useExerciseProgressions(
    mode !== 'create' ? exerciseId : null
  );

  // progs visual order: descending (furthest at top, closest at bottom)
  // regressions visual order: ascending (closest at top, furthest at bottom)
  function handleDragEnd(result: DropResult) {
    if (!result.destination || result.destination.index === result.source.index) return;
    const { droppableId, index: destIdx } = result.destination;
    const srcIdx = result.source.index;

    if (droppableId === 'progressions-list') {
      const reordered = [...progs]; // descending visual order
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(destIdx, 0, moved);
      // closest-first = reverse of descending visual order
      updateLevels([...reordered].reverse());
    } else if (droppableId === 'regressions-list') {
      const reordered = [...regressions]; // ascending visual order = closest-first
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(destIdx, 0, moved);
      updateLevels(reordered);
    }
  }
  const [addingDirection, setAddingDirection] = useState<ProgressionDirection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerExerciseId, setPickerExerciseId] = useState('');
  const [pickerExerciseName, setPickerExerciseName] = useState('');
  const [pickerLevel, setPickerLevel] = useState(1);
  const [pickerNotes, setPickerNotes] = useState('');
  const [pickerSaving, setPickerSaving] = useState(false);

  // Flat list of all exercises across all libraries for the picker
  const allExercises = React.useMemo(() =>
    libraries.flatMap(lib => lib.exercises.map(ex => ({
      id: ex.id,
      name: ex.data?.name as string ?? ex.id,
      libraryName: lib.name,
    }))).sort((a, b) => a.name.localeCompare(b.name)),
  [libraries]);

  // Resolve exercise names for loaded progressions
  const progressionsWithNames = React.useMemo(() =>
    progressions.map(p => ({
      ...p,
      toExerciseName: allExercises.find(e => e.id === p.toExerciseId)?.name ?? p.toExerciseId,
    })),
  [progressions, allExercises]);

  const regressions = progressionsWithNames
    .filter(p => p.direction === 'regression')
    .sort((a, b) => a.level - b.level);  // level 1 closest to current (at top of regressions)
  const progs = progressionsWithNames
    .filter(p => p.direction === 'progression')
    .sort((a, b) => b.level - a.level);  // level 1 closest to current (at bottom of progressions)

  function resetPicker() {
    setPickerExerciseId('');
    setPickerExerciseName('');
    setPickerLevel(1);
    setPickerNotes('');
    setPickerSearch('');
    setPickerOpen(false);
    setAddingDirection(null);
  }

  async function handleAddProgression() {
    if (!pickerExerciseId || !addingDirection) return;
    setPickerSaving(true);
    await addProgression({
      toExerciseId: pickerExerciseId,
      toExerciseName: pickerExerciseName,
      fromExerciseName: exerciseName,
      direction: addingDirection,
      level: pickerLevel,
      notes: pickerNotes,
    });
    setPickerSaving(false);
    resetPicker();
  }

  // Find exercise in libraries if not provided
  const foundExercise = React.useMemo(() => {
    if (propExerciseData) return null; // Use provided data

    // Search by exerciseId across all libraries
    for (const library of libraries) {
      const exercise = library.exercises.find(ex => ex.id === exerciseId);
      if (exercise) {
        return { library, exercise };
      }
    }

    // If libraryId is provided, search specifically in that library
    if (libraryId) {
      const library = libraries.find(lib => lib.id === libraryId);
      if (library) {
        const exercise = library.exercises.find(ex => ex.id === exerciseId);
        if (exercise) {
          return { library, exercise };
        }
      }
    }

    return null;
  }, [libraries, exerciseId, libraryId, propExerciseData]);

  // Get actual data to display
  const exerciseData = propExerciseData || foundExercise?.exercise?.data || {};
  const videoUrl = propVideoUrl ?? foundExercise?.exercise?.videoUrl ?? '';
  const description = propDescription ?? foundExercise?.exercise?.description ?? '';
  const library = foundExercise?.library;

  // Get columns from props or library
  const columns = propColumns || library?.columns || [];

  // Columns to display: all except the first (name) column, sorted so video comes first, description second
  const displayColumns = React.useMemo(() => {
    const cols = columns.slice(1);
    const videoCols = cols.filter(c => isVideoColumn(c));
    const descCols = cols.filter(c => !isVideoColumn(c) && isDescriptionColumn(c));
    const others = cols.filter(c => !isVideoColumn(c) && !isDescriptionColumn(c));
    return [...videoCols, ...descCols, ...others];
  }, [columns]);

  // Check if any column represents a video field
  const hasVideoColInLib = displayColumns.some(isVideoColumn);

  // Track initialization to prevent re-syncing while dialog is open
  const hasInitialized = useRef(false);

  // Reset initialization flag when dialog closes
  useEffect(() => {
    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen]);

  // Sync local state only when dialog first opens
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      setLocalName(exerciseName);
      setLocalDescription(description);

      const dataInit = { ...exerciseData };

      // Seed video URL: prefer value stored in the video column, fall back to exercise.videoUrl
      const videoCol = columns.find(isVideoColumn);
      const initVideo = videoCol
        ? (exerciseData[videoCol.id] || videoUrl || '')
        : (videoUrl || '');
      // Also make sure data contains the video value under the column id
      if (videoCol && initVideo && !dataInit[videoCol.id]) {
        dataInit[videoCol.id] = initVideo;
      }

      setLocalVideoUrl(initVideo);
      setLocalData(dataInit);
      setShowVideoEmbed(false);
      setIsEditing(false); // Start in view mode
    }
  }, [isOpen, exerciseName, videoUrl, description, exerciseData, columns]);

  // Determine if currently editable (create mode always editable, edit mode only when user clicks Edit)
  const isEditable = mode === 'create' || (mode === 'edit' && isEditing);

  // Handle save
  const handleSave = () => {
    if (mode === 'view') {
      onClose();
      return;
    }

    // Derive final videoUrl and description from column data (prefer column value over standalone state)
    const videoCol = columns.find(isVideoColumn);
    const finalVideoUrl = videoCol
      ? (localData[videoCol.id] || localVideoUrl || '')
      : localVideoUrl;
    const finalDescription = localDescription;

    // Use the new onSave callback if provided
    if (onSave) {
      onSave({
        name: localName,
        videoUrl: finalVideoUrl,
        description: finalDescription,
        data: localData,
      });
      // For edit mode, return to view mode; for create mode, dialog closes via onSave callback
      if (mode === 'edit') {
        setIsEditing(false);
      }
      return;
    }

    // Legacy behavior: If we have callback handlers, use them
    if (onVideoUrlChange && finalVideoUrl !== videoUrl) {
      onVideoUrlChange(finalVideoUrl);
    }
    if (onDescriptionChange && finalDescription !== description) {
      onDescriptionChange(finalDescription);
    }

    // If we found the exercise in a library, update it directly
    if (foundExercise && library) {
      updateExerciseInLibrary(library.id, exerciseId, {
        videoUrl: finalVideoUrl || undefined,
        description: finalDescription || undefined,
        data: { ...(foundExercise.exercise.data || {}), ...localData },
      });
    }

    // For edit mode, return to view mode instead of closing
    if (mode === 'edit') {
      setIsEditing(false);
    } else {
      onClose();
    }
  };

  const youtubeId = extractYouTubeId(localVideoUrl || videoUrl);
  const thumbnailUrl = youtubeId ? getYouTubeThumbnail(youtubeId) : null;

  // Render input for a column based on its type
  const renderColumnInput = (column: LibraryColumn, value: any, onChange: (val: string) => void) => {
    if (column.type === 'select' && column.options) {
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {column.options.map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (column.type === 'textarea') {
      return (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${column.name.toLowerCase()}...`}
          className="min-h-[80px] resize-none"
        />
      );
    }

    return (
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${column.name.toLowerCase()}...`}
      />
    );
  };

  // Render the content for a single column section
  const renderColumnSection = (column: LibraryColumn) => {
    if (isVideoColumn(column)) {
      return renderVideoSection(column);
    }

    const value = localData[column.id] ?? exerciseData[column.id] ?? '';

    if (!isEditable) {
      if (!value && value !== 0) {
        return <p className="text-sm text-muted-foreground italic">No value set</p>;
      }
      if (column.type === 'textarea') {
        return <p className="text-sm text-muted-foreground whitespace-pre-wrap">{String(value)}</p>;
      }
      return (
        <Badge variant="secondary" className="w-fit font-normal">
          {String(value)}
        </Badge>
      );
    }

    return renderColumnInput(
      column,
      localData[column.id] ?? '',
      (val) => setLocalData(prev => ({ ...prev, [column.id]: val }))
    );
  };

  // Render the video section (editable or read-only)
  const renderVideoSection = (column?: LibraryColumn) => {
    if (!isEditable) {
      return thumbnailUrl ? (
        <div className="relative group">
          <div
            className="relative cursor-pointer rounded-lg overflow-hidden border bg-muted"
            onClick={() => setShowVideoEmbed(!showVideoEmbed)}
          >
            {showVideoEmbed ? (
              <iframe
                width="100%"
                height="315"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video"
              />
            ) : (
              <>
                <img
                  src={thumbnailUrl}
                  alt="Video thumbnail"
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="h-8 w-8 text-primary-foreground ml-1" />
                  </div>
                </div>
              </>
            )}
          </div>
          {!showVideoEmbed && (
            <p className="text-xs text-muted-foreground mt-1">Click to play</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No video available</p>
      );
    }

    // Editable video section
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <Input
            value={localVideoUrl}
            onChange={(e) => {
              const val = e.target.value;
              setLocalVideoUrl(val);
              if (column) {
                setLocalData(prev => ({ ...prev, [column.id]: val }));
              }
            }}
            placeholder="Paste YouTube URL or video ID..."
            className="flex-1"
          />
          {localVideoUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(
                localVideoUrl.startsWith('http')
                  ? localVideoUrl
                  : `https://www.youtube.com/watch?v=${localVideoUrl}`,
                '_blank'
              )}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>

        {thumbnailUrl && (
          <div
            className="relative cursor-pointer rounded-lg overflow-hidden border bg-muted"
            onClick={() => setShowVideoEmbed(!showVideoEmbed)}
          >
            {showVideoEmbed ? (
              <iframe
                width="100%"
                height="200"
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
                <img
                  src={thumbnailUrl}
                  alt="Video thumbnail"
                  className="w-full h-[200px] object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Cancel: reset local state from saved data
  const handleCancel = () => {
    if (mode === 'edit' && isEditing) {
      setIsEditing(false);
      setLocalName(exerciseName);
      setLocalDescription(description);
      const dataReset = { ...exerciseData };
      const videoCol = columns.find(isVideoColumn);
      const resetVideo = videoCol
        ? (exerciseData[videoCol.id] || videoUrl || '')
        : (videoUrl || '');
      setLocalVideoUrl(resetVideo);
      setLocalData(dataReset);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        {/* Custom overlay with higher z-index for better darkening over sheets */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "z-[120]"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[130] translate-x-[-50%] translate-y-[-50%]",
            "max-w-2xl max-h-[90vh] w-full flex flex-col gap-4 border bg-background p-6 shadow-lg rounded-lg overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle className="text-xl">
              {mode === 'create' ? 'Add New Exercise' : exerciseName}
            </DialogTitle>
            {mode === 'edit' && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-1">
            <div className="space-y-6 px-1 pb-4">
              {/* Exercise Name - Editable in create/edit modes */}
              {isEditable && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Exercise Name</Label>
                  <Input
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    placeholder="Enter exercise name..."
                    className="font-medium"
                  />
                </div>
              )}

              {/* Dynamic columns — each library column gets its own section */}
              {displayColumns.map((column, idx) => (
                <React.Fragment key={column.id}>
                  {(idx > 0 || isEditable) && <Separator />}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      {isVideoColumn(column) && <Video className="h-4 w-4" />}
                      {column.name}
                    </h3>
                    {renderColumnSection(column)}
                  </div>
                </React.Fragment>
              ))}

              {/* Empty state: library has no additional columns */}
              {displayColumns.length === 0 && !isEditable && (
                <p className="text-sm text-muted-foreground italic">
                  No additional fields configured for this library.
                </p>
              )}

              {/* Video — always shown when library has no dedicated video column */}
              {!hasVideoColInLib && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Video URL
                    </h3>
                    {renderVideoSection()}
                  </div>
                </>
              )}

              {/* Description — always shown when library has no dedicated description column */}
              {!displayColumns.some(isDescriptionColumn) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Description</h3>
                    {isEditable ? (
                      <Textarea
                        value={localDescription}
                        onChange={(e) => setLocalDescription(e.target.value)}
                        placeholder="Enter exercise description..."
                        className="min-h-[100px] resize-none"
                      />
                    ) : (localDescription || description) ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {localDescription || description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No description</p>
                    )}
                  </div>
                </>
              )}

              {/* Progressions & Regressions — always shown in view/edit mode (not create) */}
              {mode !== 'create' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Progressions &amp; Regressions</h3>

                    {/* Chain display + inline add buttons */}
                    <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="space-y-1">
                      {/* Add Progression button (above current) */}
                      {mode === 'edit' && addingDirection !== 'progression' && (
                        <button
                          onClick={() => setAddingDirection('progression')}
                          className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Add Progression
                        </button>
                      )}

                      {/* Progressions (harder) — above current, draggable in edit mode */}
                      <Droppable droppableId="progressions-list" isDropDisabled={mode !== 'edit'}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                            {progs.map((p, idx) => (
                              <Draggable key={p.id} draggableId={p.id} index={idx} isDragDisabled={mode !== 'edit'}>
                                {(drag, snapshot) => (
                                  <div
                                    ref={drag.innerRef}
                                    {...drag.draggableProps}
                                    className={cn(
                                      'flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/40 text-sm group',
                                      snapshot.isDragging && 'shadow-md ring-1 ring-primary/30 bg-background'
                                    )}
                                  >
                                    {mode === 'edit' && (
                                      <span {...drag.dragHandleProps} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                                        <GripVertical className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                    <TrendingUp className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400 w-24 shrink-0">
                                      Progression {p.level}
                                    </span>
                                    <span className="flex-1 font-medium truncate">{p.toExerciseName}</span>
                                    {p.notes && (
                                      <span className="text-xs text-muted-foreground italic truncate max-w-[140px]">{p.notes}</span>
                                    )}
                                    {mode === 'edit' && (
                                      <button
                                        onClick={() => removeProgression(p.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-muted-foreground hover:text-destructive shrink-0"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      {/* Current exercise (centre) */}
                      <div className="flex items-center gap-2 rounded-md px-2 py-2 bg-primary/10 border border-primary/30 text-sm">
                        <div className="h-3.5 w-3.5 rounded-full bg-primary shrink-0" />
                        <span className="font-semibold flex-1 truncate">{exerciseName}</span>
                        <span className="text-xs text-muted-foreground">current</span>
                      </div>

                      {/* Regressions (easier) — below current, draggable in edit mode */}
                      <Droppable droppableId="regressions-list" isDropDisabled={mode !== 'edit'}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                            {regressions.map((p, idx) => (
                              <Draggable key={p.id} draggableId={p.id} index={idx} isDragDisabled={mode !== 'edit'}>
                                {(drag, snapshot) => (
                                  <div
                                    ref={drag.innerRef}
                                    {...drag.draggableProps}
                                    className={cn(
                                      'flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/40 text-sm group',
                                      snapshot.isDragging && 'shadow-md ring-1 ring-primary/30 bg-background'
                                    )}
                                  >
                                    {mode === 'edit' && (
                                      <span {...drag.dragHandleProps} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                                        <GripVertical className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                    <TrendingDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 w-24 shrink-0">
                                      Regression {p.level}
                                    </span>
                                    <span className="flex-1 font-medium truncate">{p.toExerciseName}</span>
                                    {p.notes && (
                                      <span className="text-xs text-muted-foreground italic truncate max-w-[140px]">{p.notes}</span>
                                    )}
                                    {mode === 'edit' && (
                                      <button
                                        onClick={() => removeProgression(p.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-muted-foreground hover:text-destructive shrink-0"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      {/* Add Regression button (below current) */}
                      {mode === 'edit' && addingDirection !== 'regression' && (
                        <button
                          onClick={() => setAddingDirection('regression')}
                          className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Add Regression
                        </button>
                      )}

                      {regressions.length === 0 && progs.length === 0 && mode !== 'edit' && (
                        <p className="text-xs text-muted-foreground italic px-2">No progressions or regressions defined yet.</p>
                      )}
                    </div>
                    </DragDropContext>

                    {/* Add form — only in edit mode */}
                    {mode === 'edit' && (
                      <div className="space-y-2">
                        {addingDirection !== null && (
                          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Add {addingDirection === 'regression' ? 'Regression' : 'Progression'}
                            </p>

                            {/* Exercise picker */}
                            <div className="space-y-1">
                              <Label className="text-xs">Exercise</Label>
                              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between font-normal h-9 text-sm"
                                  >
                                    {pickerExerciseName || 'Select exercise…'}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-0 z-[200]" align="start">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search exercises…"
                                      value={pickerSearch}
                                      onValueChange={setPickerSearch}
                                    />
                                    <CommandList className="max-h-[200px]">
                                      <CommandEmpty>No exercises found.</CommandEmpty>
                                      <CommandGroup>
                                        {allExercises
                                          .filter(e =>
                                            e.id !== exerciseId &&
                                            !progressions.some(p => p.toExerciseId === e.id) &&
                                            e.name.toLowerCase().includes(pickerSearch.toLowerCase())
                                          )
                                          .map(e => (
                                            <CommandItem
                                              key={e.id}
                                              value={e.name}
                                              onSelect={() => {
                                                setPickerExerciseId(e.id);
                                                setPickerExerciseName(e.name);
                                                setPickerOpen(false);
                                                setPickerSearch('');
                                              }}
                                            >
                                              <Check className={cn('mr-2 h-4 w-4', pickerExerciseId === e.id ? 'opacity-100' : 'opacity-0')} />
                                              <div>
                                                <div className="text-sm">{e.name}</div>
                                                <div className="text-xs text-muted-foreground">{e.libraryName}</div>
                                              </div>
                                            </CommandItem>
                                          ))
                                        }
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>

                            {/* Level */}
                            <div className="space-y-1">
                              <Label className="text-xs">Level (steps away)</Label>
                              <Input
                                type="number"
                                min={1}
                                value={pickerLevel}
                                onChange={e => setPickerLevel(Math.max(1, parseInt(e.target.value) || 1))}
                                className="h-9 w-24"
                              />
                            </div>

                            {/* Notes */}
                            <div className="space-y-1">
                              <Label className="text-xs">Note <span className="text-muted-foreground">(optional)</span></Label>
                              <Input
                                value={pickerNotes}
                                onChange={e => setPickerNotes(e.target.value)}
                                placeholder="e.g. use when athlete lacks hip mobility"
                                className="h-9 text-sm"
                              />
                            </div>

                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={resetPicker}>Cancel</Button>
                              <Button
                                size="sm"
                                disabled={!pickerExerciseId || pickerSaving}
                                onClick={handleAddProgression}
                              >
                                {pickerSaving ? 'Saving…' : 'Add'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            {!isEditable ? (
              <Button onClick={onClose}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={mode === 'create' && !localName.trim()}>
                  {mode === 'create' ? 'Add Exercise' : 'Save'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
