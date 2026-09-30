/**
 * useSelfReportedValues — test results the athlete entered in the athlete app
 * (athlete_test_results), per parameter, for the coach side. Empty when the athlete has no app
 * connection. Used together with the coach-entered values of the athlete profile, e.g. so a SMART
 * goal's baseline is the most recent value from either source.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { toParameterId } from '@/utils/parameterRef';
import type { AthletePerformanceParameter, ParameterValue } from '@/types/athlete';

export function useSelfReportedValues(athleteLocalId: string | null | undefined): Map<string, ParameterValue[]> {
  const { getConnectionForAthlete } = useAthleteConnections();
  const connectionId = athleteLocalId ? getConnectionForAthlete(athleteLocalId)?.id ?? null : null;
  const [byParam, setByParam] = useState<Map<string, ParameterValue[]>>(new Map());

  useEffect(() => {
    if (!connectionId) { setByParam(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('athlete_test_results')
        .select('id, parameter_id, value, recorded_at, note')
        .eq('athlete_connection_id', connectionId);
      if (cancelled) return;
      if (error) { console.error('[useSelfReportedValues] load error', error); return; }
      const map = new Map<string, ParameterValue[]>();
      for (const row of (data ?? []) as Array<{ id: string; parameter_id: string; value: string; recorded_at: string; note: string | null }>) {
        const key = toParameterId(row.parameter_id);
        map.set(key, [...(map.get(key) ?? []), {
          id: row.id, value: row.value, recordedAt: row.recorded_at, selfReported: true, note: row.note ?? undefined,
        }]);
      }
      setByParam(map);
    })();
    return () => { cancelled = true; };
  }, [connectionId]);

  return byParam;
}

/**
 * The athlete's parameters with the self-reported results added to their values; parameters the
 * athlete only reported in the app get an entry of their own.
 */
export function useAthleteParamsWithSelfReported(
  athleteLocalId: string | null | undefined,
  performanceParams: AthletePerformanceParameter[],
): AthletePerformanceParameter[] {
  const selfReported = useSelfReportedValues(athleteLocalId);
  return useMemo(() => {
    if (!athleteLocalId || selfReported.size === 0) return performanceParams;
    const seen = new Set<string>();
    const merged = performanceParams.map((pp) => {
      seen.add(pp.athleticismParameterId);
      const extra = selfReported.get(pp.athleticismParameterId);
      if (!extra?.length) return pp;
      const ids = new Set(pp.values.map((v) => v.id));
      return { ...pp, values: [...pp.values, ...extra.filter((v) => !ids.has(v.id))] };
    });
    for (const [paramId, values] of selfReported) {
      if (!seen.has(paramId)) merged.push({ id: `self-${paramId}`, athleteId: athleteLocalId, athleticismParameterId: paramId, values });
    }
    return merged;
  }, [athleteLocalId, performanceParams, selfReported]);
}
