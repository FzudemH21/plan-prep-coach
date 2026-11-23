/**
 * useAthleteOverviewLayout — the charts pinned to an athlete's overview (Analysis tab, "Stimulus &
 * Performance": method panels and performance series), the same for every coach of the athlete.
 *
 * Stored in Supabase, one row per athlete (coach_records, store "athlete_views", id "_a:<athlete>"
 * — the "_" keeps it out of "Recent changes", it's a view setting, not an item). Before
 * (2026-11-23) the choice lived only in the browser (localStorage ov_panels_<id> / ov_perf_<id>):
 * an athlete without a stored layout shows this browser's, and the first change stores it.
 */
import { useCallback, useMemo, useRef } from 'react';
import { createRecordStore, useRecordStore } from '@/lib/recordStore';
import { joinMap, splitMap } from '@/lib/recordSplit';

interface OverviewLayout {
  panels?: unknown[];
  perf?: unknown[];
}
type LayoutIndex = Record<string, OverviewLayout>;

const PREFIX = '_a:';

function normalize(raw: unknown): LayoutIndex {
  const out: LayoutIndex = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.entries(raw as Record<string, unknown>).forEach(([athleteId, value]) => {
    if (!value || typeof value !== 'object') return;
    const v = value as OverviewLayout;
    out[athleteId] = {
      ...(Array.isArray(v.panels) ? { panels: v.panels } : {}),
      ...(Array.isArray(v.perf) ? { perf: v.perf } : {}),
    };
  });
  return out;
}

export const athleteOverviewStore = createRecordStore<LayoutIndex>({
  table: 'coach_records',
  store: 'athlete_views',
  label: 'athlete overviews',
  // Athlete data: the organization's for members; may be empty (nothing pinned yet)
  area: 'athletes',
  sharedMayBeEmpty: true,
  defaultValue: () => ({}),
  migrate: normalize,
  split: data => splitMap(data, PREFIX),
  join: records => normalize(joinMap(records, PREFIX)),
  // The app never removes an athlete's layout — at most one per save, just in case
  guardedPrefix: id => id.startsWith(PREFIX),
  maxRemovalsPerSave: 1,
  cacheKey: 'coach_records_athlete_views_sb_cache',
});

function readBrowserCopy<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

type Update<T> = T[] | ((prev: T[]) => T[]);

export function useAthleteOverviewLayout<P, S>(athleteId: string) {
  const [index, , isLoading] = useRecordStore(athleteOverviewStore);
  const stored = index[athleteId];

  // Not stored for this athlete yet: what this browser had (before the layout was shared)
  const browserPanels = useMemo(() => readBrowserCopy<P>(`ov_panels_${athleteId}`), [athleteId]);
  const browserPerf = useMemo(() => readBrowserCopy<S>(`ov_perf_${athleteId}`), [athleteId]);
  const panels = (stored?.panels as P[] | undefined) ?? (stored ? [] : browserPanels);
  const perf = (stored?.perf as S[] | undefined) ?? (stored ? [] : browserPerf);

  // The newest layout (two changes before the next render build on each other)
  const latest = useRef({ panels, perf });
  latest.current = { panels, perf };

  const write = useCallback((next: { panels: P[]; perf: S[] }) => {
    latest.current = next;
    const state = athleteOverviewStore.getState();
    if (state.status !== 'loaded') return; // still loading: not stored (recordStore would warn)
    void athleteOverviewStore.save({ ...state.data, [athleteId]: { panels: next.panels, perf: next.perf } })
      .catch(err => console.error('[overview] layout not saved', err));
  }, [athleteId]);

  const setPanels = useCallback((update: Update<P>) => {
    const prev = latest.current;
    write({ ...prev, panels: typeof update === 'function' ? update(prev.panels) : update });
  }, [write]);

  const setPerf = useCallback((update: Update<S>) => {
    const prev = latest.current;
    write({ ...prev, perf: typeof update === 'function' ? update(prev.perf) : update });
  }, [write]);

  return { panels, perf, setPanels, setPerf, isLoading };
}
