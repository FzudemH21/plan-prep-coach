/**
 * Shared pieces of the set table in the athlete app and the coach-mobile session logging.
 *
 * - RestPrescription: rest parameters (rest between reps / sets, rest intensity …) are not log
 *   columns — the athlete doesn't enter them, and the rest between sets drives the timer — but
 *   the athlete needs to know them (e.g. intervals: 4 × 120 s, 120 s rest between reps at RPE 6).
 *   Shown as a compact line above the table instead of being dropped.
 * - setTableLayout: up to 3 parameter columns share the phone's width (as before); with more the
 *   table scrolls sideways with "#" and the tick column pinned, so inputs stay tappable.
 */
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExerciseSummary } from '@/hooks/useAthleteApp';

const REST_RE = /rest|pause|recovery/i;

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

/** The exercise's rest parameters with a planned value, as "name: value unit" */
export function restPrescriptions(ex: ExerciseSummary): Array<{ name: string; value: string; unit?: string }> {
  if (ex.isCircuit || !ex.plannedParams) return [];
  const names = new Set<string>();
  if (ex.restParamName) names.add(ex.restParamName);
  const source = ex.visibleParams && ex.visibleParams.length > 0
    ? ex.visibleParams
    : Object.keys(ex.plannedParams).filter((k) => !k.endsWith('_unit') && !/_set\d+$/.test(k));
  for (const n of source) if (REST_RE.test(n)) names.add(n);
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

/** Class names for the set table — sideways scrolling with pinned columns above 3 parameter columns */
export function setTableLayout(columnCount: number) {
  const wide = columnCount > 3;
  return {
    wide,
    wrapper: cn('rounded-lg border bg-background', wide && 'overflow-x-auto overscroll-x-contain'),
    table: cn('text-sm', wide ? 'min-w-full w-max table-auto' : 'w-full table-fixed'),
    paramCell: wide ? 'min-w-[76px]' : '',
    pinLeft: wide ? 'sticky left-0 z-10 bg-background' : '',
    pinRight: wide ? 'sticky right-0 z-10 bg-background' : '',
  };
}

export function SwipeHint({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-xs text-muted-foreground mt-1 text-right">Swipe the table sideways for more columns →</p>;
}
