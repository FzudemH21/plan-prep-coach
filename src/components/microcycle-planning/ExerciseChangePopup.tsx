import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';

interface ExerciseChangePopupProps {
  onSelect: (newExercise: { 
    exerciseId: string; 
    exerciseName: string; 
    libraryId: string;
    videoUrl?: string;
    description?: string;
  }) => void;
  currentExerciseId?: string;
  onClose?: () => void;
}

export function ExerciseChangePopup({ 
  onSelect, 
  currentExerciseId,
  onClose 
}: ExerciseChangePopupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('');
  
  const { libraries } = useCustomLibraries();

  // Set default active tab when libraries are loaded
  useEffect(() => {
    if (libraries.length > 0 && !activeTab) {
      setActiveTab(libraries[0].id);
    }
  }, [libraries, activeTab]);

  // Prepare exercises from all libraries
  const exercisesByLibrary = useMemo(() => {
    const result: Record<string, { 
      name: string; 
      exercises: Array<{ 
        id: string; 
        name: string; 
        videoUrl?: string;
        description?: string;
      }> 
    }> = {};
    
    libraries.forEach(lib => {
      // Get the first column key (exercise name column)
      const nameColumnKey = lib.columns.length > 0 ? lib.columns[0].id : 'name';
      // Find video URL and description columns if they exist
      const videoColumn = lib.columns.find(col => 
        col.name.toLowerCase().includes('video') || col.id.toLowerCase().includes('video')
      );
      const descColumn = lib.columns.find(col => 
        col.name.toLowerCase().includes('description') || 
        col.name.toLowerCase().includes('ausführung') ||
        col.id.toLowerCase().includes('description')
      );
      
      result[lib.id] = {
        name: lib.name,
        exercises: lib.exercises.map(ex => ({
          id: ex.id,
          name: ex.data[nameColumnKey] || 'Unknown Exercise',
          videoUrl: videoColumn ? ex.data[videoColumn.id] : undefined,
          description: descColumn ? ex.data[descColumn.id] : undefined,
        }))
      };
    });
    
    return result;
  }, [libraries]);

  // Filter exercises based on search
  const filteredExercises = useMemo(() => {
    const currentLibrary = exercisesByLibrary[activeTab];
    if (!currentLibrary) return [];
    
    if (!searchTerm.trim()) return currentLibrary.exercises;
    
    const searchLower = searchTerm.toLowerCase();
    return currentLibrary.exercises.filter(ex => 
      ex.name.toLowerCase().includes(searchLower)
    );
  }, [exercisesByLibrary, activeTab, searchTerm]);

  const handleSelectExercise = (exercise: { 
    id: string; 
    name: string; 
    videoUrl?: string;
    description?: string;
  }) => {
    onSelect({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      libraryId: activeTab,
      videoUrl: exercise.videoUrl,
      description: exercise.description,
    });
    onClose?.();
  };

  if (libraries.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No exercise libraries available
      </div>
    );
  }

  return (
    <div className="w-80 flex flex-col max-h-[400px]">
      {/* Library Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList 
          className="grid w-full shrink-0 h-auto p-1 gap-1" 
          style={{ gridTemplateColumns: `repeat(${Math.min(libraries.length, 3)}, 1fr)` }}
        >
          {Object.entries(exercisesByLibrary).map(([key, library]) => (
            <TabsTrigger 
              key={key} 
              value={key}
              className="text-xs px-2 py-1.5 truncate"
              title={library.name}
            >
              {library.name.length > 12 ? library.name.substring(0, 12) + '...' : library.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Search Input */}
        <div className="px-2 py-2 border-b">
          <div className="relative px-1 py-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Exercise List */}
        <TabsContent value={activeTab} className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[280px]">
            <div className="p-1">
              {filteredExercises.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No exercises found
                </div>
              ) : (
                filteredExercises.map((exercise) => {
                  const isCurrent = exercise.id === currentExerciseId;
                  return (
                    <button
                      key={exercise.id}
                      onClick={() => handleSelectExercise(exercise)}
                      disabled={isCurrent}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                        isCurrent && "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate flex-1">{exercise.name}</span>
                        {isCurrent && (
                          <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            current
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
