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
  addToSelection: (cellId: string, sourceCell?: string) => void;
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

  const addToSelection = useCallback((cellId: string, sourceCell?: string) => {
    setDragState(prev => {
      // For horizontal-only dragging, only allow cells from the same row
      if (sourceCell || prev.sourceCell) {
        const source = sourceCell || prev.sourceCell;
        if (source) {
          const [sourceMeso, sourceMicro, sourceMethod, sourceParam] = source.split('::');
          const [targetMeso, targetMicro, targetMethod, targetParam] = cellId.split('::');
          
          // Only allow if same method and parameter (same row)
          if (sourceMethod !== targetMethod || sourceParam !== targetParam) {
            return prev;
          }
        }
      }
      
      return {
        ...prev,
        selectedCells: new Set([...prev.selectedCells, cellId]),
      };
    });
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
    if ((dragState.sourceValue === null || dragState.sourceValue === undefined) || !dragState.sourceCell) {
      console.log('No source value or cell to fill from');
      return;
    }

    const cellsToFill = Array.from(dragState.selectedCells).filter(
      cellId => cellId !== dragState.sourceCell
    );

    console.log('Cells to fill:', cellsToFill);
    console.log('Source value to copy:', dragState.sourceValue);

    // Simple fill logic - just copy the source value to all selected cells
    const sourceValue = dragState.sourceValue;
    
    cellsToFill.forEach(cellId => {
      console.log('Copying value', sourceValue, 'to cell', cellId);
      onFill(cellId, sourceValue);
    });
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