import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { Sheet, SheetPortal, SheetOverlay } from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { isSetDone, StatusChip } from '@/components/workout/LoggedExerciseResult';

export interface HistoryEntry {
  date: string;
  sessionName: string;
  sets: Array<{ setNumber: number; values: Record<string, string>; completed?: boolean }>;
  /** The columns shown while logging (newer logs) — also those left empty */
  columns?: string[];
  /** Planned values of that session ("Reps", "Reps_set2", …) — shown for a set ticked without typing */
  plannedParams?: Record<string, string>;
  plannedSets?: number;
}

interface LoggedRow {
  exerciseName?: string;
  sets?: Array<{ setNumber: number; values?: Record<string, string>; completed?: boolean }>;
  columns?: string[];
  plannedParams?: Record<string, string>;
  plannedSets?: number;
}

/** One logged exercise of a session log → a history entry (null when it has no sets) */
export function historyEntryFrom(date: string, sessionName: string, ex: LoggedRow): HistoryEntry | null {
  if (!ex.sets?.length) return null;
  return {
    date,
    sessionName,
    sets: ex.sets.map(s => ({ setNumber: s.setNumber, values: s.values ?? {}, completed: s.completed })),
    columns: ex.columns,
    plannedParams: ex.plannedParams,
    plannedSets: ex.plannedSets,
  };
}

function plannedValue(planned: Record<string, string> | undefined, col: string, setNumber: number): string {
  if (!planned) return '';
  const perSet = planned[`${col}_set${setNumber}`];
  if (perSet !== undefined && perSet !== '') return String(perSet);
  const plain = planned[col];
  return plain !== undefined && plain !== '' ? String(plain) : '';
}

/** Parameter names of planned values ("Reps", "Reps_set2" → "Reps"), without the set count */
function plannedColumns(planned: Record<string, string> | undefined): string[] {
  if (!planned) return [];
  return Array.from(new Set(Object.keys(planned).map(k => k.replace(/_set\d+$/, ''))))
    .filter(k => !k.includes('_') && !/^(sets|frequency)$/i.test(k));
}

interface Props {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  athleteConnectionId: string;
  /** Pre-fetched entries from parent. null = still loading, array = ready (use as-is). */
  prefetchedEntries?: HistoryEntry[] | null;
}

export function ExerciseHistorySheet({ open, onClose, exerciseName, athleteConnectionId, prefetchedEntries }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  // Loading until the first fetch is done (when there is something to fetch) — lists show a spinner, not "nothing here"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    // Parent prefetched the data — use it directly, no network call needed.
    if (prefetchedEntries !== undefined) {
      setEntries(prefetchedEntries ?? []);
      setLoading(prefetchedEntries === null);
      return;
    }

    // Fallback: fetch per-exercise (used when parent doesn't prefetch, e.g. mobile).
    if (!exerciseName || !athleteConnectionId) { setLoading(false); return; }
    setLoading(true);
    setEntries([]);
    supabase
      .from('athlete_session_logs')
      .select('date, session_name, sets_logged')
      .eq('athlete_connection_id', athleteConnectionId)
      .not('completed_at', 'is', null)
      .order('date', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const result: HistoryEntry[] = [];
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          const setsLogged = (row.sets_logged as LoggedRow[]) ?? [];
          // Every placement of the exercise in that session (it can be in a session twice)
          for (const match of setsLogged.filter(e => e.exerciseName?.toLowerCase() === exerciseName.toLowerCase())) {
            const entry = historyEntryFrom(row.date as string, row.session_name as string, match);
            if (entry) result.push(entry);
          }
          if (result.length >= 10) break;
        }
        setEntries(result.slice(0, 10));
        setLoading(false);
      }, () => setLoading(false));
  }, [open, exerciseName, athleteConnectionId, prefetchedEntries]);

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetPortal>
        {/* Overlay at z-[120] so it appears above WorkoutSessionSheet (z-[110]) */}
        <SheetOverlay className="z-[120]" />
        {/* Content also at z-[120] */}
        <SheetPrimitive.Content
          className="fixed z-[120] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] sm:w-[600px] border rounded-2xl p-0 flex flex-col bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{ maxHeight: '75vh' }}
        >
          <SheetPrimitive.Close className="absolute right-3 top-3 w-11 h-11 flex items-center justify-center rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 active:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>

          <div className="px-5 pt-5 pb-3 border-b shrink-0 pr-14">
            <div className="flex items-center gap-2 text-base font-semibold">
              <History className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{exerciseName}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : entries.length > 0
                ? `Last ${entries.length} session${entries.length === 1 ? '' : 's'} logged`
                : 'No history yet'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {!loading && entries.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No logged sessions for this exercise yet.
              </div>
            ) : (
              <div className="px-5 py-4 space-y-5">
                {entries.map((entry, i) => {
                  // The columns shown while logging, plus any value typed in
                  let paramKeys = Array.from(new Set([
                    ...(entry.columns ?? []),
                    ...entry.sets.flatMap(s => Object.keys(s.values)),
                  ]));
                  // Older logs without columns and nothing typed in: the planned parameters
                  if (paramKeys.length === 0) paramKeys = plannedColumns(entry.plannedParams);
                  const done = entry.sets.filter(isSetDone).length;
                  const total = Math.max(entry.sets.length, entry.plannedSets ?? 0);
                  return (
                    <div key={i}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-semibold">
                          {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{entry.sessionName}</p>
                      </div>
                      <div className="mt-1 mb-1.5"><StatusChip done={done} total={total} unit="sets" /></div>
                      {paramKeys.length > 0 && (
                        <table className="w-full text-xs table-fixed">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pb-1 font-medium text-muted-foreground w-6">#</th>
                              {paramKeys.map(k => (
                                <th key={k} className="text-left pb-1 pr-1.5 font-medium text-muted-foreground leading-tight break-words align-bottom">{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {entry.sets.map(s => {
                              const setDone = isSetDone(s);
                              return (
                                <tr key={s.setNumber} className="border-b last:border-0">
                                  <td className="py-1 text-muted-foreground">{s.setNumber}</td>
                                  {paramKeys.map(k => {
                                    // A set ticked without typing counts as done as planned
                                    const value = s.values[k] || (setDone ? plannedValue(entry.plannedParams, k, s.setNumber) : '');
                                    return (
                                      <td key={k} className={cn('py-1 pr-1.5 tabular-nums break-words',
                                        setDone ? 'font-medium' : 'text-muted-foreground line-through')}>
                                        {value || '—'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="h-6" />
          </div>
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}
