/**
 * useAthleteTestResults — athlete app: the athlete's test results (athlete_test_results) for the
 * Plan and Today tabs: which scheduled tests already have a result (and the result, for editing),
 * and the latest value of a parameter (the athlete's own results or the coach-recorded values from
 * the metrics snapshot).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AthleteConnection } from '@/hooks/useAthleteApp';

export interface TestResultRow {
  id: string;
  parameterId: string;
  value: string;
  recordedAt: string;
  note: string | null;
  attachments: string[];
  /** The scheduled test day this result answers (yyyy-MM-dd); older results: their recorded date */
  scheduledFor: string;
}

type DbRow = {
  id: string;
  parameter_id: string;
  value: string;
  recorded_at: string;
  note: string | null;
  attachments?: string[] | null;
  scheduled_for?: string | null;
};

const testKey = (parameterId: string, date: string) => `${parameterId}:${date}`;

export function useAthleteTestResults(connection: AthleteConnection | null) {
  // `${parameterId}:${scheduled day}` → result
  const [rowsByTest, setRowsByTest] = useState<Map<string, TestResultRow>>(new Map());
  // parameterId → latest own result (any date)
  const [latestOwn, setLatestOwn] = useState<Map<string, { value: string; recordedAt: string }>>(new Map());

  useEffect(() => {
    if (!connection?.id) return;
    let cancelled = false;
    (async () => {
      // All columns; the optional ones may not exist yet (migrations not run) — then the basics
      const full = await supabase
        .from('athlete_test_results')
        .select('id, parameter_id, value, recorded_at, note, attachments, scheduled_for')
        .eq('athlete_connection_id', connection.id)
        .order('recorded_at', { ascending: false });
      let rows = full.data as DbRow[] | null;
      if (full.error) {
        const basic = await supabase
          .from('athlete_test_results')
          .select('id, parameter_id, value, recorded_at, note')
          .eq('athlete_connection_id', connection.id)
          .order('recorded_at', { ascending: false });
        rows = basic.data as DbRow[] | null;
      }
      if (cancelled) return;
      const byTest = new Map<string, TestResultRow>();
      const latest = new Map<string, { value: string; recordedAt: string }>();
      for (const r of rows ?? []) {
        const row: TestResultRow = {
          id: r.id,
          parameterId: r.parameter_id,
          value: r.value,
          recordedAt: r.recorded_at,
          note: r.note,
          attachments: Array.isArray(r.attachments) ? r.attachments : [],
          scheduledFor: r.scheduled_for ?? r.recorded_at.slice(0, 10),
        };
        const key = testKey(row.parameterId, row.scheduledFor);
        if (!byTest.has(key)) byTest.set(key, row);
        if (!latest.has(row.parameterId)) latest.set(row.parameterId, { value: row.value, recordedAt: row.recordedAt });
      }
      setRowsByTest(byTest);
      setLatestOwn(latest);
    })();
    return () => { cancelled = true; };
  }, [connection?.id]);

  /** The result entered for a scheduled test, if any */
  const resultFor = useCallback(
    (parameterId: string | undefined, scheduledDate: string): TestResultRow | null =>
      parameterId ? rowsByTest.get(testKey(parameterId, scheduledDate)) ?? null : null,
    [rowsByTest],
  );

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

  /** Record a just-saved / edited result locally (no refetch needed) */
  const markSaved = useCallback((row: TestResultRow) => {
    setRowsByTest(prev => new Map(prev).set(testKey(row.parameterId, row.scheduledFor), row));
    setLatestOwn(prev => {
      const current = prev.get(row.parameterId);
      if (current && new Date(current.recordedAt) > new Date(row.recordedAt)) return prev;
      return new Map(prev).set(row.parameterId, { value: row.value, recordedAt: row.recordedAt });
    });
  }, []);

  return { resultFor, lastValueLabelFor, markSaved };
}
