/**
 * useParameterMerge — merges a parameter into another one as one of its measures, across every
 * store that points at it (see src/utils/parameterMerge.ts for what happens to each).
 *
 * Order: the parameter database result is computed first (it validates the merge), then the data
 * moves — athletes' values and assigned goals, calendar tests (and the athlete app's copy of
 * upcoming ones), results entered in the athlete app, monitoring blocks, goals in programs — and
 * the parameter database is saved last, so the source parameter only disappears once its data has
 * moved. A failing step stops the merge and is reported with what was already done.
 */
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAthletes } from '@/hooks/useAthletes';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useCalendarEvents, type CalendarEvent } from '@/hooks/useCalendarEvents';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useTrainingPrograms } from '@/hooks/useTrainingPrograms';
import type { ParameterV2 } from '@/types/parametersV2';
import type { ScheduleEventEntry } from '@/utils/athleteScheduleSync';
import { testMeasureSpec } from '@/utils/parameterMeasures';
import { mergeMonitoringConfig, mergeParameterDatabase, remapParameterRef, type ParameterMergePlan } from '@/utils/parameterMerge';

export interface ParameterMergeReport {
  athletesWithValues: number;
  calendarTests: number;
  appResults: number;
  /** Results the update didn't reach (row-level security: the coach-update policy is missing) */
  appResultsSkipped: number;
  monitoringBlocks: number;
  plans: number;
}

/** Upcoming tests in the athlete app's schedule rows → the new reference (and how the app asks the value) */
async function remapScheduleTests(connectionId: string, plan: ParameterMergePlan, target: ParameterV2, since: string): Promise<void> {
  const { data, error } = await supabase
    .from('athlete_schedule')
    .select('id, events')
    .eq('athlete_connection_id', connectionId)
    .gte('date', since);
  if (error) throw error;
  for (const row of data ?? []) {
    const events = (row.events as ScheduleEventEntry[] | null) ?? [];
    let changed = false;
    const next = events.map(e => {
      const ref = remapParameterRef(e.parameterId, plan);
      if (ref === null) return e;
      changed = true;
      // As the calendar sends it (AthleteCalendarView enrichEvents)
      const measure = testMeasureSpec(target, ref);
      const copy: ScheduleEventEntry = { ...e, parameterId: ref, unit: measure ? measure.unit : target.unit };
      delete copy.measure;
      return measure ? { ...copy, measure } : copy;
    });
    if (!changed) continue;
    const { error: upErr } = await supabase.from('athlete_schedule').update({ events: next })
      .eq('id', row.id as string).eq('athlete_connection_id', connectionId);
    if (upErr) throw upErr;
  }
}

export function useParameterMerge() {
  const params = useParametersDataV2();
  const athletes = useAthletes();
  const calendar = useCalendarEvents();
  const programs = useTrainingPrograms();
  const { connections, updateMonitoringConfig } = useAthleteConnections();

  return useCallback(async (plan: ParameterMergePlan): Promise<ParameterMergeReport> => {
    if (!params.data) throw new Error('The parameter database has not loaded yet.');
    // Validates the merge (throws with the reason) before anything is touched
    const mergedDb = mergeParameterDatabase(params.data, plan);
    const target = mergedDb.parameters.find(p => p.id === plan.targetId)!;
    const remap = (ref: string) => remapParameterRef(ref, plan);
    const report: ParameterMergeReport = { athletesWithValues: 0, calendarTests: 0, appResults: 0, appResultsSkipped: 0, monitoringBlocks: 0, plans: 0 };
    const step = async (what: string, run: () => Promise<void>) => {
      try { await run(); } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Merging stopped at "${what}": ${reason}`);
      }
    };

    await step('athlete values', async () => {
      report.athletesWithValues = new Set(athletes.athletePerformanceParameters
        .filter(pp => pp.athleticismParameterId === plan.sourceId).map(pp => pp.athleteId)).size;
      await athletes.mergePerformanceParameterInto(plan);
    });

    let movedEvents: Record<string, CalendarEvent[]> = {};
    await step('calendar tests', async () => {
      movedEvents = await calendar.remapParameterRefs(remap);
      report.calendarTests = Object.values(movedEvents).reduce((n, list) => n + list.length, 0);
    });

    await step('athlete app', async () => {
      // Results the athletes entered (RLS: only the coach's own athletes)
      const { data, error } = await supabase
        .from('athlete_test_results')
        .select('id, parameter_id')
        .or(`parameter_id.eq."${plan.sourceId}",parameter_id.like."${plan.sourceId}::*",parameter_id.eq."bio:${plan.sourceId}"`);
      if (error) throw error;
      const byRef = new Map<string, string[]>();
      for (const row of (data ?? []) as Array<{ id: string; parameter_id: string }>) {
        const ref = remap(row.parameter_id);
        if (ref !== null) byRef.set(ref, [...(byRef.get(ref) ?? []), row.id]);
      }
      for (const [ref, ids] of byRef) {
        // Rows row-level security doesn't let through are left out without an error — counted
        const { data: updated, error: upErr } = await supabase.from('athlete_test_results')
          .update({ parameter_id: ref }).in('id', ids).select('id');
        if (upErr) throw upErr;
        report.appResults += updated?.length ?? 0;
        report.appResultsSkipped += ids.length - (updated?.length ?? 0);
      }
      // Upcoming tests the athletes see (from two weeks back: tests not yet entered)
      const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      for (const c of connections) {
        if (movedEvents[c.athleteLocalId]?.length) await remapScheduleTests(c.id, plan, target, since);
      }
    });

    await step('monitoring', async () => {
      for (const c of connections) {
        if (!c.monitoringConfig) continue;
        const { config, changed } = mergeMonitoringConfig(c.monitoringConfig, plan, target);
        if (!changed) continue;
        await updateMonitoringConfig(c.id, config);
        report.monitoringBlocks += c.monitoringConfig.blocks.filter(b => b.config?.parameterId === plan.sourceId).length;
      }
    });

    await step('goals in programs', async () => {
      report.plans = await programs.mergeParameterGoals(plan);
    });

    await step('parameter database', async () => {
      await params.mergeParameterInto(plan);
    });
    return report;
  }, [params, athletes, calendar, programs, connections, updateMonitoringConfig]);
}
