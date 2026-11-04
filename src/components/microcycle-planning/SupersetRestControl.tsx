/**
 * A superset's own rest (seconds): after its round (after the last exercise) and between its
 * exercises. Empty = default (after the round the longest rest planned for its exercises, no rest
 * between them). Stored on every exercise of the superset (`supersetRestAfter` / `supersetRestBetween`),
 * so it is copied with them. Used in exercise distribution (⋮ menu), the workout session window and
 * the Master Planner.
 */
import { Hourglass } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SupersetRest { after?: number; between?: number }

/** The rest set for a superset, from whichever of its exercises carries it (it is written onto all of
 *  them, but older edits may have reached one exercise only) */
export function supersetRestOf(
  memberIds: string[],
  entries: Array<{ id?: string; exerciseId: string; supersetRestAfter?: number; supersetRestBetween?: number }>,
): SupersetRest {
  const ids = new Set(memberIds);
  const withValue = entries.find(e => ids.has(e.id || e.exerciseId)
    && ((e.supersetRestAfter ?? 0) > 0 || (e.supersetRestBetween ?? 0) > 0));
  return withValue ? { after: withValue.supersetRestAfter, between: withValue.supersetRestBetween } : {};
}

/** "A2" → "A": the exercises of one superset share the letter of their labels */
export function supersetLetter(label: string): string {
  return label.replace(/\d+$/, '');
}

/** "" → unset; otherwise whole seconds ≥ 1 */
const secondsFrom = (raw: string): number | undefined =>
  (raw.trim() === '' ? undefined : Math.max(0, Math.round(Number(raw)) || 0) || undefined);

/** The two fields (for a popover / menu panel) */
export function SupersetRestPanel({ rest, onChange }: { rest: SupersetRest; onChange: (rest: SupersetRest) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Superset rest</p>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span>After the last exercise</span>
        <span className="flex items-center gap-1">
          <Input type="number" min={0} inputMode="numeric" className="h-7 w-16 text-xs text-right"
            value={rest.after ?? ''} placeholder="—"
            onChange={e => onChange({ ...rest, after: secondsFrom(e.target.value) })} />
          s
        </span>
      </label>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span>Between exercises</span>
        <span className="flex items-center gap-1">
          <Input type="number" min={0} inputMode="numeric" className="h-7 w-16 text-xs text-right"
            value={rest.between ?? ''} placeholder="—"
            onChange={e => onChange({ ...rest, between: secondsFrom(e.target.value) })} />
          s
        </span>
      </label>
      <p className="text-[10px] text-muted-foreground">
        Empty: after the round the longest rest planned for its exercises, no rest between them. Copied with the exercises.
      </p>
    </div>
  );
}

/** A small button ("Rest 90 s · 15 s between" / "Superset rest") opening the panel */
export function SupersetRestControl({ rest, onChange, className }: {
  rest: SupersetRest;
  onChange: (rest: SupersetRest) => void;
  className?: string;
}) {
  const set = !!rest.after || !!rest.between;
  const label = set
    ? [rest.after ? `Rest ${rest.after} s` : null, rest.between ? `${rest.between} s between` : null].filter(Boolean).join(' · ')
    : 'Superset rest';
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-muted transition-colors',
            set ? 'text-foreground' : 'text-muted-foreground',
            className,
          )}
          title="Rest after the superset round and between its exercises"
        >
          <Hourglass className="h-3 w-3" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 z-[160] bg-popover" align="start" onClick={e => e.stopPropagation()}>
        <SupersetRestPanel rest={rest} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
