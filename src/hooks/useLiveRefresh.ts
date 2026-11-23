/**
 * Takes over what other coaches (or this coach on another device) changed — programs, athletes,
 * libraries, tests / events, the athletes' calendar plans — when the app comes back to the front, and once a minute while it is
 * visible. Each store first compares change times only and loads just what changed; nothing is
 * refreshed while a save is running, and local changes that aren't stored yet are kept
 * (see recordStore.refresh / programStore.refreshPrograms).
 */
import { useEffect, useRef } from 'react';
import { refreshAllRecordStores } from '@/lib/recordStore';
import { refreshPrograms } from '@/lib/programStore';
import { refreshAssignmentPlans } from '@/utils/assignmentPlanStore';

/** Fired on every live refresh — screens that load their own data (anamneses, app connections, …)
 *  reload it quietly (useOnLiveRefresh) */
export const LIVE_REFRESH_EVENT = 'ppc:live-refresh';

/** Runs `reload` on every live refresh (once a minute while the app is visible, and on coming back) */
export function useOnLiveRefresh(reload: () => void): void {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(LIVE_REFRESH_EVENT, handler);
    return () => window.removeEventListener(LIVE_REFRESH_EVENT, handler);
  }, []);
}

/** The same data again: keep the old value, so nothing that depends on it runs again */
export function sameOrNew<T>(prev: T, next: T): T {
  return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
}

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
      window.dispatchEvent(new Event(LIVE_REFRESH_EVENT));
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
