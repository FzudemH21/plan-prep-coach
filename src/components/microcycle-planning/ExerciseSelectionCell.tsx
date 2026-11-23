import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus, Copy, Info, Ban } from 'lucide-react';
import { CellData, ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { ExerciseDetailDialog } from '@/components/shared/ExerciseDetailDialog';
import { useCustomLibraries, getNameColumnId } from '@/contexts/CustomLibrariesContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ExerciseSelectionCellProps {
  cellData: CellData;
  onUpdate: (data: Partial<CellData>) => void;
  onCopy?: () => void;
  hasPreviousExercises?: boolean;
  parameterInfo?: string;
  /** When true the method is not assigned to this mesocycle — cell is locked */
  disabled?: boolean;
  /** This cell's id — its exercises can be dragged to another cell (e.g. another exercise category) */
  cellId?: string;
  /** An exercise of another cell was dropped here: move it into this cell */
  onDropExercise?: (fromCellId: string, exerciseEntryId: string) => void;
}

/** Drag data of an exercise dragged between Exercise Selection cells */
const DRAG_TYPE = 'application/x-ppc-selection-exercise';

export function ExerciseSelectionCell({
  cellData,
  onUpdate,
  onCopy,
  hasPreviousExercises = false,
  parameterInfo,
  disabled = false,
  cellId,
  onDropExercise,
}: ExerciseSelectionCellProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  // An exercise from another cell is dragged over this one
  const [dropActive, setDropActive] = useState(false);
  const canDrag = !!cellId && !!onDropExercise;
  const isOurDrag = (e: React.DragEvent) => canDrag && Array.from(e.dataTransfer.types).includes(DRAG_TYPE);
  const [openExercise, setOpenExercise] = useState<ExerciseSelection | null>(null);
  const { libraries } = useCustomLibraries();

  // The library's current name — the copy in the cell is stale right after a rename
  const currentName = (exercise: ExerciseSelection) => {
    const lib = libraries.find(l => l.id === exercise.library);
    const name = lib?.exercises.find(e => e.id === exercise.exerciseId)?.data?.[getNameColumnId(lib) ?? ''];
    return typeof name === 'string' && name.trim() ? name : exercise.exerciseName;
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
  };

  if (disabled) {
    return (
      <div className="min-h-[60px] flex items-center justify-center bg-muted/20 rounded border border-dashed border-border/40">
        <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
          <Ban className="h-4 w-4" />
          <span className="text-[10px]">Not assigned</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`space-y-3 min-h-[60px] flex flex-col relative rounded transition-colors ${dropActive ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}
      onDragOver={(e) => {
        if (!isOurDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dropActive) setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false);
      }}
      onDrop={(e) => {
        if (!isOurDrag(e)) return;
        e.preventDefault();
        setDropActive(false);
        try {
          const { fromCellId, exerciseEntryId } = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as { fromCellId: string; exerciseEntryId: string };
          if (fromCellId && exerciseEntryId && fromCellId !== cellId) onDropExercise?.(fromCellId, exerciseEntryId);
        } catch { /* not ours */ }
      }}
    >
      {/* Info icon - top right (only show if parameterInfo exists and is not empty) */}
      {parameterInfo && parameterInfo.trim() !== '' && (
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div className="absolute -top-0.5 right-0.5 z-10">
                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help transition-colors" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" align="start" className="max-w-md">
              <div className="text-xs whitespace-pre font-mono">
                <p className="font-medium mb-2 text-primary font-sans">Method Parameters:</p>
                {parameterInfo}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Action buttons - always at top for visibility */}
      <div className="flex gap-1 shrink-0 mt-8">
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
          <div
            key={exercise.id}
            className={`group flex items-center justify-between bg-muted/50 rounded px-2 py-1 ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
            draggable={canDrag}
            onDragStart={(e) => {
              if (!canDrag) return;
              e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ fromCellId: cellId, exerciseEntryId: exercise.id }));
              e.dataTransfer.effectAllowed = 'move';
            }}
            title={canDrag ? 'Drag to another row to move it' : undefined}
          >
            {canDrag && <GripVertical className="h-3 w-3 shrink-0 -ml-1 mr-0.5 text-muted-foreground/40 group-hover:text-muted-foreground" />}
            {exercise.isCircuit ? (
              <span className="text-xs font-medium truncate flex-1">
                {exercise.exerciseName}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setOpenExercise(exercise)}
                className="text-xs font-medium truncate flex-1 text-left hover:text-primary hover:underline"
                title="Open / edit exercise"
              >
                {currentName(exercise)}
              </button>
            )}
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

      {/* The exercise's library entry — Edit saves it to the exercise database */}
      {openExercise && (
        <ExerciseDetailDialog
          isOpen={!!openExercise}
          onClose={() => setOpenExercise(null)}
          exerciseId={openExercise.exerciseId}
          exerciseName={openExercise.exerciseName}
          libraryId={openExercise.library}
          mode="edit"
        />
      )}
    </div>
  );
}