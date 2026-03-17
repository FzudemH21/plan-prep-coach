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
import { Play, Video, ExternalLink, Link2, X, Pencil } from 'lucide-react';
import { useCustomLibraries, CustomLibrary, CustomExercise, LibraryColumn } from '@/contexts/CustomLibrariesContext';
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

// Detect if a column represents a video field
const isVideoColumn = (column: LibraryColumn): boolean => {
  const nameLower = column.name.toLowerCase();
  const idLower = column.id.toLowerCase();
  return nameLower.includes('video') || idLower.includes('video');
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

  // Columns to display: all except the first (name) column
  const displayColumns = columns.slice(1);

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

              {/* Backward compat: show legacy videoUrl if exercise has it but library has no video column */}
              {!hasVideoColInLib && (videoUrl || localVideoUrl) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Video
                    </h3>
                    {renderVideoSection()}
                  </div>
                </>
              )}

              {/* Backward compat: show legacy description if exercise has it and library has no textarea columns */}
              {!isEditable && (description || localDescription) && !displayColumns.some(col => col.type === 'textarea') && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Description</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {localDescription || description}
                    </p>
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
