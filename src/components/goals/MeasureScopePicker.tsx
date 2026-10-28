/**
 * MeasureScopePicker — which measures of a parameter a method link / interaction applies to ("all
 * measures" or e.g. "Time, Pain"). Shown only when the parameter has more than its main measure.
 */
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ParameterV2 } from '@/types/parametersV2';
import { hasCustomMeasures, parameterMeasures, scopeLabel } from '@/utils/parameterMeasures';
import { cn } from '@/lib/utils';

export function MeasureScopePicker({ target, measureIds, onChange, className }: {
  /** The parameter whose measures can be picked (for an interaction: the parameter that is improved) */
  target: ParameterV2;
  measureIds?: string[];
  onChange: (measureIds: string[] | undefined) => void;
  className?: string;
}) {
  if (!hasCustomMeasures(target)) return null;
  const measures = parameterMeasures(target);
  const selected = (measureIds ?? []).filter((id) => measures.some((m) => m.id === id));
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    // All ticked = the same as no scope
    onChange(next.length === 0 || next.length === measures.length ? undefined : next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()}
          className={cn('inline-flex items-center gap-0.5 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent', className)}
          title="Which measures this applies to">
          for: {scopeLabel({ measureIds: selected }, target)}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 z-[300]" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 py-1 text-[11px] text-muted-foreground">Applies to these measures of {target.name}:</p>
        <button type="button" className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
          onClick={() => onChange(undefined)}>
          <span className="w-3.5">{selected.length === 0 && <Check className="h-3.5 w-3.5" />}</span>All measures
        </button>
        {measures.map((m) => (
          <button key={m.id} type="button" className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
            onClick={() => toggle(m.id)}>
            <span className="w-3.5">{selected.includes(m.id) && <Check className="h-3.5 w-3.5" />}</span>{m.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
