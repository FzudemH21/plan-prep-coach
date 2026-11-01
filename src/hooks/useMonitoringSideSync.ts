/**
 * useMonitoringSideSync — keeps "recorded per side" on the athletes' daily check-in questions in
 * step with the parameter database, so the athlete app asks Left / Right (or stops asking) without
 * the coach saving each question again. Mounted in the coach layouts; runs once per page load,
 * after the parameter database and the app connections have loaded. Only the per-side mark of
 * questions whose parameter is in the database changes (see syncMonitoringSides).
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { monitoringSidesOutOfSync, syncMonitoringSides } from '@/utils/athleteProfileSync';

export function useMonitoringSideSync() {
  const { user } = useAuth();
  const params = useParametersDataV2();
  const { connections, loading } = useAthleteConnections();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    // Only with the coach's real data: signed in and both loaded from the server
    if (!user || params.isLoading || !params.data || loading) return;
    started.current = true;
    const perSideById = new Map(params.data.parameters.map(p => [p.id, !!p.perSide]));
    for (const conn of connections) {
      if (!monitoringSidesOutOfSync(conn.profileData?.monitoringConfig, perSideById)) continue;
      syncMonitoringSides(conn.id, perSideById)
        .catch(err => console.error('[monitoring] per-side sync failed', err));
    }
  }, [user, params, connections, loading]);
}
