import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { Sheet, SheetPortal, SheetOverlay } from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase';

interface HistoryEntry {
  date: string;
  sessionName: string;
  sets: Array<{ setNumber: number; values: Record<string, string> }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  athleteConnectionId: string;
}

export function ExerciseHistorySheet({ open, onClose, exerciseName, athleteConnectionId }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !exerciseName || !athleteConnectionId) return;
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
          const setsLogged = (row.sets_logged as Array<{
            exerciseName: string;
            sets?: Array<{ setNumber: number; values: Record<string, string> }>;
          }>) ?? [];
          const match = setsLogged.find(
            e => e.exerciseName?.toLowerCase() === exerciseName.toLowerCase(),
          );
          if (!match?.sets?.length) continue;
          result.push({
            date: row.date as string,
            sessionName: row.session_name as string,
            sets: match.sets.map(s => ({ setNumber: s.setNumber, values: s.values ?? {} })),
          });
          if (result.length >= 10) break;
        }
        setEntries(result);
        setLoading(false);
      });
  }, [open, exerciseName, athleteConnectionId]);

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetPortal>
        {/* Overlay at z-[120] so it appears above WorkoutSessionSheet (z-[110]) */}
        <SheetOverlay className="z-[120]" />
        {/* Content also at z-[120] */}
        <SheetPrimitive.Content
          className="fixed z-[120] inset-x-0 bottom-0 border-t rounded-t-2xl p-0 flex flex-col bg-background shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-300 data-[state=open]:duration-500 sm:w-[600px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          style={{ maxHeight: '75vh' }}
        >
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>

          <div className="px-5 pt-5 pb-3 border-b shrink-0">
            <div className="flex items-center gap-2 text-base font-semibold">
              <History className="h-4 w-4 text-muted-foreground" />
              {exerciseName}
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
                  const paramKeys = Array.from(
                    new Set(entry.sets.flatMap(s => Object.keys(s.values))),
                  );
                  return (
                    <div key={i}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <p className="text-xs font-semibold">
                          {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate ml-3">{entry.sessionName}</p>
                      </div>
                      {paramKeys.length > 0 ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pb-1 font-medium text-muted-foreground w-5">#</th>
                              {paramKeys.map(k => (
                                <th key={k} className="text-left pb-1 px-1.5 font-medium text-muted-foreground">{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {entry.sets.map(s => (
                              <tr key={s.setNumber} className="border-b last:border-0">
                                <td className="py-1 text-muted-foreground">{s.setNumber}</td>
                                {paramKeys.map(k => (
                                  <td key={k} className="py-1 px-1.5 tabular-nums">
                                    {s.values[k] || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-muted-foreground">{entry.sets.length} set{entry.sets.length === 1 ? '' : 's'} completed</p>
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
