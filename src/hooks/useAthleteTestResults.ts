/**
 * useAthleteTestResults — athlete app: the athlete's test results (athlete_test_results) for the
 * Plan and Today tabs: which tests already have a result on a date, and the latest value of a
 * parameter (the athlete's own results or the coach-recorded values from the metrics snapshot).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AthleteConnection } from '@/hooks/useAthleteApp';

export function useAthleteTestResults(connection: AthleteConnection | null) {
  // `${parameterId}:${yyyy-MM-dd}` → value
  const [resultsByDate, setResultsByDate] = useState<Map<string, string>>(new Map());
  // parameterId → latest own result (any date)
  const [latestOwn, setLatestOwn] = useState<Map<string, { value: string; recordedAt: string }>>(new Map());

  useEffect(() => {
    if (!connection?.id) return;
    let cancelled = false;
    supabase
      .from('athlete_test_results')
      .select('parameter_id, value, recorded_at')
      .eq('athlete_connection_id', connection.id)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        const byDate = new Map<string, string>();
        const latest = new Map<string, { value: string; recordedAt: string }>();
        for (const row of (data ?? []) as { parameter_id: string; value: string; recorded_at: string }[]) {
          const key = `${row.parameter_id}:${row.recorded_at.slice(0, 10)}`;
          if (!byDate.has(key)) byDate.set(key, row.value);
          if (!latest.has(row.parameter_id)) latest.set(row.parameter_id, { value: row.value, recordedAt: row.recorded_at });
        }
        setResultsByDate(byDate);
        setLatestOwn(latest);
      });
    return () => { cancelled = true; };
  }, [connection?.id]);

  /** "8.5 s · 15 Jun" — newest of the athlete's own results and the coach-recorded values */
  const lastValueLabelFor = useCallback((parameterId: string | undefined, unit?: string): string | null => {
    if (!parameterId) return null;
    const candidates: Array<{ value: string; recordedAt: string }> = [];
    const own = latestOwn.get(parameterId);
    if (own) candidates.push(own);
    connection?.profileData?.metricsSnapshot?.performanceParams
      ?.find(item => item.parameterId === parameterId)
      ?.values.forEach(v => candidates.push(v));
    if (candidates.length === 0) return null;
    const newest = candidates.reduce((a, b) => (new Date(a.recordedAt) > new Date(b.recordedAt) ? a : b));
    const d = new Date(newest.recordedAt);
    const dateLabel = isNaN(d.getTime()) ? '' : ` · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    return `${newest.value}${unit ? ` ${unit}` : ''}${dateLabel}`;
  }, [latestOwn, connection]);

  /** Record a just-saved result locally (no refetch needed) */
  const markSaved = useCallback((parameterId: string, date: string, value: string, recordedAt: string) => {
    setResultsByDate(prev => new Map(prev).set(`${parameterId}:${date}`, value));
    setLatestOwn(prev => new Map(prev).set(parameterId, { value, recordedAt }));
  }, []);

  return { resultsByDate, lastValueLabelFor, markSaved };
}
