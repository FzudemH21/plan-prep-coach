/**
 * useSquadOverview
 *
 * Batch-fetches monitoring data for a set of athlete connections for a
 * specific `selectedDate` and returns a per-athlete summary for the Squad Dashboard.
 *
 * Four parallel Supabase queries:
 *   1. Daily check-ins (28-day window ending at selectedDate) — wellness + z-score ref
 *   2. Completed session logs (28-day window) — week AU + prior-week avg + z-score
 *   3. ISO-week schedule rows — planned session count
 *   4. Latest custom-metric test results per parameterId
 *
 * Wellness shows the check-in for *exactly* selectedDate (not the latest overall).
 * Load/AU shows the totals for the ISO week that contains selectedDate.
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfISOWeek, subDays, format } from 'date-fns';
import type { MonitoringConfig } from '@/types/athlete';

// ── Public types ──────────────────────────────────────────────────────────────

export type WellnessStatus = 'good' | 'moderate' | 'poor' | 'unknown';

export interface CustomSquadColumn {
  parameterId: string;
  name: string;
  unit: string | null;
}

export interface DaySessionInfo {
  name: string;
  /** Planned session-level intensity (Borg CR10 string "0"–"10", or null). */
  intensity: string | null;
}

export interface DayScheduleInfo {
  /** Planned sessions for the selected day. */
  sessions: DaySessionInfo[];
  /** Titles of test events scheduled for the day. */
  tests: string[];
  /** Titles of calendar events scheduled for the day. */
  events: string[];
  /** Day-level planned intensity (from athlete_schedule.intensity). */
  intensity: string | null;
}

export interface AthleteSquadSummary {
  connectionId: string;
  athleteLocalId: string;
  athleteName: string;
  /** Composite for exactly selectedDate (null if no check-in on that day). */
  wellnessComposite: number | null;
  wellnessStatus: WellnessStatus;
  /** The check-in date used — always selectedDate or null. */
  wellnessDate: string | null;
  hasPainFlag: boolean;
  hasIllnessFlag: boolean;
  /** AU summed for the ISO week that contains selectedDate, up to selectedDate. */
  weekAU: number;
  /** Average weekly AU across complete prior ISO weeks in the 28-day window. */
  avgWeeklyAU: number;
  weekCompletedSessions: number;
  weekPlannedSessions: number;
  /** Z-score vs all daily composites in the 28-day window. Null if < 2 data points. */
  wellnessZScore: number | null;
  /** Z-score of weekAU vs prior complete-week AUs. Null if < 2 prior weeks. */
  weekAUZScore: number | null;
  customMetricValues: Record<string, { value: string; date: string } | null>;
  /** Sessions, tests, and events planned for exactly selectedDate. Null if no row exists. */
  daySchedule: DayScheduleInfo | null;
}

export interface SquadConnectionInput {
  id: string;
  athleteLocalId: string;
  athleteName: string;
  monitoringConfig?: MonitoringConfig | null;
}

// ── Internal row types ────────────────────────────────────────────────────────

interface CheckinRow {
  athlete_connection_id: string;
  date: string;
  wellness_fatigue: number | null;
  wellness_sleep: number | null;
  wellness_soreness: number | null;
  wellness_stress: number | null;
  wellness_mood: number | null;
  has_pain: boolean;
  has_illness: boolean;
}

interface LogRow {
  athlete_connection_id: string;
  date: string;
  borg_rating: number | null;
  duration_seconds: number | null;
}

interface ScheduleRow {
  athlete_connection_id: string;
  date: string;
  sessions: unknown[];
  events: unknown[];
  intensity: string | null;
}

interface TestResultRow {
  athlete_connection_id: string;
  parameter_id: string;
  value: string;
  recorded_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toWellnessStatus(composite: number | null): WellnessStatus {
  if (composite === null) return 'unknown';
  if (composite >= 3.5) return 'good';
  if (composite >= 2.5) return 'moderate';
  return 'poor';
}

function computeComposite(row: CheckinRow): number | null {
  const items = [
    row.wellness_fatigue, row.wellness_sleep,
    row.wellness_soreness, row.wellness_stress, row.wellness_mood,
  ].filter((v): v is number => v !== null);
  if (!items.length) return null;
  return Math.round((items.reduce((a, b) => a + b, 0) / items.length) * 10) / 10;
}

function computeZScore(value: number, population: number[]): number | null {
  if (population.length < 2) return null;
  const m = population.reduce((a, b) => a + b, 0) / population.length;
  const variance = population.reduce((s, v) => s + (v - m) ** 2, 0) / (population.length - 1);
  const s = Math.sqrt(variance);
  if (s === 0) return null;
  return Math.round(((value - m) / s) * 10) / 10;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSquadOverview(
  connections: SquadConnectionInput[],
  selectedDate: Date = new Date(),
) {
  const connKey = connections.map(c => c.id).sort().join(',');
  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  // Unique enabled custom-metric columns across the squad
  const customColumns = useMemo((): CustomSquadColumn[] => {
    const seen = new Map<string, CustomSquadColumn>();
    for (const conn of connections) {
      for (const block of conn.monitoringConfig?.blocks ?? []) {
        if (block.type === 'custom_metric' && block.enabled && block.config) {
          const { parameterId, parameterName, parameterUnit } = block.config;
          if (!seen.has(parameterId)) {
            seen.set(parameterId, { parameterId, name: parameterName, unit: parameterUnit });
          }
        }
      }
    }
    return Array.from(seen.values());
  }, [connKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [summaries, setSummaries] = useState<AthleteSquadSummary[]>([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!connKey) { setSummaries([]); return; }

    let cancelled = false;

    async function load() {
      setLoading(true);

      const connectionIds  = connections.map(c => c.id);
      const customParamIds = customColumns.map(c => c.parameterId);

      // All date arithmetic anchored on selectedDate
      const today        = selectedDate;
      const weekStart    = startOfISOWeek(today);
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const todayStr     = format(today, 'yyyy-MM-dd');
      const from28Str    = format(subDays(today, 28), 'yyyy-MM-dd');

      const [checkinsRes, logsRes, scheduleRes, testRes] = await Promise.all([
        // 1. Check-ins: 28-day window for z-score reference; exact todayStr for display value
        supabase
          .from('athlete_daily_checkins')
          .select('athlete_connection_id, date, wellness_fatigue, wellness_sleep, wellness_soreness, wellness_stress, wellness_mood, has_pain, has_illness')
          .in('athlete_connection_id', connectionIds)
          .gte('date', from28Str)
          .lte('date', todayStr)
          .order('date', { ascending: false }),

        // 2. Completed session logs — 28-day window
        supabase
          .from('athlete_session_logs')
          .select('athlete_connection_id, date, borg_rating, duration_seconds, completed_at')
          .in('athlete_connection_id', connectionIds)
          .gte('date', from28Str)
          .lte('date', todayStr)
          .not('completed_at', 'is', null),

        // 3. This-week schedule (Mon → selectedDate) — also fetch events/intensity for day display
        supabase
          .from('athlete_schedule')
          .select('athlete_connection_id, date, sessions, events, intensity')
          .in('athlete_connection_id', connectionIds)
          .gte('date', weekStartStr)
          .lte('date', todayStr),

        // 4. Custom metric test results
        customParamIds.length > 0
          ? supabase
              .from('athlete_test_results')
              .select('athlete_connection_id, parameter_id, value, recorded_at')
              .in('athlete_connection_id', connectionIds)
              .in('parameter_id', customParamIds)
              .order('recorded_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const checkins    = (checkinsRes.data  ?? []) as CheckinRow[];
      const logs        = (logsRes.data      ?? []) as LogRow[];
      const schedule    = (scheduleRes.data  ?? []) as ScheduleRow[];
      const testResults = ((testRes as { data: unknown[] | null }).data ?? []) as TestResultRow[];

      // Check-in for *exactly* selectedDate per athlete (for display)
      const exactCheckin       = new Map<string, CheckinRow>();
      // All composites in the 28-day window (for z-score reference)
      const allCompositesByConn = new Map<string, number[]>();

      for (const row of checkins) {
        if (row.date === todayStr && !exactCheckin.has(row.athlete_connection_id)) {
          exactCheckin.set(row.athlete_connection_id, row);
        }
        const comp = computeComposite(row);
        if (comp !== null) {
          const arr = allCompositesByConn.get(row.athlete_connection_id) ?? [];
          arr.push(comp);
          allCompositesByConn.set(row.athlete_connection_id, arr);
        }
      }

      // Latest test result per (connectionId, parameterId)
      const latestTestResult = new Map<string, { value: string; date: string }>();
      for (const row of testResults) {
        const key = `${row.athlete_connection_id}::${row.parameter_id}`;
        if (!latestTestResult.has(key)) {
          latestTestResult.set(key, { value: String(row.value), date: row.recorded_at.slice(0, 10) });
        }
      }

      const results: AthleteSquadSummary[] = connections.map(conn => {
        const checkin   = exactCheckin.get(conn.id) ?? null;
        const composite = checkin ? computeComposite(checkin) : null;

        const connLogs = logs.filter(l => l.athlete_connection_id === conn.id);

        // ISO-week AU (Mon → selectedDate)
        const weekLogs = connLogs.filter(l => l.date >= weekStartStr);
        const weekAU   = weekLogs.reduce((sum, l) => {
          const b = l.borg_rating ?? 0;
          const d = l.duration_seconds != null ? Math.round(l.duration_seconds / 60) : 0;
          return sum + b * d;
        }, 0);

        // Prior-week AU averages
        const prevLogs = connLogs.filter(l => l.date < weekStartStr);
        const auByWeek = new Map<string, number>();
        for (const l of prevLogs) {
          const wk = format(startOfISOWeek(new Date(l.date + 'T12:00:00')), 'yyyy-MM-dd');
          const au = (l.borg_rating ?? 0) * (l.duration_seconds != null ? Math.round(l.duration_seconds / 60) : 0);
          auByWeek.set(wk, (auByWeek.get(wk) ?? 0) + au);
        }
        const prevWeekAUs = Array.from(auByWeek.values());
        const avgWeeklyAU = prevWeekAUs.length > 0
          ? Math.round(prevWeekAUs.reduce((a, b) => a + b, 0) / prevWeekAUs.length)
          : 0;

        // Planned sessions for the week containing selectedDate
        const connSchedule        = schedule.filter(s => s.athlete_connection_id === conn.id);
        const weekPlannedSessions = connSchedule.reduce(
          (sum, row) => sum + (Array.isArray(row.sessions) ? row.sessions.length : 0), 0,
        );

        // Day schedule for exactly selectedDate
        const dayRow = connSchedule.find(s => s.date === todayStr) ?? null;
        const daySchedule: DayScheduleInfo | null = dayRow ? {
          sessions: (dayRow.sessions as Array<{ name?: string; intensity?: string | null }>).map(s => ({
            name: s.name ?? 'Session',
            intensity: s.intensity ?? null,
          })),
          tests: (dayRow.events as Array<{ type?: string; title?: string }>)
            .filter(e => e.type === 'test')
            .map(e => e.title ?? ''),
          events: (dayRow.events as Array<{ type?: string; title?: string }>)
            .filter(e => e.type === 'event')
            .map(e => e.title ?? ''),
          intensity: dayRow.intensity,
        } : null;

        // Z-scores
        const allComposites  = allCompositesByConn.get(conn.id) ?? [];
        const wellnessZScore = composite !== null ? computeZScore(composite, allComposites) : null;
        const weekAUZScore   = computeZScore(weekAU, prevWeekAUs);

        // Custom metric values
        const customMetricValues: Record<string, { value: string; date: string } | null> = {};
        for (const col of customColumns) {
          customMetricValues[col.parameterId] = latestTestResult.get(`${conn.id}::${col.parameterId}`) ?? null;
        }

        return {
          connectionId:          conn.id,
          athleteLocalId:        conn.athleteLocalId,
          athleteName:           conn.athleteName,
          wellnessComposite:     composite,
          wellnessStatus:        toWellnessStatus(composite),
          wellnessDate:          checkin?.date ?? null,
          hasPainFlag:           checkin?.has_pain    ?? false,
          hasIllnessFlag:        checkin?.has_illness ?? false,
          weekAU,
          avgWeeklyAU,
          weekCompletedSessions: weekLogs.length,
          weekPlannedSessions,
          wellnessZScore,
          weekAUZScore,
          customMetricValues,
          daySchedule,
        };
      });

      setSummaries(results);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connKey, dateKey, customColumns]);

  return { summaries, loading, customColumns };
}
