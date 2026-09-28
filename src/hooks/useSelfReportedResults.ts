/**
 * useSelfReportedResults
 *
 * Test results an athlete entered in the athlete app live in `athlete_test_results`, not in the
 * coach's athlete record. Anything that shows an athlete's latest / baseline value (performance
 * list, test dialog baseline, …) has to merge both, or a parameter the athlete measured himself
 * looks like it has no value.
 *
 * Keyed like CalendarEventDialog's parameter ids: performance parameter id, or `bio:${defId}` for
 * body metrics.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import type { ParameterValue } from '@/types/athlete';

export type SelfReportedMap = Map<string, ParameterValue[]>;

export function useSelfReportedResults(athleteId: string | null | undefined): SelfReportedMap {
  const { getConnectionForAthlete } = useAthleteConnections();
  const connectionId = athleteId ? getConnectionForAthlete(athleteId)?.id ?? null : null;
  const [map, setMap] = useState<SelfReportedMap>(new Map());

  useEffect(() => {
    if (!connectionId) { setMap(new Map()); return; }
    let cancelled = false;
    supabase
      .from('athlete_test_results')
      .select('id, parameter_id, value, recorded_at, note')
      .eq('athlete_connection_id', connectionId)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: SelfReportedMap = new Map();
        for (const row of data as Array<{ id: string; parameter_id: string; value: string; recorded_at: string; note: string | null }>) {
          const list = next.get(row.parameter_id) ?? [];
          list.push({ id: row.id, value: row.value, recordedAt: row.recorded_at, selfReported: true, note: row.note ?? undefined });
          next.set(row.parameter_id, list);
        }
        setMap(next);
      });
    return () => { cancelled = true; };
  }, [connectionId]);

  return map;
}

/** Coach-recorded values plus the athlete's self-reported ones (no duplicates) */
export function withSelfReported(values: ParameterValue[], selfReported: ParameterValue[] | undefined): ParameterValue[] {
  if (!selfReported || selfReported.length === 0) return values;
  const ids = new Set(values.map(v => v.id));
  return [...values, ...selfReported.filter(v => !ids.has(v.id))];
}

/** Latest value by recorded date */
export function latestValueOf(values: ParameterValue[]): ParameterValue | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => (new Date(a.recordedAt) > new Date(b.recordedAt) ? a : b));
}
