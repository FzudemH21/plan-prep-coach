/**
 * IntervalModeSettings — method editor section "Interval timer in the athlete app" (e.g. HIIT).
 *
 * The coach says which parameter is the work duration, the rest between reps, the number of reps
 * and (optionally) the work / rest intensity. The choice is stored as a role on each parameter
 * (ToolboxEntry.intervalRole), so it travels with the method (copy, rename) and reaches the athlete
 * app through the schedule sync. Values always come from the plan (periodization table / session).
 * The rest between sets stays the parameter flagged as rest.
 */
import { Timer } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IntervalRole, ToolboxEntry } from '@/types/toolbox';

const ROLES: Array<{ role: IntervalRole; label: string; hint: string; required: boolean }> = [
  { role: 'work', label: 'Work duration', hint: 'e.g. Work Duration', required: true },
  { role: 'rest', label: 'Rest between reps', hint: 'e.g. Inter-Rep Rest Duration', required: true },
  { role: 'reps', label: 'Repetitions', hint: 'e.g. Reps', required: true },
  { role: 'workIntensity', label: 'Work intensity', hint: 'optional, e.g. Work Intensity', required: false },
  { role: 'restIntensity', label: 'Rest intensity', hint: 'optional, e.g. Inter-Rep Rest Intensity', required: false },
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
    case 'restIntensity': return name(/(rest|recovery).*intensity/i);
  }
}

interface IntervalModeSettingsProps {
  parameters: ToolboxEntry[];
  onChange: (parameters: ToolboxEntry[]) => void;
}

export function IntervalModeSettings({ parameters, onChange }: IntervalModeSettingsProps) {
  const enabled = parameters.some(p => p.intervalRole);
  const idFor = (role: IntervalRole) => parameters.find(p => p.intervalRole === role)?.id;
  const missing = ROLES.filter(r => r.required && !idFor(r.role));
  // Duration / count parameters only — qualitative ones (e.g. Mode: Rowing) can't drive a timer
  const options = parameters.filter(p => !p.isFrequencyParameter && !p.isCalculated);

  const setRole = (role: IntervalRole, entryId: string | undefined) => {
    onChange(parameters.map(p => {
      if (p.id === entryId) return { ...p, intervalRole: role };
      if (p.intervalRole === role) return { ...p, intervalRole: undefined };
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
    for (const { role } of ROLES) {
      const id = suggest(options, role);
      if (id && !assigned.has(id)) assigned.set(id, role);
    }
    if (assigned.size === 0 && options[0]) assigned.set(options[0].id, 'work');
    onChange(parameters.map(p => (assigned.has(p.id) ? { ...p, intervalRole: assigned.get(p.id) } : p)));
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" />Interval timer in the athlete app</Label>
          <p className="text-xs text-muted-foreground">
            For interval training (e.g. HIIT): the athlete starts a timer per set — work, rest between reps, repeat.
            The values come from the plan; the rest between sets stays the parameter marked as rest.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} />
      </div>
      {enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {ROLES.map(({ role, label, hint, required }) => (
            <div key={role} className="space-y-1">
              <Label className="text-xs">
                {label}{required && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Select value={idFor(role) ?? NONE} onValueChange={v => setRole(role, v === NONE ? undefined : v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={hint} /></SelectTrigger>
                <SelectContent className="z-[300]">
                  <SelectItem value={NONE} className="text-sm text-muted-foreground">{required ? 'Choose…' : 'None'}</SelectItem>
                  {options.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.parameterName}
                      {p.intervalRole && p.intervalRole !== role ? ' (in use)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
      {enabled && missing.length > 0 && (
        <p className="text-xs text-amber-700">
          Choose {missing.map(m => m.label.toLowerCase()).join(', ')} — until then the athlete app shows no timer.
        </p>
      )}
    </div>
  );
}
