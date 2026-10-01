/**
 * IntervalModeSettings — method editor section "Interval timer in the athlete app" (e.g. HIIT).
 *
 * The coach says which parameter is which (labelled like the usual interval parameters): Work
 * Duration / Intensity, Inter-Rep Rest Duration / Intensity, Inter-Set Rest Duration / Intensity
 * and Reps. The choices are stored as a role on each parameter (ToolboxEntry.intervalRole), so they
 * travel with the method (copy, rename) and reach the athlete app through the schedule sync.
 * Inter-Set Rest Duration is the parameter flagged as rest (isRestParameter) — choosing it here
 * sets that flag, so it stays one setting (also used by the normal rest timer between sets).
 * Values always come from the plan (periodization table / session).
 */
import { Timer } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IntervalRole, ToolboxEntry } from '@/types/toolbox';

/** 'setRest' is not a role but the method's rest flag */
type FieldKey = IntervalRole | 'setRest';

// In pairs: duration | intensity per phase, then the reps
const FIELDS: Array<{ key: FieldKey; label: string; required: boolean }> = [
  { key: 'work', label: 'Work Duration', required: true },
  { key: 'workIntensity', label: 'Work Intensity', required: false },
  { key: 'rest', label: 'Inter-Rep Rest Duration', required: true },
  { key: 'restIntensity', label: 'Inter-Rep Rest Intensity', required: false },
  { key: 'setRest', label: 'Inter-Set Rest Duration', required: false },
  { key: 'setRestIntensity', label: 'Inter-Set Rest Intensity', required: false },
  { key: 'reps', label: 'Reps', required: true },
];

const NONE = '__none__';

/** First parameter whose name matches — only a suggestion when switching on; the coach confirms */
function suggest(params: ToolboxEntry[], role: IntervalRole): string | undefined {
  const name = (re: RegExp) => params.find(p => re.test(p.parameterName))?.id;
  switch (role) {
    case 'work': return name(/work.*(duration|time)|^duration|^time/i);
    case 'rest': return name(/(inter.?rep|between reps).*(rest|pause|recovery)|(rest|pause|recovery).*(rep)/i);
    case 'reps': return name(/^reps?\b|repetitions/i);
    case 'workIntensity': return name(/work.*intensity|^intensity/i);
    case 'restIntensity': return name(/(inter.?rep|between reps).*intensity|^(rest|recovery).*intensity/i);
    case 'setRestIntensity': return name(/(inter.?set|between sets).*intensity/i);
    case 'workTarget': return undefined;
  }
}

interface IntervalModeSettingsProps {
  parameters: ToolboxEntry[];
  onChange: (parameters: ToolboxEntry[]) => void;
}

export function IntervalModeSettings({ parameters, onChange }: IntervalModeSettingsProps) {
  const enabled = parameters.some(p => p.intervalRole);
  const restFlagged = parameters.find(p => p.isRestParameter);
  const idFor = (key: FieldKey) => (key === 'setRest'
    ? restFlagged?.id
    : parameters.find(p => p.intervalRole === key)?.id);
  const missing = FIELDS.filter(f => f.required && !idFor(f.key));
  // Durations run as a countdown — they need a time unit (s / min); e.g. 400 m can't be timed
  const TIME = new Set(['s', 'sec', 'min', 'h']);
  const durationParams = [
    parameters.find(p => p.intervalRole === 'work'),
    parameters.find(p => p.intervalRole === 'rest'),
    restFlagged,
  ];
  const notTime = durationParams
    .filter((p): p is ToolboxEntry => !!p && p.parameterType === 'quantitative' && p.options.length > 0
      && !p.options.some(u => TIME.has(u.trim().toLowerCase())))
    .map(p => p.parameterName);
  const options = parameters.filter(p => !p.isFrequencyParameter && !p.isCalculated);

  // "Show during work": orientation only (distance, pace, stroke rate …) — any parameter without
  // another job: no role, not the rest between sets, not the set count
  const targetOptions = options.filter(p =>
    (!p.intervalRole || p.intervalRole === 'workTarget') && !p.isRestParameter && !p.isSetParameter);
  const toggleTarget = (entryId: string, on: boolean) => {
    onChange(parameters.map(p => (p.id === entryId ? { ...p, intervalRole: on ? 'workTarget' : undefined } : p)));
  };

  const setField = (key: FieldKey, entryId: string | undefined) => {
    if (key === 'setRest') {
      // The method's rest flag — exactly one parameter (or none)
      onChange(parameters.map(p => {
        if (p.id === entryId) return { ...p, isRestParameter: true, intervalRole: undefined };
        return p.isRestParameter ? { ...p, isRestParameter: false } : p;
      }));
      return;
    }
    onChange(parameters.map(p => {
      if (p.id === entryId) return { ...p, intervalRole: key };
      if (p.intervalRole === key) return { ...p, intervalRole: undefined };
      return p;
    }));
  };

  const toggle = (on: boolean) => {
    if (!on) {
      onChange(parameters.map(p => (p.intervalRole ? { ...p, intervalRole: undefined } : p)));
      return;
    }
    // Pre-fill obvious matches by name — shown in the selects for the coach to check
    const assigned = new Map<string, IntervalRole>();
    for (const { key } of FIELDS) {
      if (key === 'setRest') continue;
      const id = suggest(options.filter(p => !p.isRestParameter), key);
      if (id && !assigned.has(id)) assigned.set(id, key);
    }
    if (assigned.size === 0) {
      const first = options.find(p => !p.isRestParameter);
      if (first) assigned.set(first.id, 'work');
    }
    onChange(parameters.map(p => (assigned.has(p.id) ? { ...p, intervalRole: assigned.get(p.id) } : p)));
  };

  /** What else a parameter is used for — shown next to it in the selects */
  const usedAs = (p: ToolboxEntry, key: FieldKey): string => {
    if (key !== 'setRest' && p.isRestParameter) return ' (Inter-Set Rest Duration)';
    if (p.intervalRole && p.intervalRole !== key && p.intervalRole !== 'workTarget') {
      return ` (${FIELDS.find(f => f.key === p.intervalRole)?.label ?? 'in use'})`;
    }
    return '';
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" />Interval timer in the athlete app</Label>
          <p className="text-xs text-muted-foreground">
            For interval training (e.g. HIIT): one start runs through all sets — work, rest between reps, rest between sets.
            The values come from the plan.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} />
      </div>
      {enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {FIELDS.map(({ key, label, required }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">
                {label}{required && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Select value={idFor(key) ?? NONE} onValueChange={v => setField(key, v === NONE ? undefined : v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={required ? 'Choose…' : 'None'} /></SelectTrigger>
                <SelectContent className="z-[300]">
                  <SelectItem value={NONE} className="text-sm text-muted-foreground">{required ? 'Choose…' : 'None'}</SelectItem>
                  {options.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.parameterName}{usedAs(p, key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {key === 'setRest' && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {restFlagged
                    ? 'The method\'s rest parameter — also the normal rest timer between sets.'
                    : 'None: the timer runs one set per start.'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {enabled && targetOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Show during work <span className="text-muted-foreground font-normal">(orientation only, e.g. distance, pace, stroke rate — the timer always runs on time)</span></Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {targetOptions.map(p => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={p.intervalRole === 'workTarget'}
                  onCheckedChange={v => toggleTarget(p.id, v === true)}
                  className="h-3.5 w-3.5"
                />
                {p.parameterName}
              </label>
            ))}
          </div>
        </div>
      )}
      {enabled && notTime.length > 0 && (
        <p className="text-xs text-amber-700">
          {notTime.join(' and ')} {notTime.length === 1 ? 'has' : 'have'} no time unit (s / min) — the timer counts down durations, so it won't run for distances.
        </p>
      )}
      {enabled && missing.length > 0 && (
        <p className="text-xs text-amber-700">
          Choose {missing.map(m => m.label).join(', ')} — until then the athlete app shows no timer.
        </p>
      )}
    </div>
  );
}
