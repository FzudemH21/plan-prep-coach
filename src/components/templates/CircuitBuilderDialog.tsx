/**
 * CircuitBuilderDialog
 *
 * Create or edit a circuit block within an exercise library.
 * A circuit is an ordered sequence of exercises performed in a loop,
 * with configurable rest periods (in seconds) and optional comments.
 *
 * Modes
 * ─────
 * • Library-view mode  (libraryId provided) — saves directly to that library.
 * • Standalone mode    (no libraryId)       — returns circuit via onCircuitCreated;
 *   a "Save & Add to Library" button lets the user optionally persist it.
 *
 * Name-conflict resolution
 * ────────────────────────
 * When saving to a library and a circuit with the same name already exists,
 * the user is shown a dialog with two choices:
 *   • Overwrite the existing entry (updates it in place)
 *   • Rename & create new (dismisses the conflict dialog so they can rename)
 */

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Recycle, Plus, Trash2, ChevronUp, ChevronDown, Library, Check, AlertTriangle } from 'lucide-react';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import type { Circuit, CircuitExercise } from '@/contexts/CustomLibrariesContext';
import { ExerciseLibraryPopup } from '@/components/microcycle-planning/ExerciseLibraryPopup';
import type { ExerciseSelection } from '@/types/microcycle-planning';
import { cn } from '@/lib/utils';

interface CircuitBuilderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * When provided the circuit is saved directly to this library (library-view mode).
   * Omit to use standalone mode (e.g. Exercise Distribution): the circuit is
   * returned via onCircuitCreated with an optional savedToLibraryId.
   */
  libraryId?: string;
  /** Provide to open in edit mode; omit for create mode */
  circuit?: Circuit;
  /**
   * Called in standalone mode after the circuit is created / saved.
   * @param circuit          The Circuit object (already in library if savedToLibraryId set)
   * @param savedToLibraryId The library it was saved to, if any
   */
  onCircuitCreated?: (circuit: Circuit, savedToLibraryId?: string) => void;
  /**
   * When true, renders an extra-dark backdrop overlay — useful when the dialog
   * opens on top of another Dialog (e.g. WorkoutSessionSheet).
   */
  darkOverlay?: boolean;
}

/** Strip a trailing "s" for backward-compat with old "60s" format */
function stripS(val: string): string {
  return val.replace(/s$/i, '').trim();
}

export function CircuitBuilderDialog({
  isOpen,
  onClose,
  libraryId,
  circuit,
  onCircuitCreated,
  darkOverlay = false,
}: CircuitBuilderDialogProps) {
  const { libraries, addCircuitToLibrary, updateCircuitInLibrary, deleteCircuitFromLibrary } = useCustomLibraries();

  const isStandaloneMode = !libraryId;
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [rounds, setRounds] = useState('3');
  const [restBetweenRounds, setRestBetweenRounds] = useState('60');
  const [restBetweenExercises, setRestBetweenExercises] = useState('15');
  const [comments, setComments] = useState('');
  const [exercises, setExercises] = useState<CircuitExercise[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Sub-dialog: pick a library to save to (standalone mode)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);

  // Conflict resolution dialog state
  const [conflictInfo, setConflictInfo] = useState<{
    targetLibraryId: string;
    targetLibraryName: string;
    existingCircuit: Circuit;
  } | null>(null);

  // Pre-populate when editing or reset when creating
  useEffect(() => {
    if (!isOpen) return;
    if (circuit) {
      setName(circuit.name);
      setRounds(circuit.rounds ?? '3');
      setRestBetweenRounds(stripS(circuit.restBetweenRounds));
      setRestBetweenExercises(stripS(circuit.restBetweenExercises));
      setComments(circuit.comments ?? '');
      setExercises([...circuit.exercises].sort((a, b) => a.order - b.order));
    } else {
      setName('');
      setRounds('3');
      setRestBetweenRounds('60');
      setRestBetweenExercises('15');
      setComments('');
      setExercises([]);
    }
    setLibraryPickerOpen(false);
    setConflictInfo(null);
  }, [isOpen, circuit]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const buildPayload = () => ({
    name: name.trim(),
    exercises,
    rounds: rounds || '3',
    restBetweenRounds: restBetweenRounds || '0',
    restBetweenExercises: restBetweenExercises || '0',
    comments: comments.trim() || undefined,
  });

  /**
   * Check if a circuit with the same name already exists in the target library.
   * Excludes the currently-edited circuit (by ID) so renaming to the same name
   * in edit mode doesn't trigger a false positive.
   */
  const findNameConflict = (targetLibraryId: string): Circuit | undefined => {
    const lib = libraries.find(l => l.id === targetLibraryId);
    return lib?.circuits?.find(
      c =>
        c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        c.id !== circuit?.id
    );
  };

  const handleExercisesSelected = (selections: ExerciseSelection[]) => {
    const baseOrder = exercises.length;
    const newExercises: CircuitExercise[] = selections.map((sel, i) => ({
      id: `cex_${Date.now()}_${i}`,
      exerciseId: sel.exerciseId,
      exerciseName: sel.exerciseName,
      libraryId: sel.library,
      sets: '3',
      reps: '10',
      time: '',
      distance: '',
      enabledParams: ['reps'],
      order: baseOrder + i,
    }));
    setExercises(prev => [...prev, ...newExercises]);
    setIsPickerOpen(false);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setExercises(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((e, i) => ({ ...e, order: i }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= exercises.length - 1) return;
    setExercises(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((e, i) => ({ ...e, order: i }));
    });
  };

  const handleRemove = (index: number) => {
    setExercises(prev =>
      prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, order: i }))
    );
  };

  const handleFieldChange = (index: number, field: 'sets' | 'reps' | 'time' | 'distance', value: string) => {
    setExercises(prev =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  };

  const handleToggleParam = (index: number, param: string) => {
    setExercises(prev =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const current = e.enabledParams ?? ['reps'];
        const next = current.includes(param)
          ? current.filter(p => p !== param)
          : [...current, param];
        return { ...e, enabledParams: next };
      })
    );
  };

  // ── Save handlers ──────────────────────────────────────────────────────────

  /** "Save Changes" / "Create Circuit" — no library saving in standalone mode */
  const handleSave = () => {
    if (!name.trim()) return;
    const payload = buildPayload();

    if (isStandaloneMode) {
      // Standalone: no library involved, just return the circuit
      const tempCircuit: Circuit = {
        id: `circuit_temp_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      onCircuitCreated?.(tempCircuit, undefined);
      onClose();
      return;
    }

    // Library-view create mode — check for name conflicts
    if (!circuit) {
      const existing = findNameConflict(libraryId!);
      if (existing) {
        const lib = libraries.find(l => l.id === libraryId);
        setConflictInfo({
          targetLibraryId: libraryId!,
          targetLibraryName: lib?.name ?? 'this library',
          existingCircuit: existing,
        });
        return;
      }
      addCircuitToLibrary(libraryId!, payload);
      onClose();
      return;
    }

    // Library-view edit mode — check for name conflicts too
    const existingEdit = findNameConflict(libraryId!);
    if (existingEdit) {
      const lib = libraries.find(l => l.id === libraryId);
      setConflictInfo({
        targetLibraryId: libraryId!,
        targetLibraryName: lib?.name ?? 'this library',
        existingCircuit: existingEdit,
      });
      return;
    }
    updateCircuitInLibrary(libraryId!, circuit.id, payload);
    onClose();
  };

  /**
   * Called when the user picks a library in the library picker sub-dialog.
   * Checks for name conflict before committing.
   */
  const handleSaveToLibrary = (targetLibraryId: string) => {
    if (!name.trim()) return;
    const existing = findNameConflict(targetLibraryId);
    if (existing) {
      const lib = libraries.find(l => l.id === targetLibraryId);
      setLibraryPickerOpen(false);
      setConflictInfo({
        targetLibraryId,
        targetLibraryName: lib?.name ?? 'this library',
        existingCircuit: existing,
      });
      return;
    }
    const payload = buildPayload();
    const newCircuit = addCircuitToLibrary(targetLibraryId, payload);
    onCircuitCreated?.(newCircuit, targetLibraryId);
    setLibraryPickerOpen(false);
    onClose();
  };

  /** Conflict resolution: overwrite the existing circuit in the library */
  const handleOverwrite = () => {
    if (!conflictInfo) return;
    const payload = buildPayload();

    if (!isStandaloneMode && circuit) {
      // Library-view edit mode: save edits onto the current circuit, delete the conflicting one
      updateCircuitInLibrary(conflictInfo.targetLibraryId, circuit.id, payload);
      deleteCircuitFromLibrary(conflictInfo.targetLibraryId, conflictInfo.existingCircuit.id);
    } else {
      // Standalone or library-view create: overwrite the conflicting circuit in place
      updateCircuitInLibrary(conflictInfo.targetLibraryId, conflictInfo.existingCircuit.id, payload);

      if (isStandaloneMode) {
        // Return the updated circuit (same ID as the overwritten one)
        const updated: Circuit = {
          ...conflictInfo.existingCircuit,
          ...payload,
          lastUpdated: new Date().toISOString(),
        };
        onCircuitCreated?.(updated, conflictInfo.targetLibraryId);
      }
    }

    setConflictInfo(null);
    onClose();
  };

  /** Conflict resolution: dismiss, focus the name field so user can rename */
  const handleRenameAndCreateNew = () => {
    setConflictInfo(null);
    // Re-open library picker if we were in standalone mode
    if (isStandaloneMode) setLibraryPickerOpen(false);
    // Focus the name field so user can immediately rename
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Extra-dark backdrop when stacking on top of another dialog */}
      {darkOverlay && isOpen && (
        <div className="fixed inset-0 z-[195] bg-black/60" aria-hidden="true" />
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={`max-w-2xl max-h-[85vh] flex flex-col ${darkOverlay ? 'z-[200]' : ''}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Recycle className="h-5 w-5 text-primary" />
              {circuit ? 'Edit Circuit' : 'New Circuit'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Circuit Name</Label>
              <Input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning Warm-Up Circuit"
                autoFocus
              />
            </div>

            {/* Circuit settings */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Rounds</Label>
                <Input
                  type="number"
                  min={1}
                  value={rounds}
                  onChange={(e) => setRounds(e.target.value)}
                  placeholder="3"
                  className="text-center"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rest Between Rounds</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={restBetweenRounds}
                    onChange={(e) => setRestBetweenRounds(e.target.value)}
                    placeholder="60"
                    className="text-center"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">s</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Rest Between Exercises</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={restBetweenExercises}
                    onChange={(e) => setRestBetweenExercises(e.target.value)}
                    placeholder="15"
                    className="text-center"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">s</span>
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-1.5">
              <Label>Comments <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Notes about this circuit, coaching cues, progressions…"
                className="min-h-[72px] resize-none text-sm"
              />
            </div>

            {/* Exercise list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Exercises ({exercises.length})</Label>
                <Button size="sm" variant="outline" onClick={() => setIsPickerOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Exercise
                </Button>
              </div>

              {exercises.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
                  No exercises yet. Click "Add Exercise" to start building your circuit.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {exercises.map((ex, index) => {
                    const enabledParams = ex.enabledParams ?? ['reps'];
                    return (
                      <div
                        key={ex.id}
                        className="px-3 py-2 border rounded-lg bg-muted/30 space-y-2"
                      >
                        {/* Line 1: number, name, reorder, delete */}
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center text-xs font-semibold text-muted-foreground shrink-0">
                            {index + 1}
                          </span>
                          <span className="flex-1 text-sm font-medium truncate min-w-0">
                            {ex.exerciseName}
                          </span>
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0"
                              disabled={index === 0} onClick={() => handleMoveUp(index)}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0"
                              disabled={index === exercises.length - 1} onClick={() => handleMoveDown(index)}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                            onClick={() => handleRemove(index)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Line 2: toggleable Reps / Time / Distance */}
                        <div className="flex items-start gap-3 pl-7">
                          {/* Toggleable params — chip label on top, input below when enabled */}
                          {([
                            { key: 'reps',     label: 'Reps', unit: undefined },
                            { key: 'time',     label: 'Time', unit: 's'       },
                            { key: 'distance', label: 'Dist', unit: 'm'       },
                          ] as { key: 'reps' | 'time' | 'distance'; label: string; unit?: string }[]).map(({ key, label, unit }) => {
                            const on = enabledParams.includes(key);
                            const fieldValue =
                              key === 'reps' ? ex.reps :
                              key === 'time' ? (ex.time ?? '') :
                              (ex.distance ?? '');
                            return (
                              <div key={key} className="flex flex-col items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleParam(index, key)}
                                  className={cn(
                                    'text-xs px-2 py-0.5 rounded-full border transition-colors',
                                    on
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-transparent text-muted-foreground border-muted-foreground/40 hover:border-muted-foreground/70'
                                  )}
                                >
                                  {label}
                                </button>
                                {on && (
                                  <div className="flex items-center gap-0.5">
                                    <Input
                                      value={fieldValue}
                                      onChange={(e) => handleFieldChange(index, key, e.target.value)}
                                      className="w-12 h-7 text-xs text-center px-1"
                                    />
                                    {unit && (
                                      <span className="text-xs text-muted-foreground">{unit}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {isStandaloneMode && (
              <Button
                variant="outline"
                disabled={!name.trim()}
                onClick={() => setLibraryPickerOpen(true)}
              >
                <Library className="h-4 w-4 mr-1.5" />
                Save &amp; Add to Library
              </Button>
            )}
            <Button onClick={handleSave} disabled={!name.trim()}>
              {circuit ? 'Save Changes' : 'Create Circuit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Library picker sub-dialog (standalone mode) ───────────────────── */}
      {isStandaloneMode && (
        <Dialog open={libraryPickerOpen} onOpenChange={(open) => !open && setLibraryPickerOpen(false)}>
          <DialogContent className={`max-w-sm ${darkOverlay ? 'z-[210]' : ''}`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Library className="h-4 w-4" />
                Choose a Library
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-1">
              {libraries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No exercise libraries found. Create one in the Exercise Database first.
                </p>
              ) : (
                libraries.map(lib => (
                  <button
                    key={lib.id}
                    onClick={() => handleSaveToLibrary(lib.id)}
                    className="w-full text-left rounded-md border bg-card hover:bg-accent hover:border-primary/40 transition-colors px-3 py-2.5 flex items-center gap-2 group"
                  >
                    <Library className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{lib.name}</span>
                    <Check className="h-3.5 w-3.5 text-primary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLibraryPickerOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Name-conflict resolution dialog ───────────────────────────────── */}
      <Dialog open={!!conflictInfo} onOpenChange={(open) => !open && setConflictInfo(null)}>
        <DialogContent className={`max-w-sm ${darkOverlay ? 'z-[220]' : ''}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Circuit name already exists
            </DialogTitle>
            <DialogDescription>
              A circuit named{' '}
              <span className="font-semibold text-foreground">"{conflictInfo?.existingCircuit.name}"</span>{' '}
              already exists in{' '}
              <span className="font-semibold text-foreground">{conflictInfo?.targetLibraryName}</span>.
              What would you like to do?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <Button className="w-full justify-start" onClick={handleOverwrite}>
              Overwrite existing circuit
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleRenameAndCreateNew}>
              Rename &amp; create new
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConflictInfo(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Exercise picker ────────────────────────────────────────────────── */}
      <ExerciseLibraryPopup
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectExercises={handleExercisesSelected}
        selectedExerciseIds={[]}
        onExerciseCreated={(ex) => handleExercisesSelected([ex])}
      />
    </>
  );
}
