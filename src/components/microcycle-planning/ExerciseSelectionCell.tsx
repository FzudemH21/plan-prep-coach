import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus, Copy, Info } from 'lucide-react';
import { CellData, ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ExerciseSelectionCellProps {
  cellData: CellData;
  onUpdate: (data: Partial<CellData>) => void;
  onCopy?: () => void;
  hasPreviousExercises?: boolean;
  parameterInfo?: string;
}

export function ExerciseSelectionCell({ 
  cellData, 
  onUpdate, 
  onCopy,
  hasPreviousExercises = false,
  parameterInfo
}: ExerciseSelectionCellProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const addExercise = (exercise: ExerciseSelection) => {
    const newExercises = [...cellData.exercises, exercise];
    onUpdate({ exercises: newExercises });
  };

  const removeExercise = (exerciseId: string) => {
    const newExercises = cellData.exercises.filter(ex => ex.id !== exerciseId);
    onUpdate({ exercises: newExercises });
  };

  const handleExerciseCreated = (exercise: ExerciseSelection) => {
    addExercise(exercise);
  };

  return (
    <div className="space-y-3 min-h-[60px] flex flex-col relative">
      {/* Info icon - top right (only show if parameterInfo exists and is not empty) */}
      {parameterInfo && parameterInfo.trim() !== '' && (
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div className="absolute top-1 right-1 z-10">
                <Info className="h-4 w-4 text-muted-foreground hover:text-primary cursor-help transition-colors" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" align="start" className="max-w-sm">
              <div className="text-xs whitespace-pre-line">
                <p className="font-medium mb-1 text-primary">Method Parameters:</p>
                {parameterInfo}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Action buttons - always at top for visibility */}
      <div className="flex gap-1 shrink-0 mt-2">
        {hasPreviousExercises && onCopy && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopy}
            className="h-6 flex-1 text-xs text-muted-foreground border-dashed border"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsLibraryOpen(true)}
          className="h-6 flex-1 text-xs text-muted-foreground border-dashed border"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add exercises
        </Button>
      </div>

      {/* Selected exercises */}
      <div className="space-y-1 flex-1">
        {cellData.exercises.map((exercise) => (
          <div key={exercise.id} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1">
            <span className="text-xs font-medium truncate flex-1">
              {exercise.exerciseName}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeExercise(exercise.id)}
              className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Exercise Library Popup */}
      <ExerciseLibraryPopup
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectExercises={(exercises) => {
          const newExercises = [...cellData.exercises, ...exercises];
          onUpdate({ exercises: newExercises });
          setIsLibraryOpen(false);
        }}
        selectedExerciseIds={cellData.exercises.map(ex => ex.exerciseId)}
        onExerciseCreated={handleExerciseCreated}
      />
    </div>
  );
}