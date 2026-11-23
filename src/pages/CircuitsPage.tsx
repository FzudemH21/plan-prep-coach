/**
 * CircuitsPage — every circuit in one place (Exercise Libraries → Circuits), whichever library it is
 * stored in: search, open / edit, duplicate, delete, create. New circuits and copies go into the
 * circuit library (CIRCUIT_LIBRARY_ID); older circuits stay in the exercise library they were made
 * in (shown next to their name) — sessions find a circuit by its id in any library.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Edit2, Plus, Recycle, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CircuitBuilderDialog } from '@/components/templates/CircuitBuilderDialog';
import { CIRCUIT_LIBRARY_ID, isCircuitLibrary, useCustomLibraries, type Circuit } from '@/contexts/CustomLibrariesContext';
import { useReadOnly } from '@/hooks/useDataScope';
import { ViewOnlyBadge } from '@/components/shared/ViewOnlyBadge';
import { useToast } from '@/hooks/use-toast';

interface CircuitRow {
  circuit: Circuit;
  libraryId: string;
  /** The exercise library it is stored in — none for the circuit library */
  libraryName?: string;
}

export default function CircuitsPage() {
  const navigate = useNavigate();
  const readOnly = useReadOnly('libraries');
  const { toast } = useToast();
  const { libraries, isLoading, addCircuitToLibrary, deleteCircuitFromLibrary } = useCustomLibraries();
  const [search, setSearch] = useState('');
  const [builder, setBuilder] = useState<{ libraryId: string; circuit?: Circuit } | null>(null);
  const [toDelete, setToDelete] = useState<CircuitRow | null>(null);

  const rows = useMemo<CircuitRow[]>(() => libraries
    .flatMap(lib => (lib.circuits ?? []).map(circuit => ({
      circuit,
      libraryId: lib.id,
      libraryName: isCircuitLibrary(lib) ? undefined : lib.name,
    })))
    .sort((a, b) => a.circuit.name.localeCompare(b.circuit.name)),
  [libraries]);

  const query = search.trim().toLowerCase();
  const shown = query
    ? rows.filter(r => r.circuit.name.toLowerCase().includes(query)
      || r.circuit.exercises.some(ex => ex.exerciseName?.toLowerCase().includes(query)))
    : rows;

  const duplicate = ({ circuit }: CircuitRow) => {
    const { id: _id, createdAt: _c, lastUpdated: _l, ...rest } = circuit;
    addCircuitToLibrary(CIRCUIT_LIBRARY_ID, { ...rest, name: `${circuit.name} (Copy)` });
    toast({ title: 'Circuit duplicated', description: `"${circuit.name} (Copy)" was created.` });
  };

  if (isLoading) {
    return <div className="w-full max-w-none p-6 text-muted-foreground">Loading circuits...</div>;
  }

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/templates/exercise-libraries')} title="Exercise Libraries">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">Circuits <ViewOnlyBadge show={readOnly} /></h1>
        </div>
        {!readOnly && (
          <Button onClick={() => setBuilder({ libraryId: CIRCUIT_LIBRARY_ID })}>
            <Plus className="h-4 w-4 mr-2" />
            New Circuit
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search circuits or exercises..." className="pl-8" />
        </div>
        <span className="text-sm text-muted-foreground">
          {query ? `${shown.length} of ${rows.length}` : rows.length} circuit{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {shown.length === 0 ? (
        <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? 'No circuits yet.' : `No circuit matches "${search}".`}
        </Card>
      ) : (
        <div className="space-y-2">
          {shown.map(row => {
            const { circuit } = row;
            return (
              <div
                key={`${row.libraryId}-${circuit.id}`}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/30"
              >
                <Recycle className="h-4 w-4 shrink-0 text-primary" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => !readOnly && setBuilder({ libraryId: row.libraryId, circuit })}
                  disabled={readOnly}
                >
                  <p className="truncate text-sm font-medium">{circuit.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {circuit.exercises.length} exercise{circuit.exercises.length !== 1 ? 's' : ''}
                    {circuit.rounds ? ` · ${circuit.rounds} rounds` : ''}
                    {' · '}{circuit.restBetweenRounds}s between rounds · {circuit.restBetweenExercises}s between exercises
                    {row.libraryName ? ` · in ${row.libraryName}` : ''}
                  </p>
                </button>
                {!readOnly && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" title="Edit circuit"
                      onClick={() => setBuilder({ libraryId: row.libraryId, circuit })}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" title="Duplicate circuit"
                      onClick={() => duplicate(row)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 text-destructive hover:text-destructive" title="Delete circuit"
                      onClick={() => setToDelete(row)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {builder && (
        <CircuitBuilderDialog
          isOpen
          onClose={() => setBuilder(null)}
          libraryId={builder.libraryId}
          circuit={builder.circuit}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={open => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete circuit</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{toDelete?.circuit.name}" from the library? Sessions that already use it keep their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) {
                  deleteCircuitFromLibrary(toDelete.libraryId, toDelete.circuit.id);
                  toast({ title: 'Circuit deleted' });
                }
                setToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
