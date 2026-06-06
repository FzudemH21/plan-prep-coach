import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { AthleteProfileData } from '@/hooks/useAthleteConnections';

export type { AthleteProfileData };

export interface AthleteConnection {
  id: string;
  coachUserId: string;
  athleteLocalId: string;
  athleteName: string;
  athleteEmail: string | null;
  inviteCode: string;
  connectedAt: string | null;
  weeksAhead: number;
  monitoringEnabled: boolean;
  allowRearrangeWorkouts: boolean;
  profileData: AthleteProfileData;
}

export interface CircuitExerciseSummary {
  id: string;
  /** Library exercise ID — used to look up video/description at sync time. */
  exerciseId?: string;
  exerciseName: string;
  reps: string;
  time?: string;
  distance?: string;
  enabledParams?: string[];
  order: number;
  /** Video URL snapshotted from the library at sync time. */
  exerciseVideoUrl?: string;
  /** Description snapshotted from the library at sync time. */
  exerciseDescription?: string;
}

export interface ExerciseSummary {
  id: string;
  name: string;
  order: number;
  sectionId?: string;
  sectionName?: string;
  sectionOrder?: number;
  sectionNotes?: string;
  notes?: string;
  isCircuit?: boolean;
  supersetId?: string;   // shared key for all exercises in the same superset group
  /** Library exercise ID — kept for reference. */
  exerciseLibraryId?: string;
  /** Video URL snapshotted from the library at sync time. */
  exerciseVideoUrl?: string;
  /** Description snapshotted from the library at sync time. */
  exerciseDescription?: string;
  // Circuit-specific fields — populated when isCircuit is true
  circuitRounds?: string;
  circuitRestBetweenRounds?: string;
  circuitRestBetweenExercises?: string;
  circuitComments?: string;
  circuitExercises?: CircuitExerciseSummary[];
  // Planned values synced from coach periodization table
  methodKey?: string;
  plannedSets?: number;
  plannedParams?: Record<string, string | number>;
  visibleParams?: string[];
  restParamName?: string;
  /** True when the coach ticked "Each side" — athlete performs on each side separately */
  eachSide?: boolean;
}

export interface SessionSummary {
  id: string;
  name: string;
  order: number;
  methodCount: number;
  exerciseCount: number;
  duration?: number;
  notes?: string;
  intensity?: string;   // session-level planned intensity
  exercises: ExerciseSummary[];
}

export interface AthleteCalendarEvent {
  id: string;
  type: 'test' | 'event';
  title: string;
  notes?: string;
  targetValue?: string;
  unit?: string;
  parameterId?: string;   // links to ParameterV2 — set on test events so athlete can submit results
}

export interface AthleteScheduleEntry {
  id: string;
  date: string;          // yyyy-MM-dd
  intensity: string | null;
  sessions: SessionSummary[];
  events: AthleteCalendarEvent[];
  programName: string | null;
  mesocycleName: string | null;
  microcycleName: string | null;
}

export interface SessionLog {
  id: string;
  date: string;          // yyyy-MM-dd
  sessionId: string;
  sessionName: string;
  startedAt: string | null;   // ISO timestamp — set when athlete taps "Start Workout"
  completedAt: string | null; // ISO timestamp — set when athlete finishes and saves
  borgRating: number | null;
  durationSeconds: number | null;
  comment: string | null;
  setsLogged: unknown[];
}

export function useAthleteApp() {
  const { user, loading: authLoading } = useAuth();
  const [connection, setConnection] = useState<AthleteConnection | null>(null);
  const [schedule, setSchedule] = useState<AthleteScheduleEntry[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAthlete = user?.user_metadata?.role === 'athlete';

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAthlete) {
      console.log(`[useAthleteApp] no load — user=${user?.id ?? 'null'} isAthlete=${isAthlete} authLoading=${authLoading}`);
      setLoading(false);
      return;
    }

    async function load() {
      console.log(`[useAthleteApp] ▶ loading for user=${user!.id} role=${user!.user_metadata?.role}`);
      try {
        // Load connection
        const { data: connData, error: connErr } = await supabase
          .from('athlete_connections')
          .select('*')
          .eq('athlete_auth_user_id', user!.id)
          .single();
        if (connErr) {
          console.error('[useAthleteApp] ✗ connection query failed:', connErr.code, connErr.message);
          throw connErr;
        }
        console.log(`[useAthleteApp] ✓ connection found: id=${connData.id} name=${connData.athlete_name}`);
        const conn: AthleteConnection = {
          id: connData.id,
          coachUserId: connData.coach_user_id,
          athleteLocalId: connData.athlete_local_id,
          athleteName: connData.athlete_name,
          athleteEmail: connData.athlete_email,
          inviteCode: connData.invite_code,
          connectedAt: connData.connected_at,
          weeksAhead: connData.weeks_ahead ?? 4,
          monitoringEnabled: connData.monitoring_enabled ?? true,
          allowRearrangeWorkouts: connData.allow_rearrange_workouts ?? false,
          profileData: (connData.profile_data as AthleteProfileData) ?? {},
        };
        setConnection(conn);

        // Load schedule (90-day window around today) — use local date strings so the
        // window edges align with the same calendar day the athlete app displays.
        const todayLocal = new Date();
        const fromLocal = new Date(todayLocal); fromLocal.setDate(todayLocal.getDate() - 7);
        const toLocal = new Date(todayLocal); toLocal.setDate(todayLocal.getDate() + 90);
        const localStr = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const fromStr = localStr(fromLocal);
        const toStr = localStr(toLocal);
        console.log(`[useAthleteApp] querying athlete_schedule | connectionId=${conn.id} | from=${fromStr} to=${toStr}`);

        const { data: schedData, error: schedErr } = await supabase
          .from('athlete_schedule')
          .select('*')
          .eq('athlete_connection_id', conn.id)
          .gte('date', fromStr)
          .lte('date', toStr)
          .order('date', { ascending: true });
        if (schedErr) {
          console.error('[useAthleteApp] ✗ schedule query failed:', schedErr.code, schedErr.message);
          throw schedErr;
        }
        console.log(`[useAthleteApp] ✓ schedule rows returned: ${(schedData || []).length} | dates: ${(schedData || []).map((r: Record<string,unknown>) => r.date).join(', ').slice(0, 120)}`);

        setSchedule((schedData || []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          date: row.date as string,
          intensity: row.intensity as string | null,
          sessions: (row.sessions as SessionSummary[]) || [],
          events: (row.events as AthleteCalendarEvent[]) || [],
          programName: row.program_name as string | null,
          mesocycleName: row.mesocycle_name as string | null,
          microcycleName: row.microcycle_name as string | null,
        })));

        // Load session logs (non-fatal — schedule stays usable if this fails)
        const { data: logsData } = await supabase
          .from('athlete_session_logs')
          .select('id, date, session_id, session_name, started_at, completed_at, borg_rating, duration_seconds, comment, sets_logged')
          .eq('athlete_connection_id', conn.id)
          .gte('date', fromStr)
          .lte('date', toStr);
        setSessionLogs((logsData ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          date: row.date as string,
          sessionId: row.session_id as string,
          sessionName: row.session_name as string,
          startedAt: row.started_at as string | null,
          completedAt: row.completed_at as string | null,
          borgRating: row.borg_rating as number | null,
          durationSeconds: row.duration_seconds as number | null,
          comment: row.comment as string | null,
          setsLogged: (row.sets_logged as unknown[]) || [],
        })));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load athlete data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, authLoading, isAthlete]);

  const refetchLogs = useCallback(async () => {
    if (!connection) return;
    const todayLocal = new Date();
    const fromLocal = new Date(todayLocal); fromLocal.setDate(todayLocal.getDate() - 7);
    const toLocal   = new Date(todayLocal); toLocal.setDate(todayLocal.getDate() + 90);
    const localStr  = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { data } = await supabase
      .from('athlete_session_logs')
      .select('id, date, session_id, session_name, started_at, completed_at, borg_rating, duration_seconds, comment, sets_logged')
      .eq('athlete_connection_id', connection.id)
      .gte('date', localStr(fromLocal))
      .lte('date', localStr(toLocal));
    setSessionLogs((data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      date: row.date as string,
      sessionId: row.session_id as string,
      sessionName: row.session_name as string,
      completedAt: row.completed_at as string,
      borgRating: row.borg_rating as number | null,
      durationSeconds: row.duration_seconds as number | null,
      comment: row.comment as string | null,
      setsLogged: (row.sets_logged as unknown[]) || [],
    })));
  }, [connection]);

  // Only return a log that has been completed — in-progress rows must not
  // hide the "Start Workout" button or be treated as finished in the athlete app.
  const getSessionLog = useCallback((date: string, sessionId: string): SessionLog | null =>
    sessionLogs.find(l => l.date === date && l.sessionId === sessionId && !!l.completedAt) ?? null,
  [sessionLogs]);

  const updateProfile = useCallback(async (patch: AthleteProfileData) => {
    if (!connection) return;
    const merged = { ...connection.profileData, ...patch };
    const { error } = await supabase
      .from('athlete_connections')
      .update({ profile_data: merged })
      .eq('id', connection.id);
    if (error) throw error;
    setConnection(prev => prev ? { ...prev, profileData: merged } : prev);
  }, [connection]);

  const getTodayEntry = (): AthleteScheduleEntry | null => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return schedule.find(e => e.date === today) ?? null;
  };

  const getUpcomingDays = (n = 7): AthleteScheduleEntry[] => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return schedule.filter(e => e.date >= today).slice(0, n);
  };

  /** Move a session from one date to another within the athlete's schedule. */
  const moveSession = useCallback(async (sessionId: string, fromDate: string, toDate: string) => {
    if (!connection || fromDate === toDate) return;

    // Find the session object in local state first
    const fromEntry = schedule.find(e => e.date === fromDate);
    const session = fromEntry?.sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Fetch current DB rows for both dates
    const { data: rows } = await supabase
      .from('athlete_schedule')
      .select('id, date, sessions')
      .eq('athlete_connection_id', connection.id)
      .in('date', [fromDate, toDate]);

    const fromRow = (rows ?? []).find((r: Record<string, unknown>) => r.date === fromDate);
    const toRow   = (rows ?? []).find((r: Record<string, unknown>) => r.date === toDate);

    // Remove session from source
    const newFromSessions = ((fromRow?.sessions as SessionSummary[]) ?? [])
      .filter((s: SessionSummary) => s.id !== sessionId)
      .map((s: SessionSummary, i: number) => ({ ...s, order: i }));

    // Add session to target (re-order)
    const existingToSessions = (toRow?.sessions as SessionSummary[]) ?? [];
    const newToSessions = [...existingToSessions, { ...session, order: existingToSessions.length }];

    // Update source row (filter by connection + date, not by id which may be undefined)
    await supabase
      .from('athlete_schedule')
      .update({ sessions: newFromSessions })
      .eq('athlete_connection_id', connection.id)
      .eq('date', fromDate);

    // Upsert target row (may not exist yet for that date)
    if (toRow) {
      await supabase
        .from('athlete_schedule')
        .update({ sessions: newToSessions })
        .eq('athlete_connection_id', connection.id)
        .eq('date', toDate);
    } else {
      await supabase
        .from('athlete_schedule')
        .insert({ athlete_connection_id: connection.id, date: toDate, sessions: newToSessions });
    }

    // Update local state optimistically
    setSchedule(prev => {
      const next = prev.map(e => {
        if (e.date === fromDate) return { ...e, sessions: newFromSessions };
        if (e.date === toDate)   return { ...e, sessions: newToSessions };
        return e;
      });
      // If toDate had no row yet, add it
      if (!prev.find(e => e.date === toDate)) {
        next.push({ id: toDate, date: toDate, intensity: null, sessions: newToSessions, events: [], programName: null, mesocycleName: null, microcycleName: null });
      }
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }, [connection, schedule]);

  /** Submit an athlete-entered test result for a performance parameter. */
  const submitTestResult = useCallback(async (
    parameterId: string,
    value: string,
    recordedAt: string,
    note?: string,
  ) => {
    if (!connection) return;
    const { error } = await supabase
      .from('athlete_test_results')
      .insert({
        athlete_connection_id: connection.id,
        parameter_id: parameterId,
        value,
        recorded_at: recordedAt,
        note: note ?? null,
      });
    if (error) throw error;
  }, [connection]);

  return { connection, schedule, sessionLogs, loading, error, isAthlete, getTodayEntry, getUpcomingDays, updateProfile, getSessionLog, refetchLogs, moveSession, submitTestResult };
}
