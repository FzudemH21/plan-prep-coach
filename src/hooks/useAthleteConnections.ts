/**
 * useAthleteConnections
 *
 * Coach-side hook for managing athlete_connections rows.
 * Loads all connections for the current coach from Supabase.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface AthleteProfileData {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  birthday?: string | null;      // yyyy-MM-dd
  sex?: string | null;
  sports?: string[];
  team?: string | null;
  occupation?: string | null;
  dailyActivityLevel?: string | null;
}

export interface AthleteConnection {
  id: string;
  coachUserId: string;
  athleteLocalId: string;
  athleteName: string;
  athleteEmail: string | null;
  athleteAuthUserId: string | null;
  inviteCode: string;
  connectedAt: string | null;
  createdAt: string;
  weeksAhead: number;
  profileData: AthleteProfileData;
}

function rowToConnection(row: Record<string, unknown>): AthleteConnection {
  return {
    id: row.id as string,
    coachUserId: row.coach_user_id as string,
    athleteLocalId: row.athlete_local_id as string,
    athleteName: row.athlete_name as string,
    athleteEmail: (row.athlete_email as string) ?? null,
    athleteAuthUserId: (row.athlete_auth_user_id as string) ?? null,
    inviteCode: row.invite_code as string,
    connectedAt: (row.connected_at as string) ?? null,
    createdAt: row.created_at as string,
    weeksAhead: (row.weeks_ahead as number) ?? 4,
    profileData: (row.profile_data as AthleteProfileData) ?? {},
  };
}

export function useAthleteConnections() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<AthleteConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('athlete_connections')
      .select('*')
      .eq('coach_user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setConnections(data.map(rowToConnection));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /** Create a connection for an athlete and return the new row (with invite code). */
  const createConnection = useCallback(async (
    athleteLocalId: string,
    athleteName: string,
    athleteEmail?: string,
    initialProfileData?: AthleteProfileData,
  ): Promise<AthleteConnection> => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('athlete_connections')
      .insert({
        coach_user_id: user.id,
        athlete_local_id: athleteLocalId,
        athlete_name: athleteName,
        athlete_email: athleteEmail ?? null,
        profile_data: initialProfileData ?? {},
      })
      .select()
      .single();
    if (error) throw error;
    const conn = rowToConnection(data as Record<string, unknown>);
    setConnections(prev => [conn, ...prev]);
    return conn;
  }, [user]);

  /** Sync coach-edited athlete profile fields to the shared profile_data column. */
  const syncProfileToConnection = useCallback(async (
    connectionId: string,
    profileData: AthleteProfileData,
  ) => {
    const { error } = await supabase
      .from('athlete_connections')
      .update({ profile_data: profileData })
      .eq('id', connectionId);
    if (error) throw error;
    setConnections(prev =>
      prev.map(c => c.id === connectionId ? { ...c, profileData } : c)
    );
  }, []);

  /** Update how many weeks ahead the athlete can see in the app. */
  const updateWeeksAhead = useCallback(async (connectionId: string, weeks: number) => {
    const { error } = await supabase
      .from('athlete_connections')
      .update({ weeks_ahead: weeks })
      .eq('id', connectionId);
    if (error) throw error;
    setConnections(prev =>
      prev.map(c => c.id === connectionId ? { ...c, weeksAhead: weeks } : c)
    );
  }, []);

  /** Delete a connection (revoke athlete app access). */
  const revokeConnection = useCallback(async (connectionId: string) => {
    const { error } = await supabase
      .from('athlete_connections')
      .delete()
      .eq('id', connectionId);
    if (error) throw error;
    setConnections(prev => prev.filter(c => c.id !== connectionId));
  }, []);

  /** Get the connection for a specific athlete (by their local id in the coach's blob). */
  const getConnectionForAthlete = useCallback(
    (athleteLocalId: string): AthleteConnection | undefined =>
      connections.find(c => c.athleteLocalId === athleteLocalId),
    [connections],
  );

  return {
    connections,
    loading,
    createConnection,
    syncProfileToConnection,
    revokeConnection,
    updateWeeksAhead,
    getConnectionForAthlete,
    reload: load,
  };
}
