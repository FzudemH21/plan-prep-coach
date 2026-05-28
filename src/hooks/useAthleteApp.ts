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

export interface ExerciseSummary {
  id: string;
  name: string;
  order: number;
  sectionId?: string;
  sectionName?: string;
  sectionOrder?: number;
  notes?: string;
  isCircuit?: boolean;
  // Planned values synced from coach periodization table
  methodKey?: string;
  plannedSets?: number;
  plannedParams?: Record<string, string | number>;
  visibleParams?: string[];
}

export interface SessionSummary {
  id: string;
  name: string;
  order: number;
  methodCount: number;
  exerciseCount: number;
  duration?: number;
  notes?: string;
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
    if (!user || !isAthlete) { setLoading(false); return; }

    async function load() {
      try {
        // Load connection
        const { data: connData, error: connErr } = await supabase
          .from('athlete_connections')
          .select('*')
          .eq('athlete_auth_user_id', user!.id)
          .single();
        if (connErr) throw connErr;
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

        // Load schedule (90-day window around today)
        const today = new Date();
        const from = new Date(today); from.setDate(today.getDate() - 7);
        const to = new Date(today); to.setDate(today.getDate() + 90);
        const fromStr = from.toISOString().slice(0, 10);
        const toStr = to.toISOString().slice(0, 10);

        const { data: schedData, error: schedErr } = await supabase
          .from('athlete_schedule')
          .select('*')
          .eq('athlete_connection_id', conn.id)
          .gte('date', fromStr)
          .lte('date', toStr)
          .order('date', { ascending: true });
        if (schedErr) throw schedErr;

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
    const today = new Date().toISOString().slice(0, 10);
    return schedule.find(e => e.date === today) ?? null;
  };

  const getUpcomingDays = (n = 7): AthleteScheduleEntry[] => {
    const today = new Date().toISOString().slice(0, 10);
    return schedule.filter(e => e.date >= today).slice(0, n);
  };

  return { connection, schedule, loading, error, isAthlete, getTodayEntry, getUpcomingDays, updateProfile };
}
