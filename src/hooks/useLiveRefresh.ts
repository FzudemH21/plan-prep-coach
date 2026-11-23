/**
 * Takes over what other coaches (or this coach on another device) changed — programs, athletes,
 * libraries, tests / events, the athletes' calendar plans — when the app comes back to the front, and once a minute while it is
 * visible. Each store first compares change times only and loads just what changed; nothing is
 * refreshed while a save is running, and local changes that aren't stored yet are kept
 * (see recordStore.refresh / programStore.refreshPrograms).
 */
import { useEffect } from 'react';
import { refreshAllRecordStores } from '@/lib/recordStore';
import { refreshPrograms } from '@/lib/programStore';
import { refreshAssignmentPlans } from '@/utils/assignmentPlanStore';

const MIN_GAP_MS = 15_000;
const EVERY_MS = 60_000;

export function useLiveRefresh() {
  useEffect(() => {
    let last = Date.now(); // the stores were just loaded
    let running = false;
    const run = () => {
      if (document.visibilityState !== 'visible' || running || Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      running = true;
      void Promise.all([refreshAllRecordStores(), refreshPrograms().catch(() => []), refreshAssignmentPlans()])
        .finally(() => { running = false; });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(run, EVERY_MS);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);
}
