import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CellData, TableColumn } from '@/types/microcycle-planning';
import { ExtendedMesocycle } from '@/features/planner/types';

interface ExerciseCopyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sourceColumnId: string) => void;
  methodId: string;
  categoryName: string | undefined;
  targetColumnId: string;
  mesocycles: ExtendedMesocycle[];
  cellData: Record<string, CellData>;
  columnStructure: TableColumn[];
  getCellId: (methodId: string, categoryName: string | undefined, columnId: string) => string;
}

export function ExerciseCopyDialog({
  isOpen,
  onClose,
  onConfirm,
  methodId,
  categoryName,
  targetColumnId,
  mesocycles,
  cellData,
  columnStructure,
  getCellId,
}: ExerciseCopyDialogProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');

  // Find all columns with exercises for this method and category
  const availableSources = useMemo(() => {
    const sources: Array<{
      columnId: string;
      label: string;
      exerciseCount: number;
      exercises: string[];
    }> = [];

    columnStructure.forEach((column) => {
      // Skip link areas and the target column itself
      if (column.type === 'link-area' || column.id === targetColumnId) return;

      const cellId = getCellId(methodId, categoryName, column.id);
      const cell = cellData[cellId];

      // Only include columns that have exercises
      if (cell && cell.exercises.length > 0) {
        let label = '';
        if (column.type === 'mesocycle') {
          label = column.mesocycleName;
        } else if (column.type === 'microcycle') {
          label = `${column.mesocycleName} - ${column.microcycleName}`;
        } else if (column.type === 'microcycle-group') {
          label = `${column.mesocycleName} - ${column.groupName}`;
        }

        sources.push({
          columnId: column.id,
          label,
          exerciseCount: cell.exercises.length,
          exercises: cell.exercises.map(ex => ex.exerciseName),
        });
      }
    });

    return sources;
  }, [columnStructure, cellData, methodId, categoryName, targetColumnId, getCellId]);

  const handleConfirm = () => {
    if (selectedSourceId) {
      onConfirm(selectedSourceId);
      setSelectedSourceId('');
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedSourceId('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Copy Exercises</DialogTitle>
          <DialogDescription>
            Select a source to copy exercises from for this training method
            {categoryName && ` (${categoryName})`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          {availableSources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No exercises found in other columns for this training method
            </div>
          ) : (
            <RadioGroup value={selectedSourceId} onValueChange={setSelectedSourceId}>
              <div className="space-y-3">
                {availableSources.map((source) => (
                  <div
                    key={source.columnId}
                    className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer"
                    onClick={() => setSelectedSourceId(source.columnId)}
                  >
                    <RadioGroupItem value={source.columnId} id={source.columnId} />
                    <div className="flex-1 space-y-2">
                      <Label
                        htmlFor={source.columnId}
                        className="font-medium cursor-pointer flex items-center gap-2"
                      >
                        {source.label}
                        <Badge variant="secondary" className="ml-2">
                          {source.exerciseCount} exercise{source.exerciseCount !== 1 ? 's' : ''}
                        </Badge>
                      </Label>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {source.exercises.map((exerciseName, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-primary">•</span>
                            <span>{exerciseName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedSourceId || availableSources.length === 0}
          >
            Copy Exercises
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
