/**
 * useSquadOverview
 *
 * Batch-fetches monitoring data for a set of athlete connections and
 * returns a per-athlete summary suitable for the Squad Dashboard.
 *
 * Three parallel Supabase queries cover all data in one round-trip:
 *   1. Latest daily check-in per athlete (last 14 days)
 *   2. Completed session logs last 28 days  → week AU + prior-week average
 *   3. This-week schedule rows              → planned session count
 *
 * The load metric is displayed as "this week AU vs. prior-week average" —
 * NOT as ACWR. This is purely descriptive context, not a risk predictor.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfISOWeek, subDays, format } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WellnessStatus = 'good' | 'moderate' | 'poor' | 'unknown';

export interface AthleteSquadSummary {
  connectionId: string;
  athleteLocalId: string;
  athleteName: string;
  /** Average of available wellness items (1–5 scale). Null if no check-in in last 28 days. */
  wellnessComposite: number | null;
  wellnessStatus: WellnessStatus;
  /** Date of the most recent check-in (yyyy-MM-dd). */
  wellnessDate: string | null;
  hasPainFlag: boolean;
  hasIllnessFlag: boolean;
  /** AU = sRPE × duration_minutes, summed for the current ISO week (Mon–today). */
  weekAU: number;
  /** Average weekly AU across complete prior ISO weeks in the last 28 days. 0 if no history. */
  avgWeeklyAU: number;
  /** Completed sessions (with completed_at set) this ISO week. */
  weekCompletedSessions: number;
  /** Planned sessions (from athlete_schedule) this ISO week up to today. */
  weekPlannedSessions: number;
  /** Z-score of today's wellness vs all daily composites in the last 28 days. Null if < 2 data points. */
  wellnessZScore: number | null;
  /** Z-score of this week's AU vs prior complete-week AUs in the last 28 days. Null if < 2 prior weeks. */
  weekAUZScore: number | null;
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
    row.wellness_fatigue,
    row.wellness_sleep,
    row.wellness_soreness,
    row.wellness_stress,
    row.wellness_mood,
  ].filter((v): v is number => v !== null);
  if (items.length === 0) return null;
  return Math.round((items.reduce((a, b) => a + b, 0) / items.length) * 10) / 10;
}

/**
 * Z-score of `value` relative to `population` (sample std dev, Bessel-corrected).
 * Returns null when population has fewer than 2 data points or std dev is 0.
 * Rounded to one decimal place.
 */
function computeZScore(value: number, population: number[]): number | null {
  if (population.length < 2) return null;
  const m = population.reduce((a, b) => a + b, 0) / population.length;
  const variance = population.reduce((sum, v) => sum + (v - m) ** 2, 0) / (population.length - 1);
  const s = Math.sqrt(variance);
  if (s === 0) return null;
  return Math.round(((value - m) / s) * 10) / 10;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSquadOverview(
  connections: Array<{ id: string; athleteLocalId: string; athleteName: string }>,
) {
  // Stable dep-key: prevents re-fetch on every parent render due to array reference churn
  const connKey = connections
    .map(c => c.id)
    .sort()
    .join(',');

  const [summaries, setSummaries] = useState<AthleteSquadSummary[]>([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!connKey) {
      setSummaries([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      const connectionIds = connections.map(c => c.id);

      const today        = new Date();
      const weekStart    = startOfISOWeek(today);          // Monday of current ISO week
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const todayStr     = format(today, 'yyyy-MM-dd');

      const [checkinsRes, logsRes, scheduleRes] = await Promise.all([
        // 1. Latest check-in per athlete (last 14 days)
        supabase
          .from('athlete_daily_checkins')
          .select('athlete_connection_id, date, wellness_fatigue, wellness_sleep, wellness_soreness, wellness_stress, wellness_mood, has_pain, has_illness')
          .in('athlete_connection_id', connectionIds)
          .gte('date', format(subDays(today, 28), 'yyyy-MM-dd'))
          .order('date', { ascending: false }),

        // 2. Completed session logs — last 28 days (covers this week + 3 prior weeks)
        supabase
          .from('athlete_session_logs')
          .select('athlete_connection_id, date, borg_rating, duration_seconds, completed_at')
          .in('athlete_connection_id', connectionIds)
          .gte('date', format(subDays(today, 28), 'yyyy-MM-dd'))
          .lte('date', todayStr)
          .not('completed_at', 'is', null),

        // 3. This-week schedule rows (planned sessions)
        supabase
          .from('athlete_schedule')
          .select('athlete_connection_id, date, sessions')
          .in('athlete_connection_id', connectionIds)
          .gte('date', weekStartStr)
          .lte('date', todayStr),
      ]);

      if (cancelled) return;

      const checkins = (checkinsRes.data ?? []) as CheckinRow[];
      const logs     = (logsRes.data     ?? []) as LogRow[];
      const schedule = (scheduleRes.data ?? []) as ScheduleRow[];

      // Latest check-in per connection (rows already ordered date DESC)
      const latestCheckin = new Map<string, CheckinRow>();
      // All composites per connection for z-score reference (28-day window)
      const allCompositesByConn = new Map<string, number[]>();
      for (const row of checkins) {
        if (!latestCheckin.has(row.athlete_connection_id)) {
          latestCheckin.set(row.athlete_connection_id, row);
        }
        const comp = computeComposite(row);
        if (comp !== null) {
          const arr = allCompositesByConn.get(row.athlete_connection_id) ?? [];
          arr.push(comp);
          allCompositesByConn.set(row.athlete_connection_id, arr);
        }
      }

      const results: AthleteSquadSummary[] = connections.map(conn => {
        const checkin   = latestCheckin.get(conn.id) ?? null;
        const composite = checkin ? computeComposite(checkin) : null;

        const connLogs = logs.filter(l => l.athlete_connection_id === conn.id);

        // ── Current ISO-week AU ──────────────────────────────────────────────
        const weekLogs = connLogs.filter(l => l.date >= weekStartStr);
        const weekAU   = weekLogs.reduce((sum, l) => {
          const b = l.borg_rating ?? 0;
          const d = l.duration_seconds != null ? Math.round(l.duration_seconds / 60) : 0;
          return sum + b * d;
        }, 0);

        // ── Prior-weeks average AU (excluding current week) ─────────────────
        // Group logs by ISO-week start, sum AU per week, then average.
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

        // ── Planned sessions this week ───────────────────────────────────────
        const connSchedule = schedule.filter(s => s.athlete_connection_id === conn.id);
        const weekPlannedSessions = connSchedule.reduce(
          (sum, row) => sum + (Array.isArray(row.sessions) ? row.sessions.length : 0),
          0,
        );

        // Z-scores (require ≥2 data points; sample std dev)
        const allComposites = allCompositesByConn.get(conn.id) ?? [];
        const wellnessZScore = composite !== null ? computeZScore(composite, allComposites) : null;
        // AU z-score: current week vs prior complete weeks as reference
        const weekAUZScore = computeZScore(weekAU, prevWeekAUs);

        return {
          connectionId:           conn.id,
          athleteLocalId:         conn.athleteLocalId,
          athleteName:            conn.athleteName,
          wellnessComposite:      composite,
          wellnessStatus:         toWellnessStatus(composite),
          wellnessDate:           checkin?.date ?? null,
          hasPainFlag:            checkin?.has_pain    ?? false,
          hasIllnessFlag:         checkin?.has_illness ?? false,
          weekAU,
          avgWeeklyAU,
          weekCompletedSessions:  weekLogs.length,
          weekPlannedSessions,
          wellnessZScore,
          weekAUZScore,
        };
      });

      setSummaries(results);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connKey]);

  return { summaries, loading };
}
