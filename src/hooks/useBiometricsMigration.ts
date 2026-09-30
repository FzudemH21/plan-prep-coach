/**
 * useBiometricsMigration — one-time move of body metrics into the parameter database.
 *
 * Body metrics (Height, Weight, Body Fat, Resting Heart Rate and custom ones) used to be a separate
 * list in the athlete database. They become parameters marked "Biometric" — with the SAME ids, so
 * formula references (e.g. %BW → Weight), monitoring check-ins and old "bio:{id}" test links keep
 * pointing at them — and each athlete's values move to the performance values of that parameter.
 *
 * Order: 1. parameters added to the parameter database, 2. values moved in the athlete database
 * (marks it migrated, keeps the old lists as a backup), 3. calendar test links "bio:{id}" → "{id}".
 * Mounted in the coach layouts; runs once all three stores have loaded, and never again after the
 * athlete database is marked migrated. Safe to run twice (existing ids are skipped).
 */
import { useEffect, useRef } from 'react';
import { useAthletes } from '@/hooks/useAthletes';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { biometricDefinitionsAsParameters } from '@/utils/biometricsMigration';

export function useBiometricsMigration() {
  const athletes = useAthletes();
  const params = useParametersDataV2();
  const calendar = useCalendarEvents();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (athletes.isLoading || params.isLoading || !calendar.isLoaded || !params.data) return;
    if (athletes.biometricsMigrated) return;
    started.current = true;
    (async () => {
      await params.importParameters(biometricDefinitionsAsParameters(athletes.biometricDefinitions, new Date().toISOString()));
      await athletes.moveBiometricsToParameters();
      const links = await calendar.normalizeParameterRefs();
      console.info(`[biometrics] moved ${athletes.biometricDefinitions.length} body metrics to the parameter database; ${links} test links updated`);
    })().catch(err => {
      // Not retried in this session (it would repeat on every render); the next page load retries
      console.error('[biometrics] migration failed — will retry on next load', err);
    });
  }, [athletes, params, calendar]);
}
