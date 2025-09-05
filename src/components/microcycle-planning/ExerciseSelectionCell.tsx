import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus, Search } from 'lucide-react';
import { CellData, ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { NewExerciseDialog } from './NewExerciseDialog';

interface ExerciseSelectionCellProps {
  cellData: CellData;
  onUpdate: (data: Partial<CellData>) => void;
}

export function ExerciseSelectionCell({ cellData, onUpdate }: ExerciseSelectionCellProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isNewExerciseDialogOpen, setIsNewExerciseDialogOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');

  const handleInputSubmit = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    // Check if exercise already exists in any library
    // For now, we'll just show the new exercise dialog
    setNewExerciseName(trimmedValue);
    setIsNewExerciseDialogOpen(true);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputSubmit(inputValue);
    }
  };

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
    setIsNewExerciseDialogOpen(false);
    setNewExerciseName('');
  };

  return (
    <div className="space-y-2 min-h-[60px]">
      {/* Exercise input */}
      <div className="flex items-center gap-1">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type exercise..."
          className="text-xs h-6"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsLibraryOpen(true)}
          className="h-6 w-6 p-0"
        >
          <Search className="h-3 w-3" />
        </Button>
      </div>

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

      {/* Add exercise button when no exercises */}
      {cellData.exercises.length === 0 && !inputValue && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsLibraryOpen(true)}
          className="h-6 w-full text-xs text-muted-foreground border-dashed border"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add exercises
        </Button>
      )}

      {/* Exercise Library Popup */}
      <ExerciseLibraryPopup
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectExercises={(exercises) => {
          exercises.forEach(addExercise);
          setIsLibraryOpen(false);
        }}
        selectedExerciseIds={cellData.exercises.map(ex => ex.exerciseId)}
      />

      {/* New Exercise Dialog */}
      <NewExerciseDialog
        isOpen={isNewExerciseDialogOpen}
        onClose={() => {
          setIsNewExerciseDialogOpen(false);
          setNewExerciseName('');
        }}
        exerciseName={newExerciseName}
        onExerciseCreated={handleExerciseCreated}
      />
    </div>
  );
}