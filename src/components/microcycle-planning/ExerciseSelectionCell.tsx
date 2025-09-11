import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { CellData, ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';

interface ExerciseSelectionCellProps {
  cellData: CellData;
  onUpdate: (data: Partial<CellData>) => void;
}

export function ExerciseSelectionCell({ cellData, onUpdate }: ExerciseSelectionCellProps) {
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
    <div className="space-y-2 min-h-[60px]">

      {/* Selected exercises */}
      <div className="space-y-1">
        {cellData.exercises.map((exercise) => (
          <div key={exercise.id} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1">
            <span className="text-xs font-medium truncate flex-1">
              {exercise.exerciseName}
            </span>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs h-4 px-1">
                {exercise.library}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeExercise(exercise.id)}
                className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add exercise button - always visible */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsLibraryOpen(true)}
        className="h-6 w-full text-xs text-muted-foreground border-dashed border"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add exercises
      </Button>

      {/* Exercise Library Popup */}
      <ExerciseLibraryPopup
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectExercises={(exercises) => {
          exercises.forEach(addExercise);
          setIsLibraryOpen(false);
        }}
        selectedExerciseIds={cellData.exercises.map(ex => ex.exerciseId)}
        onExerciseCreated={handleExerciseCreated}
      />
    </div>
  );
}