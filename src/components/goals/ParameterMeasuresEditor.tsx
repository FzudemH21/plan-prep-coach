/**
 * ParameterMeasuresEditor — what is recorded for a parameter: its main measure plus more measures
 * (number with unit, scale such as pain NRS 0–10, own levels, pass / fail) and whether it is recorded
 * per side (left / right; number measures then get the limb symmetry index). Used in "Add parameter"
 * and "Edit parameter". Level sets can be saved as presets (stored with the parameter database).
 */
import { useState } from 'react';
import { ChevronDown, Plus, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { MAIN_MEASURE_ID, type MeasureKind, type ParameterMeasure } from '@/types/parametersV2';
import { MEASURE_KIND_LABELS, SCALE_PRESETS, newMeasureId } from '@/utils/parameterMeasures';

const COMMON_UNITS = ['kg', 's', 'min', 'm', 'cm', 'km', 'm/s', '°', '%', 'reps', 'W', 'bpm', 'mm'];

/** Defaults when a measure gets a type */
function withKind(m: ParameterMeasure, kind: MeasureKind): ParameterMeasure {
  const base: ParameterMeasure = { id: m.id, name: m.name, kind };
  if (kind === 'number') return { ...base, unit: m.unit, betterWhen: m.betterWhen };
  if (kind === 'scale') return { ...base, scaleMin: m.scaleMin ?? 0, scaleMax: m.scaleMax ?? 10, scaleMinLabel: m.scaleMinLabel, scaleMaxLabel: m.scaleMaxLabel, betterWhen: m.betterWhen };
  if (kind === 'levels') return { ...base, levels: m.levels?.length ? m.levels : ['Not possible', 'With compensation', 'Clean'] };
  return base;
}

function LevelsEditor({ measure, onChange }: { measure: ParameterMeasure; onChange: (m: ParameterMeasure) => void }) {
  const { data, saveData } = useParametersDataV2();
  const presets = data.levelPresets ?? [];
  const [text, setText] = useState((measure.levels ?? []).join('\n'));
  const [presetName, setPresetName] = useState('');
  const [naming, setNaming] = useState(false);
  const commit = (value: string) => onChange({ ...measure, levels: value.split('\n').map((l) => l.trim()).filter(Boolean) });

  const savePreset = async () => {
    const levels = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!presetName.trim() || levels.length < 2) return;
    await saveData({ ...data, levelPresets: [...presets, { id: newMeasureId(), name: presetName.trim(), levels }] });
    setNaming(false);
    setPresetName('');
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Levels — one per line, from worst to best</Label>
        {presets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1">Use preset<ChevronDown className="h-3 w-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[300]">
              {presets.map((p) => (
                <DropdownMenuItem key={p.id} className="text-xs" onSelect={() => { setText(p.levels.join('\n')); onChange({ ...measure, levels: p.levels }); }}>
                  {p.name} <span className="ml-1 text-muted-foreground">({p.levels.join(' / ')})</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <Textarea className="min-h-[72px] text-xs" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => commit(text)} />
      {naming ? (
        <div className="flex gap-1.5">
          <Input className="h-7 text-xs" autoFocus placeholder="Preset name, e.g. Movement quality (3 levels)" value={presetName}
            onChange={(e) => setPresetName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void savePreset(); } }} />
          <Button type="button" size="sm" className="h-7 text-xs" onClick={() => { void savePreset(); }} disabled={!presetName.trim()}>Save</Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setNaming(false)}><X className="h-3 w-3" /></Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1 text-muted-foreground" onClick={() => setNaming(true)}>
          <Save className="h-3 w-3" />Save these levels as a preset
        </Button>
      )}
    </div>
  );
}

function MeasureRow({ measure, isMain, parameterUnit, onChange, onRemove }: {
  measure: ParameterMeasure;
  isMain: boolean;
  /** The parameter's unit — the main measure's unit when it is a number */
  parameterUnit?: string;
  onChange: (m: ParameterMeasure) => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(measure.name);
  const [unit, setUnit] = useState(measure.unit ?? '');
  const num = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

  return (
    <div className="rounded-md border bg-background p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground w-12 shrink-0">{isMain ? 'Main' : 'Also'}</span>
        <Input className="h-8 text-sm flex-1 min-w-0" placeholder="Name, e.g. Time, Pain, Quality" value={name}
          onChange={(e) => setName(e.target.value)} onBlur={() => onChange({ ...measure, name: name.trim() || measure.name })} />
        <Select value={measure.kind} onValueChange={(v) => onChange(withKind({ ...measure, name }, v as MeasureKind))}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[300]">
            {(Object.keys(MEASURE_KIND_LABELS) as MeasureKind[]).map((k) => (
              <SelectItem key={k} value={k} className="text-xs">{MEASURE_KIND_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove} title="Remove measure">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {measure.kind === 'number' && (
        <div className="flex flex-wrap items-center gap-2 pl-14">
          {isMain ? (
            <span className="text-xs text-muted-foreground">Unit: <span className="font-medium text-foreground">{parameterUnit || '—'}</span> (the parameter&apos;s unit above)</span>
          ) : (
            <>
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Input className="h-7 w-24 text-xs" list="measure-units" value={unit} onChange={(e) => setUnit(e.target.value)}
                onBlur={() => onChange({ ...measure, unit: unit.trim() || undefined })} placeholder="e.g. s" />
              <datalist id="measure-units">{COMMON_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
            </>
          )}
        </div>
      )}

      {measure.kind === 'scale' && (
        // Each end of the scale on its own line: its number and its label
        <div className="grid grid-cols-[40px_64px_1fr] items-center gap-x-1.5 gap-y-1 pl-14">
          <span className="text-xs text-muted-foreground">From</span>
          <Input className="h-7 text-xs" type="number" defaultValue={measure.scaleMin ?? 0}
            onBlur={(e) => onChange({ ...measure, scaleMin: num(e.target.value) ?? 0 })} />
          <Input className="h-7 text-xs" placeholder="Label, e.g. no pain" defaultValue={measure.scaleMinLabel ?? ''}
            onBlur={(e) => onChange({ ...measure, scaleMinLabel: e.target.value.trim() || undefined })} />
          <span className="text-xs text-muted-foreground">To</span>
          <Input className="h-7 text-xs" type="number" defaultValue={measure.scaleMax ?? 10}
            onBlur={(e) => onChange({ ...measure, scaleMax: num(e.target.value) ?? 10 })} />
          <Input className="h-7 text-xs" placeholder="Label, e.g. worst imaginable pain" defaultValue={measure.scaleMaxLabel ?? ''}
            onBlur={(e) => onChange({ ...measure, scaleMaxLabel: e.target.value.trim() || undefined })} />
        </div>
      )}

      {measure.kind === 'levels' && (
        <div className="pl-14"><LevelsEditor measure={measure} onChange={onChange} /></div>
      )}

      {(measure.kind === 'number' || measure.kind === 'scale') && (
        <div className="flex items-center gap-2 pl-14">
          <Label className="text-xs text-muted-foreground">Better when</Label>
          <Select value={measure.betterWhen ?? 'unset'} onValueChange={(v) => onChange({ ...measure, betterWhen: v === 'unset' ? undefined : v as 'higher' | 'lower' })}>
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[300]">
              <SelectItem value="unset" className="text-xs">Not set</SelectItem>
              <SelectItem value="higher" className="text-xs">Higher</SelectItem>
              <SelectItem value="lower" className="text-xs">Lower</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export function ParameterMeasuresEditor({ measures, perSide, parameterUnit, onChange }: {
  /** The parameter's measures, main measure first (parameterMeasures) */
  measures: ParameterMeasure[];
  perSide: boolean;
  parameterUnit?: string;
  onChange: (measures: ParameterMeasure[], perSide: boolean) => void;
}) {
  const update = (idx: number, m: ParameterMeasure) => onChange(measures.map((x, i) => (i === idx ? m : x)), perSide);
  const add = (m: Omit<ParameterMeasure, 'id'>) => onChange([...measures, { ...m, id: newMeasureId() }], perSide);

  return (
    <div className="space-y-2">
      <div>
        <Label>Measures</Label>
        <p className="text-xs text-muted-foreground">
          What is recorded for this parameter — e.g. for a 30 m sprint the time, the pain and the quality. Goals and tests pick one of them;
          interactions and methods apply to the parameter as a whole.
        </p>
      </div>
      {measures.map((m, i) => (
        <MeasureRow key={m.id} measure={m} isMain={m.id === MAIN_MEASURE_ID} parameterUnit={parameterUnit}
          onChange={(next) => update(i, next)}
          onRemove={m.id === MAIN_MEASURE_ID ? undefined : () => onChange(measures.filter((_, j) => j !== i), perSide)} />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" />Add measure<ChevronDown className="h-3 w-3" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[300]">
          {SCALE_PRESETS.map((p) => (
            <DropdownMenuItem key={p.id} className="text-xs" onSelect={() => add(p.measure)}>{p.label}</DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs" onSelect={() => add({ name: 'Value', kind: 'number' })}>Number with unit</DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onSelect={() => add(withKind({ id: '', name: 'Rating', kind: 'scale' }, 'scale'))}>Scale (own range)</DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onSelect={() => add(withKind({ id: '', name: 'Quality', kind: 'levels' }, 'levels'))}>Levels (own)</DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onSelect={() => add({ name: 'Passed', kind: 'passFail' })}>Pass / fail</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <label className="flex items-start gap-3 rounded-md border p-2.5 cursor-pointer">
        <Switch checked={perSide} onCheckedChange={(v) => onChange(measures, v)} className="mt-0.5" />
        <span className="text-sm">
          Recorded per side (left / right)
          <span className="block text-xs text-muted-foreground">
            Every value gets a side. For number measures the limb symmetry index (LSI = smaller ÷ larger side) is calculated — goals can target a side or the LSI.
          </span>
        </span>
      </label>
    </div>
  );
}
