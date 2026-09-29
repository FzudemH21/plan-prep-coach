import { useState, useEffect, useCallback, useRef } from 'react';
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
  chatEnabled: boolean;
  /** True when the coach has archived the athlete — athlete app shows a soft-block screen. */
  isSuspended: boolean;
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
  /** Source library & circuit IDs — set when circuit is added from a library, used to overwrite/save-as-new */
  circuitSourceLibraryId?: string;
  circuitSourceId?: string;
  // Planned values synced from coach periodization table
  methodKey?: string;
  plannedSets?: number;
  plannedParams?: Record<string, string | number>;
  /** Formula-auto-computed values snapshotted at assign time (same key format as plannedParams).
   *  Used as the restore target when the coach hits the RefreshCw icon on mobile. */
  formulaComputedParams?: Record<string, string | number>;
  visibleParams?: string[];
  restParamName?: string;
  /** True when the coach ticked "Each side" — athlete performs on each side separately */
  eachSide?: boolean;
  /** True when plannedParams were directly edited on the mobile coach app.
   *  Preserved across plan syncs — syncAthleteSchedule will not overwrite these. */
  mobileEdited?: boolean;
  /** True when the exercise was added on the mobile coach app (not in the plan's ExerciseDistribution).
   *  Re-appended to the session after plan syncs so mobile-added exercises survive desktop resyncs. */
  mobileAdded?: boolean;
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
  /** Set when a coach moves this session to a different day on mobile.
   *  syncAthleteSchedule uses this to preserve the rearrangement across plan re-syncs. */
  mobileRearranged?: boolean;
  /** The plan date this session originally lived on (before any mobile rearrangement).
   *  syncAthleteSchedule uses this to remove the session from the wrong plan date. */
  originalDate?: string;
}

export interface AthleteCalendarEvent {
  id: string;
  type: 'test' | 'event';
  title: string;
  notes?: string;
  targetValue?: string;
  unit?: string;
  parameterId?: string;   // links to ParameterV2 — set on test events so athlete can submit results
  /** Test details from the coach's parameter database */
  instructions?: string;
  videoUrl?: string;
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
  /** Set while an unfinished workout is paused (pause / resume) */
  pausedAt: string | null;
  borgRating: number | null;
  durationSeconds: number | null;
  comment: string | null;
  setsLogged: unknown[];
}

function mapScheduleRow(row: Record<string, unknown>): AthleteScheduleEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    intensity: row.intensity as string | null,
    sessions: (row.sessions as SessionSummary[]) || [],
    events: (row.events as AthleteCalendarEvent[]) || [],
    programName: row.program_name as string | null,
    mesocycleName: row.mesocycle_name as string | null,
    microcycleName: row.microcycle_name as string | null,
  };
}

/** How far back the app loads the schedule and session logs (the Plan tab can page back this far) */
export const SCHEDULE_PAST_DAYS = 182;

/** The athlete's session logs in the schedule window (started, paused and completed workouts) */
async function fetchSessionLogs(connectionId: string): Promise<SessionLog[]> {
  const todayLocal = new Date();
  const fromLocal = new Date(todayLocal); fromLocal.setDate(todayLocal.getDate() - SCHEDULE_PAST_DAYS);
  const toLocal   = new Date(todayLocal); toLocal.setDate(todayLocal.getDate() + 90);
  const localStr  = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const baseColumns = 'id, date, session_id, session_name, started_at, completed_at, borg_rating, duration_seconds, comment, sets_logged';
  const query = (columns: string) => supabase
    .from('athlete_session_logs')
    .select(columns)
    .eq('athlete_connection_id', connectionId)
    .gte('date', localStr(fromLocal))
    .lte('date', localStr(toLocal));
  // paused_at (pause / resume) — without it if the migration hasn't been run yet
  let res = await query(`${baseColumns}, paused_at`);
  if (res.error) res = await query(baseColumns);
  return ((res.data ?? []) as unknown as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    date: row.date as string,
    sessionId: row.session_id as string,
    sessionName: row.session_name as string,
    startedAt: row.started_at as string | null,
    completedAt: row.completed_at as string | null,
    pausedAt: (row.paused_at as string | null | undefined) ?? null,
    borgRating: row.borg_rating as number | null,
    durationSeconds: row.duration_seconds as number | null,
    comment: row.comment as string | null,
    setsLogged: (row.sets_logged as unknown[]) || [],
  }));
}

export function useAthleteApp() {
  const { user, loading: authLoading } = useAuth();
  const [connection, setConnection] = useState<AthleteConnection | null>(null);
  const [schedule, setSchedule] = useState<AthleteScheduleEntry[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAthlete = user?.user_metadata?.role === 'athlete';

  // Stores the active connection id so stable callbacks can access the latest value without stale closures.
  const connectionIdRef = useRef<string | null>(null);

  // Stable schedule-fetch function — reads connection id from ref so it never goes stale.
  // Called on initial load, Supabase Realtime events, and tab-visibility changes.
  const refetchSchedule = useCallback(async () => {
    const connId = connectionIdRef.current;
    if (!connId) return;
    const todayLocal = new Date();
    const fromLocal = new Date(todayLocal); fromLocal.setDate(todayLocal.getDate() - SCHEDULE_PAST_DAYS);
    const toLocal   = new Date(todayLocal); toLocal.setDate(todayLocal.getDate() + 90);
    const localStr  = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { data: schedData } = await supabase
      .from('athlete_schedule')
      .select('*')
      .eq('athlete_connection_id', connId)
      .gte('date', localStr(fromLocal))
      .lte('date', localStr(toLocal))
      .order('date', { ascending: true });
    console.log(`[useAthleteApp] ✓ schedule refreshed: ${(schedData || []).length} rows`);
    setSchedule((schedData || []).map(mapScheduleRow));
  }, []); // stable — reads from ref; setSchedule is a stable React dispatcher

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAthlete) {
      console.log(`[useAthleteApp] no load — user=${user?.id ?? 'null'} isAthlete=${isAthlete} authLoading=${authLoading}`);
      setLoading(false);
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    // Prevents an orphaned async load() from subscribing after the effect was cleaned up.
    // Without this, if deps change before load() reaches the subscription code, cleanup
    // runs with channel=null (no-op), then load() finishes and subscribes. The next
    // effect run hits the same channel name (already subscribed) → throws the
    // "cannot add postgres_changes callbacks after subscribe()" error.
    let cancelled = false;

    async function load() {
      console.log(`[useAthleteApp] ▶ loading for user=${user!.id} role=${user!.user_metadata?.role}`);
      try {
        // Load connection — use maybeSingle so a missing row returns null instead of an error
        const { data: connData, error: connErr } = await supabase
          .from('athlete_connections')
          .select('*')
          .eq('athlete_auth_user_id', user!.id)
          .maybeSingle();
        if (connErr) {
          console.error('[useAthleteApp] ✗ connection query failed:', connErr.code, connErr.message);
          throw connErr;
        }
        if (!connData) {
          // Connection row was deleted (coach permanently removed this athlete)
          console.log('[useAthleteApp] no connection found — athlete was removed by coach');
          setConnection(null);
          setLoading(false);
          return;
        }
        console.log(`[useAthleteApp] ✓ connection found: id=${connData.id} name=${connData.athlete_name} suspended=${connData.is_suspended}`);
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
          chatEnabled: ((connData.profile_data as AthleteProfileData)?.chatEnabled) ?? true,
          isSuspended: (connData.is_suspended as boolean) ?? false,
          profileData: (connData.profile_data as AthleteProfileData) ?? {},
        };
        setConnection(conn);

        // Cache coach branding for the splash screen so it shows instantly on next open
        const splash = conn.profileData?.coachBranding ?? {};
        try { localStorage.setItem('ppc-athlete-splash', JSON.stringify(splash)); } catch { /* ignore */ }

        // Store connection id in ref so refetchSchedule can use it, then do initial fetch
        connectionIdRef.current = conn.id;
        await refetchSchedule();

        // Load session logs (non-fatal — schedule stays usable if this fails)
        setSessionLogs(await fetchSessionLogs(conn.id));

        // Guard: if the effect was cleaned up while we were awaiting above, bail now.
        // This prevents the orphaned load() from subscribing a channel after cleanup
        // already ran (with channel=null). Without this, the next effect run would hit
        // the same channel name (already subscribed) → "cannot add postgres_changes
        // callbacks after subscribe()" → crash.
        if (cancelled) return;

        // Non-fatal try/catch: a Realtime subscription failure must never crash the
        // entire athlete app — the schedule already loaded via refetchSchedule() above.
        try {
          channel = supabase
            .channel(`athlete-schedule-${conn.id}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'athlete_schedule', filter: `athlete_connection_id=eq.${conn.id}` },
              () => {
                console.log('[useAthleteApp] realtime: athlete_schedule changed — scheduling refetch');
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                  refetchSchedule().catch(console.error);
                }, 800);
              },
            )
            .subscribe((status) => {
              console.log('[useAthleteApp] realtime channel status:', status);
            });
        } catch (realtimeErr) {
          console.warn('[useAthleteApp] realtime subscription failed (non-fatal):', realtimeErr);
        }

      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load athlete data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Re-fetch schedule when athlete returns to the tab (covers "already had app open" case)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetchSchedule().catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    load();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, isAthlete]);

  const refetchLogs = useCallback(async () => {
    if (!connection) return;
    setSessionLogs(await fetchSessionLogs(connection.id));
  }, [connection]);

  // Only return a log that has been completed — in-progress rows must not
  // hide the "Start Workout" button or be treated as finished in the athlete app.
  const getSessionLog = useCallback((date: string, sessionId: string): SessionLog | null =>
    sessionLogs.find(l => l.date === date && l.sessionId === sessionId && !!l.completedAt) ?? null,
  [sessionLogs]);

  /** A started workout of this session that isn't finished yet (paused, or left mid-workout) */
  const getUnfinishedLog = useCallback((date: string, sessionId: string): SessionLog | null => {
    if (sessionLogs.some(l => l.date === date && l.sessionId === sessionId && !!l.completedAt)) return null;
    return sessionLogs.find(l => l.date === date && l.sessionId === sessionId && !!l.startedAt && !l.completedAt) ?? null;
  }, [sessionLogs]);

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
    attachments?: string[],
    scheduledFor?: string,
  ): Promise<{ id: string | null; attachmentsSaved: boolean }> => {
    if (!connection) return { id: null, attachmentsSaved: false };
    const base = {
      athlete_connection_id: connection.id,
      parameter_id: parameterId,
      value,
      recorded_at: recordedAt,
      note: note ?? null,
    };
    const hasFiles = !!attachments && attachments.length > 0;
    // Newest columns first; drop the optional ones the database doesn't have yet (migrations
    // 20260929_test_results_scheduled_for_and_edit / 20260928_athlete_test_attachments not run)
    const attempts: Array<{ row: Record<string, unknown>; files: boolean }> = [
      { row: { ...base, ...(hasFiles ? { attachments } : {}), ...(scheduledFor ? { scheduled_for: scheduledFor } : {}) }, files: hasFiles },
      ...(scheduledFor ? [{ row: { ...base, ...(hasFiles ? { attachments } : {}) }, files: hasFiles }] : []),
      ...(hasFiles ? [{ row: base, files: false }] : []),
    ];
    let lastError: unknown = null;
    for (const attempt of attempts) {
      const { data, error } = await supabase.from('athlete_test_results').insert(attempt.row).select('id').single();
      if (!error) return { id: (data as { id: string } | null)?.id ?? null, attachmentsSaved: attempt.files };
      lastError = error;
    }
    throw lastError;
  }, [connection]);

  /** Change an entered result (needs the edit policy from migration 20260929_…) */
  const updateTestResult = useCallback(async (
    id: string,
    fields: { value: string; recordedAt: string; note?: string; attachments?: string[] },
  ) => {
    const row: Record<string, unknown> = {
      value: fields.value,
      recorded_at: fields.recordedAt,
      note: fields.note ?? null,
    };
    if (fields.attachments) row.attachments = fields.attachments;
    const { data, error } = await supabase.from('athlete_test_results').update(row).eq('id', id).select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("This result can't be edited yet - please ask your coach to run the latest database update.");
  }, []);

  return { connection, schedule, sessionLogs, loading, error, isAthlete, getTodayEntry, getUpcomingDays, updateProfile, getSessionLog, getUnfinishedLog, refetchLogs, refetchSchedule, moveSession, submitTestResult, updateTestResult };
}
