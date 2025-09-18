import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ArrowRight, Copy, Layers } from 'lucide-react';

interface ParameterContextMenuProps {
  children: React.ReactNode;
  cellId: string;
  value: string | number;
  onFillRight: (cellId: string, value: string | number, fillEmptyOnly?: boolean) => void;
  onFillRow: (cellId: string, value: string | number, allMesocycles?: boolean, fillEmptyOnly?: boolean) => void;
  disabled?: boolean;
}

export function ParameterContextMenu({
  children,
  cellId,
  value,
  onFillRight,
  onFillRow,
  disabled = false
}: ParameterContextMenuProps) {
  if (disabled || !value) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 z-[200]">
        <ContextMenuItem
          onClick={() => onFillRight(cellId, value)}
          className="flex items-center gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          Fill right (all cells)
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onFillRight(cellId, value, true)}
          className="flex items-center gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          Fill right (empty only)
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onFillRow(cellId, value)}
          className="flex items-center gap-2"
        >
          <Copy className="h-4 w-4" />
          Fill row (current mesocycle)
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onFillRow(cellId, value, false, true)}
          className="flex items-center gap-2"
        >
          <Copy className="h-4 w-4" />
          Fill row (empty only)
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onFillRow(cellId, value, true)}
          className="flex items-center gap-2"
        >
          <Layers className="h-4 w-4" />
          Fill all mesocycles
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onFillRow(cellId, value, true, true)}
          className="flex items-center gap-2"
        >
          <Layers className="h-4 w-4" />
          Fill all (empty only)
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}