import React from 'react';
import { cn } from '@/lib/utils';

interface DragHandleProps {
  onDragStart: (e: React.MouseEvent) => void;
  onDragEnd: (e: React.MouseEvent) => void;
  className?: string;
}

export function DragHandle({ onDragStart, onDragEnd, className }: DragHandleProps) {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    onDragStart(e);

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      onDragEnd(e as any);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Trigger drag over events for cells under cursor
      const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
      const cell = elementUnder?.closest('[data-drag-cell]');
      if (cell) {
        const event = new CustomEvent('dragFill', {
          detail: {
            target: cell,
            mouseX: e.clientX,
            mouseY: e.clientY
          }
        });
        document.dispatchEvent(event);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
  };

  return (
    <div
      className={cn(
        "absolute bottom-0 right-0 w-2 h-2 bg-primary cursor-se-resize",
        "border border-background hover:bg-primary/80 transition-colors",
        "rounded-tl-sm opacity-60 hover:opacity-100",
        isDragging && "opacity-100 bg-primary/80",
        className
      )}
      onMouseDown={handleMouseDown}
      title="Drag to fill cells"
    />
  );
}