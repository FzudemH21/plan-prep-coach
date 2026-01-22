import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Video, ExternalLink, Link2 } from 'lucide-react';
import { useCustomLibraries, CustomLibrary, CustomExercise, LibraryColumn } from '@/contexts/CustomLibrariesContext';

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
  const isEditable = mode !== 'view';
  
  // Local state for editing
  const [localName, setLocalName] = useState('');
  const [localVideoUrl, setLocalVideoUrl] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localData, setLocalData] = useState<Record<string, any>>({});
  const [showVideoEmbed, setShowVideoEmbed] = useState(false);
  
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
      setLocalVideoUrl(videoUrl);
      setLocalDescription(description);
      setLocalData({ ...exerciseData });
      setShowVideoEmbed(false);
    }
  }, [isOpen, exerciseName, videoUrl, description, exerciseData]);
  
  // Handle save
  const handleSave = () => {
    if (mode === 'view') {
      onClose();
      return;
    }
    
    // Use the new onSave callback if provided
    if (onSave) {
      onSave({
        name: localName,
        videoUrl: localVideoUrl,
        description: localDescription,
        data: localData,
      });
      return;
    }
    
    // Legacy behavior: If we have callback handlers, use them
    if (onVideoUrlChange && localVideoUrl !== videoUrl) {
      onVideoUrlChange(localVideoUrl);
    }
    if (onDescriptionChange && localDescription !== description) {
      onDescriptionChange(localDescription);
    }
    
    // If we found the exercise in a library, update it directly
    if (foundExercise && library) {
      updateExerciseInLibrary(library.id, exerciseId, {
        videoUrl: localVideoUrl || undefined,
        description: localDescription || undefined,
      });
    }
    
    onClose();
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
          className="min-h-[60px] resize-none"
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
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === 'create' ? 'Add New Exercise' : (isEditable ? 'Edit Exercise' : exerciseName)}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-1">
          <div className="space-y-6 px-1">
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
            
            {/* Video Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Video className="h-4 w-4" />
                Video
              </h3>
              
              {!isEditable ? (
                // Read-only view
                thumbnailUrl ? (
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
                )
              ) : (
                // Editable view
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={localVideoUrl}
                      onChange={(e) => setLocalVideoUrl(e.target.value)}
                      placeholder="Paste YouTube URL or video ID..."
                      className="flex-1"
                    />
                    {localVideoUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(localVideoUrl.startsWith('http') ? localVideoUrl : `https://www.youtube.com/watch?v=${localVideoUrl}`, '_blank')}
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
              )}
            </div>
            
            <Separator />
            
            {/* Description Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Description / Execution Instructions</h3>
              
              {!isEditable ? (
                localDescription || description ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{localDescription || description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description available</p>
                )
              ) : (
                <Textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  placeholder="Enter exercise description, execution instructions, coaching cues..."
                  className="min-h-[100px] resize-none"
                />
              )}
            </div>
            
            <Separator />
            
            {/* Exercise Characteristics / Properties */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                {isEditable ? 'Properties' : 'Characteristics'}
              </h3>
              
              {isEditable && columns.length > 0 ? (
                // Editable properties grid (skip first column which is the name)
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {columns.slice(1).map(column => (
                    <div key={column.id} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{column.name}</Label>
                      {renderColumnInput(column, localData[column.id], (val) => 
                        setLocalData(prev => ({ ...prev, [column.id]: val }))
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Read-only characteristics display
                Object.keys(exerciseData).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No characteristics available</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(exerciseData).map(([key, value]) => {
                      // Skip empty values
                      if (!value) return null;
                      
                      // Find column for display name
                      const column = columns.find(col => col.id === key);
                      const displayName = column?.name || key;
                      
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">{displayName}</span>
                          <Badge variant="secondary" className="w-fit font-normal">
                            {String(value)}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="mt-4">
          {!isEditable ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={mode === 'create' && !localName.trim()}>
                {mode === 'create' ? 'Add Exercise' : 'Save'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
