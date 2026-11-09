/**
 * A store kept as one Supabase row per record (e.g. one per athlete) instead of one row holding
 * everything. Pages keep working on the whole data (`T`) as before; `split` cuts it into records and
 * `join` puts them back together. A save compares every record with what is stored and writes only
 * the records that changed — so a save can't touch, let alone overwrite, any other record.
 *
 * - Nothing is saved before the data has really been loaded (a failed load blocks saving).
 * - Removing records is limited per save (`maxRemovalsPerSave` of the `guardedPrefix` records), so a
 *   save built on missing data can't empty the store; removed records keep their row, marked deleted.
 * - A record whose write failed stays "changed" and is written with the next save.
 * - Writes of one record run one after another, the newest last.
 * - The old one-row table stays as a frozen backup: copied over on the first load; afterwards only
 *   records that exist there but not here (e.g. added by a tab still running the old code) are taken.
 * - Without the new table (SQL not run yet) everything works on the old row as before.
 * - A copy in the browser (`cacheKey`) is shown right away while loading, as pages expect the data
 *   at once (e.g. an athlete's page opened directly). Only for showing: nothing is saved before the
 *   real data has loaded, and the loaded data replaces it.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface RecordStoreConfig<T> {
  /** One row per record: (coach_user_id, id, data, deleted_at, updated_at) */
  table: string;
  /** The old one-row-per-coach table: (user_id, data, updated_at) */
  legacyTable: string;
  /** Shown in messages, e.g. "athlete data" */
  label: string;
  defaultValue: () => T;
  /** Brings old stored formats up to date */
  migrate: (raw: unknown) => T;
  split: (data: T) => Record<string, unknown>;
  join: (records: Record<string, unknown>) => T;
  /** Records of which only `maxRemovalsPerSave` may be removed by one save (e.g. athletes) */
  guardedPrefix?: (id: string) => boolean;
  maxRemovalsPerSave?: number;
  /** Browser copy shown while loading (ends in "_sb_cache": dropped first when storage is full) */
  cacheKey?: string;
  /** Older browser copies to remove */
  oldCacheKeys?: string[];
}

type Status = 'idle' | 'loading' | 'loaded' | 'failed';

interface StoreState<T> {
  userId: string | null;
  status: Status;
  mode: 'rows' | 'legacy';
  data: T;
}

export class RecordStoreNotLoadedError extends Error {
  constructor(label: string) {
    super(`Your ${label} has not been loaded yet — nothing was saved`);
    this.name = 'RecordStoreNotLoadedError';
  }
}

const LOAD_ATTEMPTS = 3;

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /not find the table|does not exist/i.test(error.message ?? '');
}

async function withRetries<R>(what: string, run: () => PromiseLike<{ data: R; error: { code?: string; message?: string } | null }>): Promise<R> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await run();
    if (!error) return data;
    if (isMissingTable(error)) throw error;
    console.error(`[recordStore] ${what} failed (attempt ${attempt}):`, error);
    if (attempt >= LOAD_ATTEMPTS) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
}

export interface RecordStore<T> {
  getState: () => StoreState<T>;
  subscribe: (fn: () => void) => () => void;
  ensureLoaded: (userId: string) => Promise<void>;
  reset: () => void;
  save: (next: T) => Promise<void>;
}

export function createRecordStore<T>(config: RecordStoreConfig<T>): RecordStore<T> {
  // ─── Browser copy (only for showing while loading) ──────────────────────────
  const readCache = (): { userId: string; data: T } | null => {
    if (!config.cacheKey) return null;
    try {
      const raw = localStorage.getItem(config.cacheKey);
      const parsed = raw ? JSON.parse(raw) as { userId?: string; data?: unknown } : null;
      return parsed?.userId && parsed.data ? { userId: parsed.userId, data: config.migrate(parsed.data) } : null;
    } catch { return null; }
  };
  const writeCache = (userId: string, data: T) => {
    if (!config.cacheKey) return;
    try { localStorage.setItem(config.cacheKey, JSON.stringify({ userId, data })); } catch { /* only a convenience */ }
  };
  const clearCache = () => {
    try { if (config.cacheKey) localStorage.removeItem(config.cacheKey); } catch { /* ignore */ }
  };
  try { config.oldCacheKeys?.forEach(key => localStorage.removeItem(key)); } catch { /* ignore */ }
  let cached = readCache();

  const fresh = (userId: string | null): StoreState<T> => ({
    userId,
    status: 'idle',
    mode: 'rows',
    // Before the login is known: the copy of whoever used this browser last (replaced right after)
    data: cached && (userId === null || cached.userId === userId) ? cached.data : config.defaultValue(),
  });
  let state: StoreState<T> = fresh(null);
  const listeners = new Set<() => void>();
  let loadPromise: Promise<void> | null = null;
  /** Record id → JSON of the version stored in Supabase (what a save compares against) */
  let stored = new Map<string, string>();
  const seenKey = (userId: string) => `${config.table}LegacySeen_${userId}`;

  const setState = (next: Partial<StoreState<T>>) => {
    state = { ...state, ...next };
    listeners.forEach(fn => fn());
  };

  let warnedLoad = false;
  const warnLoadFailed = () => {
    if (warnedLoad) return;
    warnedLoad = true;
    toast({
      title: `Your ${config.label} could not be loaded`,
      description: 'Changes cannot be saved right now, so nothing gets overwritten. Check the connection and reload the page.',
      variant: 'destructive',
      duration: 15000,
    });
  };
  let warnedSaveAt = 0;
  const warnSaveFailed = () => {
    if (Date.now() - warnedSaveAt < 10000) return;
    warnedSaveAt = Date.now();
    toast({
      title: 'Not saved yet',
      description: `A change to your ${config.label} could not be stored. It is kept and stored with your next change — or reload the page to see what is saved.`,
      variant: 'destructive',
      duration: 10000,
    });
  };

  // ─── Writing ────────────────────────────────────────────────────────────────

  const writeRow = async (userId: string, id: string, data: unknown, deleted: boolean) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from(config.table).upsert(
      { coach_user_id: userId, id, data, deleted_at: deleted ? now : null, updated_at: now },
      { onConflict: 'coach_user_id,id' },
    );
    if (error) throw error;
  };

  // Per record: the version waiting to be written (only the newest is written, one at a time)
  const queued = new Map<string, { data: unknown; json: string; deleted: boolean }>();
  // A record's running write loop; it also writes what is queued meanwhile, so callers wait for it
  const running = new Map<string, Promise<boolean>>();
  const drain = async (userId: string, id: string): Promise<boolean> => {
    let ok = true;
    try {
      for (let entry = queued.get(id); entry; entry = queued.get(id)) {
        queued.delete(id);
        try {
          try {
            await writeRow(userId, id, entry.data, entry.deleted);
          } catch {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await writeRow(userId, id, entry.data, entry.deleted);
          }
          if (state.userId === userId) {
            if (entry.deleted) stored.delete(id); else stored.set(id, entry.json);
          }
        } catch (err) {
          // Not marked as stored: the next save sees it as changed and writes it again
          console.error(`[recordStore] ${config.table}/${id} not saved:`, err);
          ok = false;
        }
      }
    } finally {
      running.delete(id);
    }
    return ok;
  };
  const queueWrite = (userId: string, id: string, data: unknown, json: string, deleted: boolean): Promise<boolean> => {
    queued.set(id, { data, json, deleted });
    const current = running.get(id);
    if (current) return current;
    const loop = drain(userId, id);
    running.set(id, loop);
    return loop;
  };

  let legacyChain: Promise<void> = Promise.resolve();
  const writeLegacy = (userId: string, data: T) => {
    const run = async () => {
      const { error } = await supabase.from(config.legacyTable)
        .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    };
    const next = legacyChain.then(run, run);
    legacyChain = next.catch(() => {});
    return next;
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  const readLegacy = async (userId: string) => {
    const row = await withRetries(`loading the old ${config.label}`, () =>
      supabase.from(config.legacyTable).select('data, updated_at').eq('user_id', userId).maybeSingle());
    return row as { data: unknown; updated_at: string | null } | null;
  };

  const loadRows = async (userId: string): Promise<boolean> => {
    type Row = { id: string; data: unknown; deleted_at: string | null };
    let rows: Row[];
    try {
      rows = await withRetries(`loading the ${config.label}`, () =>
        supabase.from(config.table).select('id, data, deleted_at').eq('coach_user_id', userId)) as Row[];
    } catch (err) {
      if (isMissingTable(err as { code?: string; message?: string })) return false;
      throw err;
    }
    const records: Record<string, unknown> = {};
    const known = new Set<string>();
    stored = new Map();
    rows.forEach(r => {
      known.add(r.id);
      if (r.deleted_at) return;
      records[r.id] = r.data;
      stored.set(r.id, JSON.stringify(r.data));
    });

    // The old row: everything on the first load; later only records missing here
    const legacyMeta = await withRetries(`checking the old ${config.label}`, () =>
      supabase.from(config.legacyTable).select('updated_at').eq('user_id', userId).maybeSingle()) as { updated_at: string | null } | null;
    let seen = '';
    try { seen = localStorage.getItem(seenKey(userId)) ?? ''; } catch { /* no browser storage */ }
    const legacyChanged = !!legacyMeta && (rows.length === 0 || (legacyMeta.updated_at ?? '') !== seen);
    if (legacyChanged) {
      const legacy = await readLegacy(userId); // must succeed on the first copy (else: failed, not empty)
      if (legacy?.data) {
        const legacyRecords = config.split(config.migrate(legacy.data));
        const toCopy = Object.entries(legacyRecords).filter(([id]) => !known.has(id));
        // Copied rows aren't marked as stored until written: a failed copy is retried with the next save
        toCopy.forEach(([id, data]) => { records[id] = data; });
        const results = await Promise.all(toCopy.map(([id, data]) => queueWrite(userId, id, data, JSON.stringify(data), false)));
        if (toCopy.length > 0) console.info(`[recordStore] copied ${toCopy.length} record(s) of the ${config.label} from the old storage`);
        if (results.every(Boolean)) {
          try { localStorage.setItem(seenKey(userId), legacyMeta?.updated_at ?? ''); } catch { /* copied again next time — harmless */ }
        }
      }
    }
    const data = config.join(records);
    setState({ mode: 'rows', status: 'loaded', data });
    writeCache(userId, data);
    return true;
  };

  const loadLegacy = async (userId: string) => {
    const legacy = await readLegacy(userId);
    const data = legacy?.data ? config.migrate(legacy.data) : config.defaultValue();
    setState({ mode: 'legacy', status: 'loaded', data });
    writeCache(userId, data);
  };

  const ensureLoaded = (userId: string): Promise<void> => {
    if (state.userId !== userId) {
      state = fresh(userId);
      stored = new Map();
      loadPromise = null;
    }
    if (state.status === 'loaded') return Promise.resolve();
    if (loadPromise) return loadPromise;
    setState({ status: 'loading' });
    loadPromise = (async () => {
      try {
        if (!(await loadRows(userId))) await loadLegacy(userId);
      } catch (err) {
        console.error(`[recordStore] ${config.table} load failed:`, err);
        if (state.userId === userId) setState({ status: 'failed' });
        warnLoadFailed();
      } finally {
        loadPromise = null;
      }
    })();
    return loadPromise;
  };

  // ─── Saving ─────────────────────────────────────────────────────────────────

  const save = async (next: T): Promise<void> => {
    const userId = state.userId;
    if (!userId || state.status !== 'loaded') {
      toast({ title: `Still loading your ${config.label}`, description: 'This change was not saved — please try again in a moment.', variant: 'destructive' });
      throw new RecordStoreNotLoadedError(config.label);
    }
    if (state.mode === 'legacy') {
      setState({ data: next });
      writeCache(userId, next);
      await writeLegacy(userId, next).catch(err => { console.error('[recordStore] legacy save failed:', err); warnSaveFailed(); });
      return;
    }

    const parts = config.split(next);
    const changed: Array<[string, unknown, string]> = [];
    Object.entries(parts).forEach(([id, data]) => {
      const json = JSON.stringify(data);
      if (stored.get(id) !== json) changed.push([id, data, json]);
    });
    const removed = [...stored.keys()].filter(id => !(id in parts));
    const guardedRemovals = removed.filter(id => config.guardedPrefix?.(id) ?? false);
    if (guardedRemovals.length > (config.maxRemovalsPerSave ?? Infinity)) {
      console.error(`[recordStore] refused a save that would remove ${guardedRemovals.length} records of the ${config.label}`);
      toast({
        title: 'Not saved',
        description: `This change would have removed ${guardedRemovals.length} entries of your ${config.label} at once, so it was stopped. Reload the page.`,
        variant: 'destructive',
        duration: 15000,
      });
      throw new Error('Refused: too many removals in one save');
    }

    setState({ data: next });
    writeCache(userId, next);
    const results = await Promise.all([
      ...changed.map(([id, data, json]) => queueWrite(userId, id, data, json, false)),
      // A removed record keeps its last stored version, marked deleted
      ...removed.map(id => {
        const last = stored.get(id);
        return queueWrite(userId, id, last ? JSON.parse(last) : {}, '', true);
      }),
    ]);
    if (!results.every(Boolean)) warnSaveFailed();
  };

  return {
    getState: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    ensureLoaded,
    // Logged out: forget the data, also the browser copy
    reset: () => { clearCache(); cached = null; state = fresh(null); stored = new Map(); loadPromise = null; listeners.forEach(fn => fn()); },
    save,
  };
}

/** The store's data for components, loading it once the login is known: [data, save, isLoading] */
export function useRecordStore<T>(store: RecordStore<T>): [T, (next: T) => Promise<void>, boolean] {
  const { user, loading: authLoading } = useAuth();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  useEffect(() => {
    if (user) void store.ensureLoaded(user.id);
    else if (!authLoading) store.reset();
  }, [store, user, authLoading]);
  const own = !!user && state.userId === user.id;
  const isLoading = user ? !own || state.status === 'idle' || state.status === 'loading' : authLoading;
  return [state.data, store.save, isLoading];
}
