/**
 * useParameterMerge — merges a parameter into another one as one of its measures (or sides), across
 * every store that points at it (see src/utils/parameterMerge.ts for what happens to each).
 *
 * Takes several plans (e.g. "mark the target's values as left" + "merge the right parameter as the
 * right side"), applied in order to every store in one pass — so no store is saved from a copy
 * older than the previous plan's result.
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
import type { ParametersDatabaseV2 } from '@/types/parametersV2';
import type { ScheduleEventEntry } from '@/utils/athleteScheduleSync';
import { parseMeasureRef, testMeasureSpec } from '@/utils/parameterMeasures';
import { applyPlans, mergeMonitoringConfig, mergeParameterDatabase, remapThroughPlans, type ParameterMergePlan } from '@/utils/parameterMerge';

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
async function remapScheduleTests(connectionId: string, plans: ParameterMergePlan[], db: ParametersDatabaseV2, since: string): Promise<void> {
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
      const ref = e.parameterId ? remapThroughPlans(e.parameterId, plans) : null;
      const target = ref ? db.parameters.find(p => p.id === parseMeasureRef(ref).parameterId) : undefined;
      if (ref === null || !target) return e;
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

  return useCallback(async (plans: ParameterMergePlan[]): Promise<ParameterMergeReport> => {
    if (!params.data) throw new Error('The parameter database has not loaded yet.');
    // Validates every plan (throws with the reason) before anything is touched
    const mergedDb = applyPlans(params.data, plans, mergeParameterDatabase);
    const remap = (ref: string) => remapThroughPlans(ref, plans);
    const sourceIds = [...new Set(plans.map(p => p.sourceId))];
    // Parameters whose data moves elsewhere (a marked target keeps its own)
    const movedIds = plans.filter(p => !p.markTarget && !p.convertSelf).map(p => p.sourceId);
    const report: ParameterMergeReport = { athletesWithValues: 0, calendarTests: 0, appResults: 0, appResultsSkipped: 0, monitoringBlocks: 0, plans: 0 };
    const step = async (what: string, run: () => Promise<void>) => {
      try { await run(); } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Merging stopped at "${what}": ${reason}`);
      }
    };

    await step('athlete values', async () => {
      report.athletesWithValues = new Set(athletes.athletePerformanceParameters
        .filter(pp => movedIds.includes(pp.athleticismParameterId)).map(pp => pp.athleteId)).size;
      await athletes.mergePerformanceParameterInto(plans);
    });

    let movedEvents: Record<string, CalendarEvent[]> = {};
    await step('calendar tests', async () => {
      movedEvents = await calendar.remapParameterRefs(remap);
      report.calendarTests = Object.values(movedEvents).reduce((n, list) => n + list.length, 0);
    });

    await step('athlete app', async () => {
      // Results the athletes entered (RLS: only the coach's own athletes)
      const filter = sourceIds
        .flatMap(id => [`parameter_id.eq."${id}"`, `parameter_id.like."${id}::*"`, `parameter_id.eq."bio:${id}"`])
        .join(',');
      const { data, error } = await supabase.from('athlete_test_results').select('id, parameter_id').or(filter);
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
        if (movedEvents[c.athleteLocalId]?.length) await remapScheduleTests(c.id, plans, mergedDb, since);
      }
    });

    await step('monitoring', async () => {
      for (const c of connections) {
        if (!c.monitoringConfig) continue;
        let changedAny = false;
        const config = applyPlans(c.monitoringConfig, plans, (cfg, plan) => {
          const r = mergeMonitoringConfig(cfg, plan, mergedDb.parameters.find(p => p.id === plan.targetId));
          changedAny ||= r.changed;
          return r.config;
        });
        if (!changedAny) continue;
        await updateMonitoringConfig(c.id, config);
        report.monitoringBlocks += c.monitoringConfig.blocks.filter(b => b.config && movedIds.includes(b.config.parameterId)).length;
      }
    });

    await step('goals in programs', async () => {
      report.plans = await programs.mergeParameterGoals(plans);
    });

    await step('parameter database', async () => {
      await params.mergeParameterInto(plans);
    });
    return report;
  }, [params, athletes, calendar, programs, connections, updateMonitoringConfig]);
}
