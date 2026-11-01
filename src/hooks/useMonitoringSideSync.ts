/**
 * useMonitoringSideSync — keeps the athletes' daily check-in questions in step with the parameter
 * database: "recorded per side" (the athlete app asks Left / Right) and the test instructions /
 * demo video ("How to do it"), without the coach saving each question again. Mounted in the coach
 * layouts; runs once per page load, after the parameter database and the app connections have
 * loaded. Only those fields of questions whose parameter is in the database change (see
 * syncMonitoringFromParameters).
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { monitoringOutOfSync, syncMonitoringFromParameters, type MonitoringParamInfo } from '@/utils/athleteProfileSync';

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
    const infoById = new Map<string, MonitoringParamInfo>(params.data.parameters.map(p => [p.id, {
      perSide: !!p.perSide, instructions: p.testInstructions, videoUrl: p.testVideoUrl,
    }]));
    for (const conn of connections) {
      if (!monitoringOutOfSync(conn.profileData?.monitoringConfig, infoById)) continue;
      syncMonitoringFromParameters(conn.id, infoById)
        .catch(err => console.error('[monitoring] sync with the parameter database failed', err));
    }
  }, [user, params, connections, loading]);
}
