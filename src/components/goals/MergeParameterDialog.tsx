/**
 * MergeParameterDialog — merges a parameter into another one as one of its measures
 * ("30 m Sprint Pain" → measure "Pain" of "30 m Sprint"). Everything that points at it moves along
 * (see useParameterMerge); the parameter is removed afterwards.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useParameterMerge } from '@/hooks/useParameterMerge';
import { cn } from '@/lib/utils';
import { MAIN_MEASURE_ID, type ParameterMeasure, type ParameterV2 } from '@/types/parametersV2';
import { MEASURE_KIND_LABELS, measureSummary, newMeasureId, parameterMeasures } from '@/utils/parameterMeasures';
import { mergeBlocker, type ParameterMergePlan } from '@/utils/parameterMerge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ParameterV2;
  parameters: ParameterV2[];
}

const NEW = '__new__';
/** Merged as the left / right side of the target */
const SIDE_L = '__side_L';
const SIDE_R = '__side_R';

/** "SL Hop RSI - Left" → "SL Hop RSI", "Single-Leg CMJ Height - Left (Hands on Hips)" → "Single-Leg CMJ Height (Hands on Hips)" */
function withoutSide(name: string): string {
  return name.replace(/\s*[-–]\s*(left|right)\b/i, '').replace(/\b(left|right)\b\s*/i, '').replace(/\s{2,}/g, ' ').trim();
}

/** "30 m Sprint Pain" merged into "30 m Sprint" → "Pain" */
function suggestedName(source: ParameterV2, target: ParameterV2 | undefined): string {
  if (target && source.name.toLowerCase().startsWith(target.name.toLowerCase())) {
    const rest = source.name.slice(target.name.length).replace(/^[\s\-–·:,(]+|[\s)]+$/g, '');
    if (rest) return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return source.name;
}

export function MergeParameterDialog({ open, onOpenChange, source, parameters }: Props) {
  const { toast } = useToast();
  const merge = useParameterMerge();
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [measureChoice, setMeasureChoice] = useState<string>(NEW);
  const [name, setName] = useState('');
  const [betterWhen, setBetterWhen] = useState<'higher' | 'lower'>('higher');
  // New measure: a number in the source's unit, or a pain scale 0–10
  const [newKind, setNewKind] = useState<'number' | 'pain'>('number');
  // Side merge: the target's values so far are the other side; the target's new name
  const [markOther, setMarkOther] = useState(true);
  const [rename, setRename] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch(''); setTargetId(null); setMeasureChoice(NEW); setName(''); setBetterWhen('higher'); setNewKind('number'); setMarkOther(true); setRename(''); setBusy(false);
  }, [open, source.id]);

  const target = parameters.find(p => p.id === targetId);
  const targetMeasures = target ? parameterMeasures(target) : [];
  const blocker = target ? mergeBlocker(source, target) : null;
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parameters
      .filter(p => p.id !== source.id && (!q || p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [parameters, source.id, search]);

  const pickTarget = (p: ParameterV2) => {
    setTargetId(p.id);
    // "… - Right" into "… - Left": as the right side
    setMeasureChoice(/\bright\b/i.test(source.name) ? SIDE_R : /\bleft\b/i.test(source.name) ? SIDE_L : NEW);
    setName(suggestedName(source, p));
    setNewKind(/pain/i.test(source.unit ?? '') || /pain/i.test(source.name) ? 'pain' : 'number');
    setMarkOther(!p.perSide);
    setRename(withoutSide(p.name));
  };
  const side: 'L' | 'R' | undefined = measureChoice === SIDE_L ? 'L' : measureChoice === SIDE_R ? 'R' : undefined;

  const chosenMeasure = measureChoice === NEW ? undefined : targetMeasures.find(m => m.id === measureChoice);
  // Moving numbers onto a measure with another unit / kind changes what they mean
  const unitWarning = chosenMeasure && (chosenMeasure.kind !== 'number' || (chosenMeasure.unit ?? '') !== (source.unit ?? ''))
    ? `The values of "${source.name}" are moved as they are (${source.unit || 'no unit'}) — "${chosenMeasure.name}" is ${chosenMeasure.kind === 'number' ? `in ${chosenMeasure.unit || 'no unit'}` : `a ${MEASURE_KIND_LABELS[chosenMeasure.kind].toLowerCase()} measure`}.`
    : null;
  const nameTaken = measureChoice === NEW && targetMeasures.some(m => m.name.trim().toLowerCase() === name.trim().toLowerCase());
  const canMerge = !!target && !blocker && !busy && (measureChoice !== NEW || (name.trim() !== '' && !nameTaken)) && (!side || rename.trim() !== '');

  const handleMerge = async () => {
    if (!target || !canMerge) return;
    const newMeasure: ParameterMeasure | undefined = measureChoice !== NEW ? undefined
      : newKind === 'pain'
        ? { id: newMeasureId(), name: name.trim(), kind: 'scale', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'no pain', scaleMaxLabel: 'worst imaginable pain', betterWhen: 'lower' }
        : { id: newMeasureId(), name: name.trim(), kind: 'number', ...(source.unit ? { unit: source.unit } : {}), betterWhen };
    const plans: ParameterMergePlan[] = side
      ? [
        // The target's values so far are the other side
        ...(markOther && !target.perSide
          ? [{ sourceId: target.id, targetId: target.id, measureId: MAIN_MEASURE_ID, side: side === 'L' ? 'R' as const : 'L' as const, markTarget: true }]
          : []),
        { sourceId: source.id, targetId: target.id, measureId: MAIN_MEASURE_ID, side, renameTarget: rename.trim() },
      ]
      : [{ sourceId: source.id, targetId: target.id, measureId: newMeasure ? newMeasure.id : measureChoice, newMeasure }];
    setBusy(true);
    try {
      const report = await merge(plans);
      const moved = [
        report.athletesWithValues ? `values of ${report.athletesWithValues} athlete${report.athletesWithValues === 1 ? '' : 's'}` : '',
        report.calendarTests ? `${report.calendarTests} calendar test${report.calendarTests === 1 ? '' : 's'}` : '',
        report.appResults ? `${report.appResults} result${report.appResults === 1 ? '' : 's'} from the athlete app` : '',
        report.monitoringBlocks ? `${report.monitoringBlocks} monitoring block${report.monitoringBlocks === 1 ? '' : 's'}` : '',
        report.plans ? `goals in ${report.plans} plan${report.plans === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      toast({
        title: `Merged into ${side ? rename.trim() : target.name}`,
        description: (moved.length ? `Moved: ${moved.join(', ')}.` : 'Nothing else pointed at it.')
          + (report.appResultsSkipped
            ? ` ${report.appResultsSkipped} result${report.appResultsSkipped === 1 ? '' : 's'} from the athlete app could not be moved (missing permission to edit results — run the migration 20260929_test_results_scheduled_for_and_edit.sql).`
            : ''),
        ...(report.appResultsSkipped ? { variant: 'destructive' as const } : {}),
      });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Merge failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge "{source.name}" into another parameter</DialogTitle>
          <DialogDescription>
            "{source.name}" becomes a measure of the parameter you pick. Its values, tests, results from the athlete app,
            goals, monitoring blocks, interactions and method links move along; "{source.name}" is removed afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Merge into</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parameters…" className="pl-8 h-9" />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border">
              {candidates.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No parameter found.</p>
              ) : candidates.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickTarget(p)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60',
                    p.id === targetId && 'bg-primary/10 font-medium',
                  )}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{[p.category, p.unit].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          </div>

          {target && blocker && <p className="text-sm text-destructive">{blocker}</p>}

          {target && !blocker && (
            <div className="space-y-2">
              <Label className="text-xs">As measure of "{target.name}"</Label>
              <RadioGroup value={measureChoice} onValueChange={setMeasureChoice} className="gap-1.5">
                <label className={cn('flex items-start gap-2 rounded-md border p-2.5 text-sm cursor-pointer', measureChoice === NEW && 'border-primary')}>
                  <RadioGroupItem value={NEW} className="mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>New measure</div>
                    {measureChoice === NEW && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[10rem] space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input value={name} onChange={e => setName(e.target.value)} className="h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={newKind} onValueChange={(v) => setNewKind(v as 'number' | 'pain')}>
                            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="number">Number{source.unit ? ` (${source.unit})` : ''}</SelectItem>
                              <SelectItem value="pain">Pain scale 0–10</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {newKind === 'number' && <div className="space-y-1">
                          <Label className="text-xs">Progress is</Label>
                          <Select value={betterWhen} onValueChange={(v) => setBetterWhen(v as 'higher' | 'lower')}>
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="higher">Higher is better</SelectItem>
                              <SelectItem value="lower">Lower is better</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>}
                      </div>
                    )}
                    {measureChoice === NEW && nameTaken && <p className="text-xs text-destructive">"{target.name}" already has a measure with this name.</p>}
                  </div>
                </label>
                {targetMeasures.map(m => (
                  <label key={m.id} className={cn('flex items-start gap-2 rounded-md border p-2.5 text-sm cursor-pointer', measureChoice === m.id && 'border-primary')}>
                    <RadioGroupItem value={m.id} className="mt-0.5" />
                    <div>
                      {m.name} <span className="text-muted-foreground">({MEASURE_KIND_LABELS[m.kind].toLowerCase()}{measureSummary(m) ? `, ${measureSummary(m)}` : ''})</span>
                      <div className="text-xs text-muted-foreground">Existing measure — the values are added to its series (e.g. for a duplicate parameter)</div>
                    </div>
                  </label>
                ))}
                {([[SIDE_L, 'L'], [SIDE_R, 'R']] as const).map(([value, sd]) => (
                  <label key={value} className={cn('flex items-start gap-2 rounded-md border p-2.5 text-sm cursor-pointer', measureChoice === value && 'border-primary')}>
                    <RadioGroupItem value={value} className="mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <div>As the {sd === 'L' ? 'left' : 'right'} side <span className="text-muted-foreground">("{target.name}" is then recorded per side, LSI calculated)</span></div>
                      {measureChoice === value && (
                        <div className="space-y-2">
                          {!target.perSide && (
                            <div className="flex items-center gap-2 text-xs">
                              <input type="checkbox" aria-label="Values so far are the other side" checked={markOther} onChange={e => setMarkOther(e.target.checked)} />
                              <span>Values recorded so far for "{target.name}" are the {sd === 'L' ? 'right' : 'left'} side</span>
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs">New name of "{target.name}"</Label>
                            <Input value={rename} onChange={e => setRename(e.target.value)} className="h-8" />
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>
              {unitWarning && <p className="text-xs text-amber-600 dark:text-amber-400">{unitWarning}</p>}
              {source.perSide && !target.perSide && (
                <p className="text-xs text-muted-foreground">"{source.name}" is recorded per side — "{target.name}" will be recorded per side too.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <p className="mr-auto self-center text-xs text-muted-foreground">This cannot be undone.</p>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleMerge} disabled={!canMerge}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
