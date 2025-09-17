import { useState, useCallback, useRef } from 'react';

export interface DragFillState {
  isDragging: boolean;
  sourceCell: string | null;
  selectedCells: Set<string>;
  sourceValue: string | number | null;
}

export interface DragFillHook {
  dragState: DragFillState;
  startDrag: (cellId: string, value: string | number) => void;
  endDrag: () => void;
  addToSelection: (cellId: string) => void;
  clearSelection: () => void;
  fillCells: (onFill: (cellId: string, value: string | number) => void) => void;
}

export function useDragFill(): DragFillHook {
  const [dragState, setDragState] = useState<DragFillState>({
    isDragging: false,
    sourceCell: null,
    selectedCells: new Set(),
    sourceValue: null,
  });

  const startDrag = useCallback((cellId: string, value: string | number) => {
    setDragState({
      isDragging: true,
      sourceCell: cellId,
      selectedCells: new Set([cellId]),
      sourceValue: value,
    });
  }, []);

  const endDrag = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      isDragging: false,
    }));
  }, []);

  const addToSelection = useCallback((cellId: string) => {
    setDragState(prev => ({
      ...prev,
      selectedCells: new Set([...prev.selectedCells, cellId]),
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      selectedCells: new Set(),
      sourceCell: null,
      sourceValue: null,
    }));
  }, []);

  const fillCells = useCallback((onFill: (cellId: string, value: string | number) => void) => {
    if (!dragState.sourceValue || !dragState.sourceCell) return;

    const cellsToFill = Array.from(dragState.selectedCells).filter(
      cellId => cellId !== dragState.sourceCell
    );

    // Smart fill logic
    const sourceValue = dragState.sourceValue;
    
    if (typeof sourceValue === 'number') {
      // For numbers, try to detect patterns
      const increment = cellsToFill.length > 1 ? 1 : 0;
      cellsToFill.forEach((cellId, index) => {
        const newValue = sourceValue + (increment * (index + 1));
        onFill(cellId, newValue);
      });
    } else {
      // For strings, just copy the value
      cellsToFill.forEach(cellId => {
        onFill(cellId, sourceValue);
      });
    }
  }, [dragState]);

  return {
    dragState,
    startDrag,
    endDrag,
    addToSelection,
    clearSelection,
    fillCells,
  };
}