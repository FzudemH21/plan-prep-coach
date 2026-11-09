/**
 * Keeps every connected athlete's progress the same in the desktop app, the coach phone app and the
 * athlete app. Mounted once in each coach layout; renders nothing.
 *
 * - A test result an athlete reported for a parameter the coach doesn't track for them yet: the
 *   parameter is tracked, so the result shows everywhere (daily check-in answers and parameters
 *   asked in the athlete's check-in belong to Monitoring and are left out).
 * - The athlete app's copy of the progress (metrics snapshot) is updated whenever it differs —
 *   after any change on any device, not only when the coach opens the desktop Performance tab.
 *
 * Only works once everything is loaded (athletes, parameters, connections), so a half-loaded state
 * can't replace the athlete's copy with an empty one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { athleteStore, useAthletes } from '@/hooks/useAthletes';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { parseMeasureRef } from '@/utils/parameterMeasures';
import { toParameterId } from '@/utils/parameterRef';
import { buildMetricsSnapshot, sameMetricsSnapshot } from '@/utils/metricsSnapshot';

const PAGE = 1000;
const SETTLE_MS = 1500;

export function AthleteProgressSync() {
  const athleteData = useAthletes();
  const { data: paramDb, isLoading: paramsLoading } = useParametersDataV2();
  const { connections, loading: connectionsLoading, updateMetricsSnapshot, refresh } = useAthleteConnections();
  // Connection id → parameter ids the athlete reported test results for
  const [reported, setReported] = useState<Map<string, Set<string>> | null>(null);

  const connectionIds = connections.map(c => c.id).sort().join(',');
  const loadReported = useCallback(async () => {
    const ids = connectionIds ? connectionIds.split(',') : [];
    if (ids.length === 0) { setReported(new Map()); return; }
    const map = new Map<string, Set<string>>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('athlete_test_results')
        .select('athlete_connection_id, parameter_id')
        .in('athlete_connection_id', ids)
        .not('parameter_id', 'like', '%::src:checkin%')
        .range(from, from + PAGE - 1);
      if (error) { console.warn('[AthleteProgressSync] results not loaded:', error); return; }
      for (const row of (data ?? []) as Array<{ athlete_connection_id: string; parameter_id: string }>) {
        const ref = parseMeasureRef(row.parameter_id);
        if (ref.checkin) continue;
        const set = map.get(row.athlete_connection_id) ?? new Set<string>();
        set.add(toParameterId(ref.parameterId));
        map.set(row.athlete_connection_id, set);
      }
      if (!data || data.length < PAGE) break;
    }
    setReported(map);
  }, [connectionIds]);

  useEffect(() => { if (!connectionsLoading) void loadReported(); }, [connectionsLoading, loadReported]);

  // Coming back to the app: results the athlete entered meanwhile, and the latest connections
  useEffect(() => {
    const onFocus = () => { void refresh(); void loadReported(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh, loadReported]);

  // Only the really loaded athlete data — not the browser copy shown meanwhile or after a failed load
  const athletesLoaded = !athleteData.isLoading && athleteStore.getState().status === 'loaded';

  // 1. Track parameters the athlete reported results for
  const trackingStarted = useRef(new Set<string>());
  const parameters = paramDb?.parameters;
  useEffect(() => {
    if (!athletesLoaded || paramsLoading || connectionsLoading || !reported || !parameters?.length) return;
    const known = new Set(parameters.map(p => p.id));
    connections.forEach(connection => {
      const athleteId = connection.athleteLocalId;
      if (!athleteData.getAthlete(athleteId)) return;
      const tracked = new Set(athleteData.getAthletePerformanceParameters(athleteId).map(pp => pp.athleticismParameterId));
      // Older check-in answers have no check-in tag — the parameters the check-in asks stay in Monitoring
      const askedInCheckin = new Set(
        (connection.monitoringConfig?.blocks ?? []).flatMap(b => [
          b.config?.parameterId,
          b.config?.storageRef ? toParameterId(parseMeasureRef(b.config.storageRef).parameterId) : undefined,
        ]).filter((id): id is string => !!id),
      );
      reported.get(connection.id)?.forEach(paramId => {
        const key = `${athleteId}:${paramId}`;
        if (tracked.has(paramId) || askedInCheckin.has(paramId) || !known.has(paramId) || trackingStarted.current.has(key)) return;
        trackingStarted.current.add(key);
        athleteData.addPerformanceParameter(athleteId, paramId).catch(() => { trackingStarted.current.delete(key); });
      });
    });
  }, [athleteData, athletesLoaded, paramsLoading, connectionsLoading, reported, parameters, connections]);

  // 2. The athlete app's copy of the progress
  const pushing = useRef(new Set<string>());
  useEffect(() => {
    if (!athletesLoaded || paramsLoading || connectionsLoading || !parameters?.length) return;
    const timer = setTimeout(() => {
      connections.forEach(connection => {
        const athleteId = connection.athleteLocalId;
        if (!athleteData.getAthlete(athleteId) || pushing.current.has(connection.id)) return;
        const snapshot = buildMetricsSnapshot({
          biometrics: athleteData.getAthleteBiometrics(athleteId),
          biometricDefinitions: athleteData.biometricDefinitions,
          performanceParams: athleteData.getAthletePerformanceParameters(athleteId),
          parameters,
        });
        if (sameMetricsSnapshot(snapshot, connection.profileData.metricsSnapshot)) return;
        pushing.current.add(connection.id);
        console.info(`[AthleteProgressSync] updating the athlete app's progress of ${connection.athleteName}`);
        updateMetricsSnapshot(connection.id, snapshot)
          .catch(err => console.warn('[AthleteProgressSync] snapshot not saved:', err))
          .finally(() => pushing.current.delete(connection.id));
      });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [athleteData, athletesLoaded, paramsLoading, connectionsLoading, parameters, connections, updateMetricsSnapshot]);

  return null;
}
