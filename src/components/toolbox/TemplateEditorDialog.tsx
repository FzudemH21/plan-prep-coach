import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Trash2,
  Settings2,
  SplitSquareHorizontal,
  Columns,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolboxEntry } from '@/types/toolbox';
import { type TemplateColumn, type ProgramTemplate } from '@/hooks/useTemplates';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const SPLIT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function makeColumn(label: string): TemplateColumn {
  return {
    id: generateId(),
    label,
    isSplit: false,
    splitCount: 2,
    parameters: {},
    parametersB: {},
    parametersC: {},
    parametersD: {},
    parametersE: {},
  };
}

function getSplitParams(col: TemplateColumn, letter: string): Record<string, string> {
  switch (letter) {
    case 'A': return col.parameters;
    case 'B': return col.parametersB;
    case 'C': return col.parametersC;
    case 'D': return col.parametersD;
    case 'E': return col.parametersE;
    default: return {};
  }
}

function setSplitParams(col: TemplateColumn, letter: string, value: Record<string, string>): TemplateColumn {
  switch (letter) {
    case 'A': return { ...col, parameters: value };
    case 'B': return { ...col, parametersB: value };
    case 'C': return { ...col, parametersC: value };
    case 'D': return { ...col, parametersD: value };
    case 'E': return { ...col, parametersE: value };
    default: return col;
  }
}

// ─────────────────────────────────────────────
// Fill popover (per parameter row)
// ─────────────────────────────────────────────

interface FillPopoverProps {
  paramName: string;
  columns: TemplateColumn[];
  onFill: (paramName: string, value: string, columnIds: string[], half: string) => void;
}

function FillPopover({ paramName, columns, onFill }: FillPopoverProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(columns.map(c => c.id)));
  const [half, setHalf] = useState<string>('all');

  const maxSplitCount = columns.reduce((max, c) => c.isSplit ? Math.max(max, c.splitCount) : max, 0);
  const hasSplit = maxSplitCount > 0;
  const splitLetters = SPLIT_LETTERS.slice(0, maxSplitCount);

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      setValue('');
      setSelected(new Set(columns.map(c => c.id)));
      setHalf('all');
    }
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleFill = () => {
    if (!value.trim()) return;
    onFill(paramName, value.trim(), Array.from(selected), half);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-50 hover:opacity-100" title="Fill cells">
          <Settings2 className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 z-[200]" align="start" side="right">
        <div className="space-y-3">
          <p className="text-sm font-medium">Fill — {paramName}</p>

          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <Input
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Enter value…"
              className="h-8 text-xs"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleFill(); }}
            />
          </div>

          {hasSplit && (
            <div className="space-y-1">
              <Label className="text-xs">Apply to half</Label>
              <div className="flex gap-2 flex-wrap">
                {(['all', ...splitLetters] as string[]).map(h => (
                  <button
                    key={h}
                    onClick={() => setHalf(h)}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded border transition-colors',
                      half === h ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted',
                    )}
                  >
                    {h === 'all' ? 'All' : h}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Columns</Label>
              <div className="flex gap-1">
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set(columns.map(c => c.id)))}>All</button>
                <span className="text-xs text-muted-foreground">·</span>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>None</button>
              </div>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {columns.map(col => (
                <div key={col.id} className="flex items-center gap-2 py-0.5 cursor-pointer" onClick={() => toggle(col.id)}>
                  <Checkbox checked={selected.has(col.id)} onCheckedChange={() => toggle(col.id)} className="h-3.5 w-3.5" />
                  <span className="text-xs">{col.label || '(untitled)'}</span>
                  {col.isSplit && <Badge variant="secondary" className="text-[10px] h-4 px-1">split</Badge>}
                </div>
              ))}
            </div>
          </div>

          <Button size="sm" className="w-full h-8 text-xs" disabled={!value.trim() || selected.size === 0} onClick={handleFill}>
            Fill
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────
// Column header (editable label + controls)
// ─────────────────────────────────────────────

interface ColHeaderProps {
  col: TemplateColumn;
  canDelete: boolean;
  canSplit: boolean;
  onLabelChange: (id: string, label: string) => void;
  onToggleSplit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ColHeader({ col, canDelete, canSplit, onLabelChange, onToggleSplit, onDelete }: ColHeaderProps) {
  const splitLetters = SPLIT_LETTERS.slice(0, col.splitCount);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <Input
          value={col.label}
          onChange={e => onLabelChange(col.id, e.target.value)}
          className="h-7 w-24 text-xs text-center font-medium"
          placeholder="Microcycle…"
        />
        {(canSplit || col.isSplit) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
            title={col.isSplit ? 'Merge' : 'Split'}
            onClick={() => onToggleSplit(col.id)}
          >
            {col.isSplit ? <Columns className="h-3 w-3" /> : <SplitSquareHorizontal className="h-3 w-3" />}
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            title="Remove column"
            onClick={() => onDelete(col.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {col.isSplit && (
        <div className="flex gap-0.5 w-full">
          {splitLetters.map(letter => (
            <span key={letter} className="flex-1 text-center text-[10px] text-muted-foreground border rounded-sm py-0.5 bg-muted/30">
              {letter}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, edits an existing template */
  initialTemplate?: ProgramTemplate;
  /** The method this template belongs to */
  methodId: string;
  methodName: string;
  /** Parameters of the method (from toolbox) */
  parameters: ToolboxEntry[];
  onSave: (data: Omit<ProgramTemplate, 'id' | 'createdAt'>) => void;
}

export function TemplateEditorDialog({
  open,
  onOpenChange,
  initialTemplate,
  methodId,
  methodName,
  parameters,
  onSave,
}: TemplateEditorDialogProps) {
  const isEdit = !!initialTemplate;

  const defaultColumns = (): TemplateColumn[] =>
    initialTemplate?.columns ?? [
      makeColumn('Microcycle 1'),
      makeColumn('Microcycle 2'),
      makeColumn('Microcycle 3'),
      makeColumn('Microcycle 4'),
    ];

  const [name, setName] = useState(() => initialTemplate?.name ?? '');
  const [columns, setColumns] = useState<TemplateColumn[]>(defaultColumns);

  // Reset state each time the dialog opens (new or edit)
  useEffect(() => {
    if (open) {
      setName(initialTemplate?.name ?? '');
      setColumns(
        initialTemplate?.columns ?? [
          makeColumn('Microcycle 1'),
          makeColumn('Microcycle 2'),
          makeColumn('Microcycle 3'),
          makeColumn('Microcycle 4'),
        ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Visible parameters (show all, sorted by position)
  const visibleParams = parameters.filter(p => p.showInGridByDefault !== false);

  // ── Frequency param for split visibility ─────────────────────
  const freqParamName = parameters.find(p => p.isFrequencyParameter)?.parameterName ?? null;

  const getCanSplit = (col: TemplateColumn): boolean => {
    if (!freqParamName) return false;
    const val = parseFloat(col.parameters[freqParamName] ?? '');
    return !isNaN(val) && val >= 2 && val <= 10;
  };

  // ── Column mutations ─────────────────────────────────────────

  const handleLabelChange = useCallback((id: string, label: string) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, label } : c));
  }, []);

  const handleToggleSplit = useCallback((id: string) => {
    setColumns(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (c.isSplit) {
        return { ...c, isSplit: false };
      }
      const freq = freqParamName ? parseFloat(c.parameters[freqParamName] ?? '') : NaN;
      const splitCount = !isNaN(freq) && freq >= 2 && freq <= 10 ? Math.floor(freq) : 2;
      return { ...c, isSplit: true, splitCount };
    }));
  }, [freqParamName]);

  const handleDeleteColumn = useCallback((id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleAddColumn = useCallback(() => {
    setColumns(prev => [...prev, makeColumn(`Microcycle ${prev.length + 1}`)]);
  }, []);

  // ── Cell mutations ────────────────────────────────────────────

  const handleCellChange = useCallback(
    (colId: string, paramName: string, value: string, letter: string) => {
      setColumns(prev =>
        prev.map(c => {
          if (c.id !== colId) return c;
          const params = { ...getSplitParams(c, letter), [paramName]: value };
          return setSplitParams(c, letter, params);
        }),
      );
    },
    [],
  );

  const handleFill = useCallback(
    (paramName: string, value: string, columnIds: string[], half: string) => {
      setColumns(prev =>
        prev.map(c => {
          if (!columnIds.includes(c.id)) return c;
          const letters = half === 'all'
            ? SPLIT_LETTERS.slice(0, c.isSplit ? c.splitCount : 1)
            : [half];
          let updated = { ...c };
          for (const letter of letters) {
            const params = { ...getSplitParams(updated, letter), [paramName]: value };
            updated = setSplitParams(updated, letter, params);
          }
          return updated;
        }),
      );
    },
    [],
  );

  // ── Save ─────────────────────────────────────────────────────

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), methodId, methodName, columns });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // ── Render ────────────────────────────────────────────────────

  const PARAM_COL_WIDTH = 180;
  const CELL_WIDTH = 90;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-4">
            <DialogTitle className="shrink-0">
              {isEdit ? 'Edit Template' : 'New Template'} — {methodName}
            </DialogTitle>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Template name…"
              className="h-8 flex-1 max-w-xs"
            />
          </div>
        </DialogHeader>

        {/* Table */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="overflow-x-auto">
              <table
                className="border-collapse"
                style={{
                  minWidth: PARAM_COL_WIDTH + columns.reduce((sum, c) => sum + (c.isSplit ? CELL_WIDTH * c.splitCount : CELL_WIDTH), 0) + 60,
                }}
              >
                {/* Column headers */}
                <thead>
                  <tr className="bg-muted/50">
                    {/* Sticky param label cell */}
                    <th
                      className="sticky left-0 z-20 bg-muted/80 border-r border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
                      style={{ minWidth: PARAM_COL_WIDTH, width: PARAM_COL_WIDTH }}
                    >
                      Parameter
                    </th>
                    {columns.map(col => (
                      <th
                        key={col.id}
                        colSpan={col.isSplit ? col.splitCount : 1}
                        className="border-r border-b px-2 py-2 text-center align-top"
                        style={{ minWidth: col.isSplit ? CELL_WIDTH * col.splitCount : CELL_WIDTH }}
                      >
                        <ColHeader
                          col={col}
                          canDelete={columns.length > 1}
                          canSplit={getCanSplit(col)}
                          onLabelChange={handleLabelChange}
                          onToggleSplit={handleToggleSplit}
                          onDelete={handleDeleteColumn}
                        />
                      </th>
                    ))}
                    {/* Add column */}
                    <th className="border-b px-2 py-2 align-middle">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Add column"
                        onClick={handleAddColumn}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </th>
                  </tr>
                </thead>

                {/* Parameter rows */}
                <tbody>
                  {visibleParams.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.reduce((acc, c) => acc + (c.isSplit ? c.splitCount : 1), 1) + 1}
                        className="text-center py-8 text-sm text-muted-foreground"
                      >
                        This method has no parameters. Add parameters in the Toolbox to use templates.
                      </td>
                    </tr>
                  ) : (
                    visibleParams.map((param, rowIdx) => (
                      <tr key={param.id} className={cn('border-b', rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                        {/* Parameter name (sticky) */}
                        <td
                          className="sticky left-0 z-10 border-r px-3 py-1.5"
                          style={{ minWidth: PARAM_COL_WIDTH, width: PARAM_COL_WIDTH, background: rowIdx % 2 === 0 ? 'hsl(var(--background))' : 'hsl(var(--muted) / 0.2)' }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-foreground truncate flex-1" title={param.parameterName}>
                              {param.parameterName}
                            </span>
                            <FillPopover
                              paramName={param.parameterName}
                              columns={columns}
                              onFill={handleFill}
                            />
                          </div>
                        </td>

                        {/* Cells per column */}
                        {columns.map(col => {
                          if (col.isSplit) {
                            // Frequency parameter is never split — render as a single merged cell
                            if (param.isFrequencyParameter) {
                              return (
                                <td key={col.id} colSpan={col.splitCount} className="border-r px-1 py-1" style={{ minWidth: CELL_WIDTH * col.splitCount }}>
                                  <Input
                                    value={col.parameters[param.parameterName] ?? ''}
                                    onChange={e => handleCellChange(col.id, param.parameterName, e.target.value, 'A')}
                                    className="h-7 text-xs text-center px-1"
                                    placeholder="—"
                                  />
                                </td>
                              );
                            }
                            return (
                              <React.Fragment key={col.id}>
                                {SPLIT_LETTERS.slice(0, col.splitCount).map(letter => (
                                  <td key={letter} className="border-r px-1 py-1" style={{ minWidth: CELL_WIDTH }}>
                                    <Input
                                      value={getSplitParams(col, letter)[param.parameterName] ?? ''}
                                      onChange={e => handleCellChange(col.id, param.parameterName, e.target.value, letter)}
                                      className="h-7 text-xs text-center px-1"
                                      placeholder="—"
                                    />
                                  </td>
                                ))}
                              </React.Fragment>
                            );
                          }
                          return (
                            <td key={col.id} className="border-r px-1 py-1" style={{ minWidth: CELL_WIDTH }}>
                              <Input
                                value={col.parameters[param.parameterName] ?? ''}
                                onChange={e => handleCellChange(col.id, param.parameterName, e.target.value, 'A')}
                                className="h-7 text-xs text-center px-1"
                                placeholder="—"
                              />
                            </td>
                          );
                        })}

                        {/* Empty add-column placeholder */}
                        <td />
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-3 border-t shrink-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {isEdit ? 'Save Changes' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
