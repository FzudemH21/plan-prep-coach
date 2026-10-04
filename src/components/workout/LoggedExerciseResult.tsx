/**
 * A logged session in the phone apps (athlete app + coach mobile): under each exercise, what was
 * done — sets / rounds completed as a coloured status, and the logged sets as a table that opens
 * on tap (e.g. reps, weight, RiR of a squat).
 */
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoggedSet {
  setNumber: number;
  values: Record<string, string>;
  /** false = planned but not done; undefined in older logs (then: done when it has values) */
  completed?: boolean;
}

export interface LoggedEntry {
  exerciseName: string;
  sets?: LoggedSet[];
  isCircuit?: boolean;
  roundsCompleted?: number;
  totalRounds?: number;
}

const isSetDone = (s: LoggedSet) =>
  s.completed === true || (s.completed === undefined && Object.values(s.values ?? {}).some(v => String(v ?? '').trim() !== ''));

function StatusChip({ done, total, unit }: { done: number; total: number; unit: 'sets' | 'rounds' }) {
  const all = total > 0 && done >= total;
  const none = done === 0;
  const label = unit === 'sets' ? (total === 1 ? 'set' : 'sets') : (total === 1 ? 'round' : 'rounds');
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      all && 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
      none && 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
      !all && !none && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    )}>
      {all && <Check className="h-3 w-3" />}
      {none ? `Not done · 0/${total} ${label}` : `${done}/${total} ${label}`}
    </span>
  );
}

export function LoggedExerciseResult({ logged, isCircuit, plannedCount, units }: {
  /** The exercise's entry in the session log (undefined: not in the log → not done) */
  logged: LoggedEntry | undefined;
  isCircuit?: boolean;
  /** Planned sets / rounds — used when the log has no entry for the exercise */
  plannedCount: number;
  /** Units per parameter name (e.g. Weight → kg) */
  units?: Record<string, string | undefined>;
}) {
  const [open, setOpen] = useState(false);

  if (isCircuit || logged?.isCircuit) {
    const total = logged?.totalRounds ?? plannedCount;
    return (
      <div className="px-4 pb-2.5 pl-11">
        <StatusChip done={logged?.roundsCompleted ?? 0} total={total} unit="rounds" />
      </div>
    );
  }

  const sets = logged?.sets ?? [];
  const done = sets.filter(isSetDone).length;
  const total = sets.length > 0 ? sets.length : plannedCount;
  const paramNames = Array.from(new Set(sets.flatMap(s => Object.keys(s.values ?? {}))));
  const hasTable = sets.length > 0 && paramNames.length > 0;

  return (
    <div className="px-4 pb-2.5 pl-11">
      <button
        type="button"
        disabled={!hasTable}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 min-h-[32px] text-left active:opacity-60 disabled:active:opacity-100"
        aria-expanded={hasTable ? open : undefined}
      >
        <StatusChip done={done} total={total} unit="sets" />
        {hasTable && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            {open ? 'Hide sets' : 'Show sets'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
          </span>
        )}
      </button>
      {open && hasTable && (
        <table className="mt-1 text-xs w-full table-fixed">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-normal pb-1 pr-2 w-6">#</th>
              {paramNames.map(p => (
                <th key={p} className="text-left font-normal pb-1 pr-2 leading-tight break-words align-bottom">
                  {p}
                  {units?.[p] && <span className="block">({units[p]})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sets.map(s => {
              const setDone = isSetDone(s);
              return (
                <tr key={s.setNumber} className={cn('border-t border-border/20', !setDone && 'bg-red-50/60 dark:bg-red-950/20')}>
                  <td className="pr-2 py-1 text-muted-foreground">{s.setNumber}</td>
                  {paramNames.map(p => (
                    <td key={p} className={cn('pr-2 py-1 break-words', setDone ? 'font-medium' : 'text-muted-foreground line-through')}>
                      {s.values?.[p] || '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
