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
 * Mounted in the coach layouts; runs once all three stores have loaded. After the move it only
 * repairs: body metrics from the backup that are missing in the parameter database (e.g. a save
 * from an outdated copy of the parameter database dropped them) are added again. Safe to run twice
 * (existing ids are skipped).
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
    if (athletes.biometricsMigrated) {
      // Already moved — body metrics dropped from the parameter database by a save from an outdated
      // copy are added again (dropped together with their "imported" mark); ones the coach deleted
      // on purpose keep their mark and stay deleted
      const known = new Set(params.data.parameters.map(p => p.id));
      const imported = new Set(params.data.importedBiometricIds ?? []);
      const missing = athletes.movedBiometricDefinitions.filter(d => !known.has(d.id) && !imported.has(d.id));
      started.current = true;
      if (missing.length === 0) return;
      params.importParameters(biometricDefinitionsAsParameters(missing, new Date().toISOString()))
        .then(n => console.info(`[biometrics] restored ${n} body metrics in the parameter database`))
        .catch(err => console.error('[biometrics] restoring body metrics failed', err));
      return;
    }
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
