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

export interface AthleteScheduleEntry {
  id: string;
  date: string;          // yyyy-MM-dd
  intensity: string | null;
  sessions: SessionSummary[];
  programName: string | null;
  mesocycleName: string | null;
  microcycleName: string | null;
}

export function useAthleteApp() {
  const { user, loading: authLoading } = useAuth();
  const [connection, setConnection] = useState<AthleteConnection | null>(null);
  const [schedule, setSchedule] = useState<AthleteScheduleEntry[]>([]);
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
          programName: row.program_name as string | null,
          mesocycleName: row.mesocycle_name as string | null,
          microcycleName: row.microcycle_name as string | null,
        })));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load athlete data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, authLoading, isAthlete]);

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

  return { connection, schedule, loading, error, isAthlete, getTodayEntry, getUpcomingDays, updateProfile };
}
