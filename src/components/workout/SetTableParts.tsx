/**
 * Shared pieces of the set table in the athlete app and the coach-mobile session logging.
 *
 * - RestPrescription: the rest parameter flagged in the Training Toolbox (restParamName — the rest
 *   between sets / rounds, it drives the timer) is not a log column; the athlete sees its value
 *   in a line above the table. Other parameters named "…rest…" (e.g. rest between reps in
 *   intervals) are ordinary columns — the flag decides, not the name.
 * - setTableLayout: up to 4 parameter columns share the phone's width (a typical Reps / Tempo / RiR /
 *   Weight set-up fits a 390 px phone without scrolling — ~60 px per column); with more the table
 *   scrolls sideways with "#" and the tick column pinned, so inputs stay tappable.
 */
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExerciseSummary } from '@/hooks/useAthleteApp';

function plannedValues(ex: ExerciseSummary, name: string): string[] {
  const p = ex.plannedParams ?? {};
  const perSet: string[] = [];
  for (let i = 1; i <= 50; i++) {
    const v = p[`${name}_set${i}`];
    if (v === undefined) break;
    if (v !== '' && v !== null) perSet.push(String(v));
  }
  if (perSet.length > 0) return perSet;
  const plain = p[name];
  return plain !== undefined && plain !== null && plain !== '' ? [String(plain)] : [];
}

/** The flagged rest parameter with its planned value, as "name: value unit" */
export function restPrescriptions(ex: ExerciseSummary): Array<{ name: string; value: string; unit?: string }> {
  if (ex.isCircuit || !ex.plannedParams) return [];
  const names = new Set<string>();
  if (ex.restParamName) names.add(ex.restParamName);
  const out: Array<{ name: string; value: string; unit?: string }> = [];
  for (const name of names) {
    const values = plannedValues(ex, name);
    if (values.length === 0) continue;
    const distinct = [...new Set(values)];
    const unit = ex.plannedParams[`${name}_unit`];
    out.push({ name, value: distinct.join(' / '), unit: unit ? String(unit) : undefined });
  }
  return out;
}

export function RestPrescription({ exercise }: { exercise: ExerciseSummary }) {
  const items = restPrescriptions(exercise);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {items.map((it) => (
        <span key={it.name} className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
          <Timer className="h-3 w-3 shrink-0" />
          {it.name}: <span className="font-medium text-foreground">{it.value}{it.unit ? ` ${it.unit}` : ''}</span>
        </span>
      ))}
    </div>
  );
}

/** Width of a parameter column when the table scrolls sideways */
const WIDE_COL_PX = 88;
/** Most parameter columns that share the phone's width without sideways scrolling */
const MAX_FIT_COLUMNS = 4;

/**
 * Class names for the set table — sideways scrolling with pinned columns above 4 parameter columns.
 * Scrolling: fixed column widths (inputs would otherwise take their natural ~170 px), and the pinned
 * "#" / tick cells get the same tint as their row (solid background + an inset shadow in the row's
 * colour) — a plain white cell looked like a block lying over the tinted rows.
 */
export function setTableLayout(columnCount: number) {
  const wide = columnCount > MAX_FIT_COLUMNS;
  // 4 columns on a phone: tighter cell padding so each input keeps as much width as possible
  const tight = !wide && columnCount === MAX_FIT_COLUMNS;
  const headTint = 'shadow-[inset_0_0_0_999px_hsl(var(--muted)/0.3)]';
  const doneTint = 'shadow-[inset_0_0_0_999px_hsl(var(--primary)/0.05)]';
  return {
    wide,
    wrapper: cn('rounded-lg border bg-background', wide && 'overflow-x-auto overscroll-x-contain'),
    table: cn('text-sm table-fixed', wide ? 'min-w-full' : 'w-full'),
    tableStyle: wide ? { width: `${28 + columnCount * WIDE_COL_PX + 48}px` } : undefined,
    paramCell: wide ? 'w-[88px]' : tight ? '!px-0.5' : '',
    /** Header cells */
    pinLeft: wide ? cn('sticky left-0 z-10 bg-background', headTint) : '',
    pinRight: wide ? cn('sticky right-0 z-10 bg-background', headTint) : '',
    /** Body cells — tinted like a finished row */
    pinLeftCell: (done: boolean) => (wide ? cn('sticky left-0 z-10 bg-background', done && doneTint) : ''),
    pinRightCell: (done: boolean) => (wide ? cn('sticky right-0 z-10 bg-background', done && doneTint) : ''),
  };
}

export function SwipeHint({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-xs text-muted-foreground mt-1 text-right">Swipe the table sideways for more columns →</p>;
}
