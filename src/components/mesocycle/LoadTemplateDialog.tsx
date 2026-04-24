import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutTemplate, Plus, X, AlertTriangle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ProgramTemplate, type TemplateColumn } from '@/hooks/useTemplates';
import { format } from 'date-fns';

const SPLIT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function makeBlankColumn(label: string): TemplateColumn {
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

export interface MethodParam {
  parameterName: string;
  isFrequencyParameter?: boolean;
  /** Whether this is a quantitative (numeric) parameter */
  isQuantitative?: boolean;
  /** Units (for quantitative) or choices (for qualitative) */
  options?: string[];
}

interface LoadTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name of the method (wizard format: "Category - SubCategory") */
  methodName: string;
  /** Templates already filtered for this method */
  templates: ProgramTemplate[];
  /** Total microcycle count across all mesocycles in the plan */
  planMicrocycleCount: number;
  /** Called with the (possibly adjusted) columns to apply */
  onLoad: (columns: TemplateColumn[]) => void;
  /** Parameters of this method — used to render the preview table rows */
  parameters?: MethodParam[];
  /** Called when the user saves adjusted columns as a new template */
  onSaveAsNew?: (name: string, columns: TemplateColumn[]) => void;
}

export function LoadTemplateDialog({
  open,
  onOpenChange,
  methodName,
  templates,
  planMicrocycleCount,
  onLoad,
  parameters,
  onSaveAsNew,
}: LoadTemplateDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localColumns, setLocalColumns] = useState<TemplateColumn[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveAsNewOpen, setSaveAsNewOpen] = useState(false);
  const [saveAsNewName, setSaveAsNewName] = useState('');

  const selected = templates.find(t => t.id === selectedId) ?? null;

  // When dialog opens: pre-select if only one template; reset transient state
  useEffect(() => {
    if (open) {
      setSelectedId(templates.length === 1 ? templates[0].id : null);
      setConfirmOpen(false);
      setSaveAsNewOpen(false);
      setSaveAsNewName('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local columns when selection changes OR when dialog reopens.
  useEffect(() => {
    const sel = templates.find(t => t.id === selectedId) ?? null;
    setLocalColumns(sel ? sel.columns.map(c => ({ ...c })) : []);
    setSaveAsNewOpen(false);
  }, [selectedId, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const mismatch = selected !== null && localColumns.length !== planMicrocycleCount;
  const effectiveCount = Math.min(localColumns.length, planMicrocycleCount);

  // ── Column mutations ─────────────────────────────────────────
  const handleAddColumn = () => {
    setLocalColumns(prev => [...prev, makeBlankColumn(`Microcycle ${prev.length + 1}`)]);
  };

  const handleRemoveColumn = (id: string) => {
    setLocalColumns(prev => prev.filter(c => c.id !== id));
  };

  const handleLabelChange = (id: string, label: string) => {
    setLocalColumns(prev => prev.map(c => c.id === id ? { ...c, label } : c));
  };

  // ── Cell mutation ────────────────────────────────────────────
  const handleCellChange = (colId: string, paramName: string, value: string, letter: string) => {
    setLocalColumns(prev =>
      prev.map(c => {
        if (c.id !== colId) return c;
        const params = { ...getSplitParams(c, letter), [paramName]: value };
        return setSplitParams(c, letter, params);
      }),
    );
  };

  // ── Load / Save actions ──────────────────────────────────────
  const handleConfirmLoad = () => {
    onLoad(localColumns);
    setConfirmOpen(false);
    onOpenChange(false);
  };

  const handleSaveAsNew = () => {
    if (!saveAsNewName.trim() || !onSaveAsNew) return;
    onSaveAsNew(saveAsNewName.trim(), localColumns);
    setSaveAsNewOpen(false);
    setSaveAsNewName('');
  };

  // ── Display helpers ──────────────────────────────────────────
  const displayName = methodName.includes(' - ')
    ? methodName.split(' - ').slice(1).join(' - ')
    : methodName;

  // Derive preview parameter rows (use prop when available, fall back to column data)
  const previewParams = useMemo<MethodParam[]>(() => {
    if (parameters && parameters.length > 0) return parameters;
    const names = new Set<string>();
    localColumns.forEach(col => {
      [col.parameters, col.parametersB, col.parametersC, col.parametersD, col.parametersE]
        .forEach(p => Object.keys(p).forEach(k => { if (k) names.add(k); }));
    });
    return Array.from(names).map(n => ({ parameterName: n }));
  }, [parameters, localColumns]);

  // Table sizing
  const PARAM_COL_WIDTH = 160;
  const CELL_WIDTH = 100;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[92vw] w-[1060px] max-h-[88vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>Load Template — {displayName}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* ── Template list sidebar ── */}
            <div className="w-52 border-r flex flex-col shrink-0">
              <div className="px-3 py-2 border-b bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Templates
                </p>
              </div>
              <ScrollArea className="flex-1">
                {templates.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground space-y-2">
                    <LayoutTemplate className="h-8 w-8 mx-auto opacity-20" />
                    <p>No templates for this method.</p>
                    <p className="text-xs">Create one in Training Toolbox → Templates.</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {templates.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => setSelectedId(tpl.id)}
                        className={cn(
                          'w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors',
                          selectedId === tpl.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted',
                        )}
                      >
                        <div className="font-medium truncate">{tpl.name}</div>
                        <div className={cn(
                          'text-xs mt-0.5',
                          selectedId === tpl.id ? 'text-primary-foreground/70' : 'text-muted-foreground',
                        )}>
                          {tpl.columns.length} microcycle{tpl.columns.length !== 1 ? 's' : ''}
                          {tpl.columns.some(c => c.isSplit) && ' · split'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* ── Main panel ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <LayoutTemplate className="h-8 w-8 opacity-20" />
                  <p className="text-sm">Select a template to preview</p>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">

                    {/* Mismatch warning */}
                    {mismatch && (
                      <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                          This template has <strong>{localColumns.length}</strong> microcycle{localColumns.length !== 1 ? 's' : ''},
                          {' '}your plan has <strong>{planMicrocycleCount}</strong>.
                          {localColumns.length < planMicrocycleCount
                            ? ' Remaining microcycles will be left unchanged.'
                            : ' Extra columns will be ignored.'}
                          {' '}Add or remove columns in the table below to adjust.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* ── Editable preview table ── */}
                    {previewParams.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Preview
                          <span className="ml-1.5 normal-case font-normal text-muted-foreground/70">
                            — edit values directly, changes apply only to this load
                          </span>
                        </p>
                        <div className="overflow-auto border rounded-md">
                          <table
                            className="border-collapse text-xs"
                            style={{
                              minWidth:
                                PARAM_COL_WIDTH +
                                localColumns.reduce(
                                  (sum, c) => sum + (c.isSplit ? CELL_WIDTH * c.splitCount : CELL_WIDTH),
                                  0,
                                ) + CELL_WIDTH, /* extra for add-col button */
                            }}
                          >
                            {/* ── Column headers ── */}
                            <thead>
                              <tr className="bg-muted/60">
                                <th
                                  className="sticky left-0 z-20 bg-muted/80 border-r border-b px-3 py-2 text-left font-semibold text-muted-foreground"
                                  style={{ minWidth: PARAM_COL_WIDTH, width: PARAM_COL_WIDTH }}
                                >
                                  Parameter
                                </th>
                                {localColumns.map((col, colIdx) => {
                                  const isOut = colIdx >= planMicrocycleCount;
                                  return (
                                    <th
                                      key={col.id}
                                      colSpan={col.isSplit ? col.splitCount : 1}
                                      className={cn(
                                        'border-r border-b px-1 py-1.5 text-center align-top',
                                        isOut && 'opacity-40',
                                      )}
                                      style={{ minWidth: col.isSplit ? CELL_WIDTH * col.splitCount : CELL_WIDTH }}
                                    >
                                      <div className="flex flex-col items-center gap-0.5">
                                        <div className="flex items-center gap-0.5">
                                          <Input
                                            value={col.label}
                                            onChange={e => handleLabelChange(col.id, e.target.value)}
                                            className="h-6 text-[11px] text-center px-1 w-20 font-medium"
                                            placeholder="MC…"
                                            disabled={isOut}
                                          />
                                          <button
                                            onClick={() => handleRemoveColumn(col.id)}
                                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                            title="Remove column"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                        {isOut && (
                                          <span className="text-[10px] text-amber-600">ignored</span>
                                        )}
                                        {col.isSplit && (
                                          <div className="flex gap-0.5 w-full">
                                            {SPLIT_LETTERS.slice(0, col.splitCount).map(letter => (
                                              <span
                                                key={letter}
                                                className="flex-1 text-center text-[10px] text-muted-foreground border rounded-sm py-0.5 bg-muted/30"
                                              >
                                                {letter}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </th>
                                  );
                                })}
                                {/* Add column button */}
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

                            {/* ── Parameter rows ── */}
                            <tbody>
                              {previewParams.map((param, rowIdx) => {
                                const unit = param.isQuantitative && param.options?.[0]
                                  ? param.options[0]
                                  : undefined;
                                const bgEven = 'hsl(var(--background))';
                                const bgOdd = 'hsl(var(--muted) / 0.2)';
                                const rowBg = rowIdx % 2 === 0 ? bgEven : bgOdd;
                                return (
                                  <tr
                                    key={param.parameterName}
                                    className={cn('border-b', rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20')}
                                  >
                                    {/* Sticky parameter name */}
                                    <td
                                      className="sticky left-0 z-10 border-r px-3 py-1 font-medium text-foreground"
                                      style={{ minWidth: PARAM_COL_WIDTH, width: PARAM_COL_WIDTH, background: rowBg }}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="truncate text-xs" title={param.parameterName}>
                                          {param.parameterName}
                                        </span>
                                        {unit && (
                                          <span className="text-[10px] text-muted-foreground/60 shrink-0 font-normal">
                                            {unit}
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Cells */}
                                    {localColumns.map((col, colIdx) => {
                                      const isOut = colIdx >= planMicrocycleCount;
                                      if (col.isSplit && !param.isFrequencyParameter) {
                                        return (
                                          <React.Fragment key={col.id}>
                                            {SPLIT_LETTERS.slice(0, col.splitCount).map(letter => {
                                              const val = getSplitParams(col, letter)[param.parameterName] ?? '';
                                              return (
                                                <td
                                                  key={letter}
                                                  className={cn('border-r px-1 py-1', isOut && 'opacity-40')}
                                                  style={{ minWidth: CELL_WIDTH }}
                                                >
                                                  <div className="flex items-center gap-0.5">
                                                    <Input
                                                      value={val}
                                                      onChange={e => handleCellChange(col.id, param.parameterName, e.target.value, letter)}
                                                      className="h-6 text-xs text-center px-1 flex-1 min-w-0"
                                                      placeholder="—"
                                                      disabled={isOut}
                                                    />
                                                    {unit && (
                                                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                                        {unit}
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                              );
                                            })}
                                          </React.Fragment>
                                        );
                                      }
                                      const val = col.parameters[param.parameterName] ?? '';
                                      return (
                                        <td
                                          key={col.id}
                                          className={cn('border-r px-1 py-1', isOut && 'opacity-40')}
                                          style={{ minWidth: CELL_WIDTH }}
                                        >
                                          <div className="flex items-center gap-0.5">
                                            <Input
                                              value={val}
                                              onChange={e => handleCellChange(col.id, param.parameterName, e.target.value, 'A')}
                                              className="h-6 text-xs text-center px-1 flex-1 min-w-0"
                                              placeholder="—"
                                              disabled={isOut}
                                            />
                                            {unit && (
                                              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                                {unit}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}

                                    {/* Empty placeholder under add-col button */}
                                    <td />
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ── Columns to load (compact overview) ── */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Columns to load
                        {planMicrocycleCount > 0 && (
                          <span className="ml-1 normal-case font-normal">
                            ({effectiveCount} of {planMicrocycleCount} microcycles will be filled)
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {localColumns.map((col, i) => {
                          const isOut = i >= planMicrocycleCount;
                          return (
                            <div
                              key={col.id}
                              className={cn(
                                'flex items-center gap-1 px-2 py-0.5 rounded border text-xs',
                                isOut ? 'opacity-40 bg-amber-50 dark:bg-amber-950/20 border-amber-300' : 'bg-muted/40',
                              )}
                            >
                              <span className="text-muted-foreground">{i + 1}.</span>
                              <span className="font-medium">{col.label || `MC ${i + 1}`}</span>
                              {col.isSplit && (
                                <span className="text-muted-foreground/60">
                                  [{SPLIT_LETTERS.slice(0, col.splitCount).join('')}]
                                </span>
                              )}
                              {isOut && <span className="text-amber-600">ignored</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Template metadata */}
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      Original: <span className="font-medium">{selected.name}</span>
                      {' · '}Created {format(new Date(selected.createdAt), 'dd.MM.yyyy')}
                      {' · '}Edits here only affect this load — the original template is unchanged.
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          {saveAsNewOpen ? (
            <div className="px-6 py-3 border-t shrink-0 flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">New template name:</span>
              <Input
                value={saveAsNewName}
                onChange={e => setSaveAsNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveAsNew();
                  if (e.key === 'Escape') { setSaveAsNewOpen(false); setSaveAsNewName(''); }
                }}
                placeholder="Template name…"
                className="h-8 text-xs flex-1"
                autoFocus
              />
              <Button size="sm" disabled={!saveAsNewName.trim()} onClick={handleSaveAsNew}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSaveAsNewOpen(false); setSaveAsNewName(''); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <DialogFooter className="px-6 py-3 border-t shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {onSaveAsNew && selected && localColumns.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSaveAsNewName(`${selected.name} (copy)`);
                    setSaveAsNewOpen(true);
                  }}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save as new template
                </Button>
              )}
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!selected || localColumns.length === 0 || effectiveCount === 0}
              >
                Load Template
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Overwrite confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite existing values?</AlertDialogTitle>
            <AlertDialogDescription>
              Loading &ldquo;{selected?.name}&rdquo; will overwrite existing parameter values
              for <strong>{displayName}</strong> across{' '}
              <strong>{effectiveCount}</strong> microcycle{effectiveCount !== 1 ? 's' : ''}.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLoad}>
              Load Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
