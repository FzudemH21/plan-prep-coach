/**
 * LsiCleanupDialog — TEMPORARY (2026-10-29): folds the separately entered LSI parameters into
 * parameters recorded per side, where the LSI is calculated from left / right. Removed again after
 * the clean-up has run once.
 *
 * Pairs: "SL CMJ LSI" goes into "Single-Leg CMJ Height (Hands on Hips)". Without a pair:
 * "SL Heel Raise LSI" itself becomes "SL Heel Raise" (per side, reps). Either way the values entered
 * so far stay as the measure "LSI (entered)" and goals become LSI goals (see parameterMerge.ts).
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAthletes } from '@/hooks/useAthletes';
import { useParameterMerge } from '@/hooks/useParameterMerge';
import type { ParameterMeasure, ParameterV2 } from '@/types/parametersV2';
import { allValuesOf } from '@/utils/goalMeasures';
import { newMeasureId } from '@/utils/parameterMeasures';
import type { ParameterMergePlan } from '@/utils/parameterMerge';

interface Job {
  source: string;
  /** Pair: the parameter recorded per side it goes into */
  target?: string;
  /** The target is recorded per side from now on */
  perSide?: boolean;
  /** No pair: the parameter itself becomes the test */
  convert?: { name: string; mainUnit: string };
}

const JOBS: Job[] = [
  { source: 'SL Hop 10/5 RSI LSI', target: 'SL Hop RSI' },
  { source: 'SL CMJ LSI', target: 'Single-Leg CMJ Height (Hands on Hips)' },
  { source: 'Long Lever Hamstring Bridge Endurance LSI', target: 'Long Lever Hamstring Bridge Endurance', perSide: true },
  { source: 'SL Heel Raise LSI', convert: { name: 'SL Heel Raise', mainUnit: 'reps' } },
  { source: 'Single Leg RDL 1RM LSI', convert: { name: 'Single Leg RDL 1RM', mainUnit: 'kg' } },
  { source: 'Isokinetic sitting hamstring peak torque at 60°/s LSI', convert: { name: 'Isokinetic sitting hamstring peak torque at 60°/s', mainUnit: 'Nm' } },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameters: ParameterV2[];
}

export function LsiCleanupDialog({ open, onOpenChange, parameters }: Props) {
  const { toast } = useToast();
  const merge = useParameterMerge();
  const { athletePerformanceParameters } = useAthletes();
  const [busy, setBusy] = useState<string | null>(null);
  const byName = (name: string) => parameters.find((p) => norm(p.name) === norm(name));

  const run = async (job: Job, source: ParameterV2, target: ParameterV2) => {
    const lsiMeasure: ParameterMeasure = { id: newMeasureId(), name: 'LSI (entered)', kind: 'number', unit: source.unit || '%', betterWhen: 'higher' };
    const plan: ParameterMergePlan = job.convert
      ? { sourceId: source.id, targetId: source.id, measureId: lsiMeasure.id, newMeasure: lsiMeasure, convertSelf: job.convert }
      : { sourceId: source.id, targetId: target.id, measureId: lsiMeasure.id, newMeasure: lsiMeasure, lsiGoals: true, targetName: target.name, ...(job.perSide ? { perSide: true } : {}) };
    setBusy(job.source);
    try {
      const report = await merge([plan]);
      toast({
        title: job.convert ? `"${source.name}" is now "${job.convert.name}"` : `"${source.name}" merged into "${target.name}"`,
        description: [
          `values of ${report.athletesWithValues} athlete(s)`,
          `${report.calendarTests} calendar test(s)`,
          `${report.appResults} app result(s)${report.appResultsSkipped ? ` (${report.appResultsSkipped} not reachable)` : ''}`,
          `${report.monitoringBlocks} monitoring block(s)`,
          `goals in ${report.plans} plan(s)`,
        ].join(' · '),
      });
    } catch (err) {
      toast({ title: 'Clean-up failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[780px]">
        <DialogHeader>
          <DialogTitle>LSI clean-up</DialogTitle>
          <DialogDescription>
            Separately entered LSI parameters become parameters recorded per side (the LSI is then calculated). Values entered so far stay as the measure "LSI (entered)"; goals become LSI goals.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {JOBS.map((job) => {
            const source = byName(job.source);
            const target = job.convert ? source : job.target ? byName(job.target) : undefined;
            const converted = job.convert ? byName(job.convert.name) : undefined;
            const values = source
              ? athletePerformanceParameters.filter((pp) => pp.athleticismParameterId === source.id)
              : [];
            const valueCount = values.reduce((n, pp) => n + allValuesOf(pp).length, 0);
            const done = !source && (job.convert ? !!converted?.perSide : !!target?.mergedParameters?.some((m) => norm(m.name) === norm(job.source)));
            const status = done ? 'Done'
              : !source ? 'LSI parameter not found'
              : !target ? 'Target parameter not found'
              : `${valueCount} value(s) of ${values.length} athlete(s)`;
            return (
              <div key={job.source} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{job.source}</div>
                  <div className="text-muted-foreground">
                    {job.convert
                      ? `→ becomes "${job.convert.name}", per side, ${job.convert.mainUnit}`
                      : `→ LSI of "${job.target}"${job.perSide ? ' (recorded per side from now on)' : ''}`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{status}</div>
                </div>
                <Button size="sm" disabled={done || !source || !target || busy !== null}
                  onClick={() => source && target && run(job, source, target)}>
                  {busy === job.source && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {done ? 'Done' : 'Run'}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
