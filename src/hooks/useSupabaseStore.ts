/**
 * useSupabaseStore<T>
 *
 * Generic hook for Supabase-backed data stores that follow the one-row-per-user
 * JSONB pattern. Mirrors useCoachProfile's strategy:
 *   1. Initialise synchronously from a localStorage cache (no flicker)
 *   2. Load from Supabase once auth resolves (source of truth)
 *   3. Migrate legacy localStorage data on first load if no Supabase row exists
 *   4. Optimistic saves: update state + cache immediately, sync to Supabase in bg
 *
 * Saving is only allowed once the data has really been loaded from Supabase. One row holds the
 * whole data (e.g. ALL programs), so a save built on the empty default or on an outdated browser
 * copy would overwrite everything stored. The latest data is kept in memory (`_latest`), so it
 * doesn't depend on the browser copy (which can be dropped when browser storage runs full).
 *
 * Table schema expected (see migration SQL):
 *   id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *   user_id     uuid REFERENCES auth.users NOT NULL UNIQUE
 *   data        jsonb NOT NULL
 *   updated_at  timestamptz DEFAULT now()
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

// ─── Module-level dedup guard ─────────────────────────────────────────────────
// Prevents multiple hook instances (e.g. per-day-cell) from each firing their
// own Supabase fetch for the same table+user. Only the first instance fetches;
// subsequent instances subscribe to the result and update when it lands.
const _fetchedKeys = new Set<string>();
// Callbacks registered by secondary instances waiting for the first fetch.
const _pendingCallbacks = new Map<string, Array<(data: unknown) => void>>();
// Tables whose first fetch has finished — only then is `isLoading` false. Before, an instance that
// started from the localStorage cache reported "loaded" while the fetch was still running, and the
// fetched (newer or older) data then replaced what had been built on the cache in the meantime.
const _loadedKeys = new Set<string>();
// The latest data of every loaded table ("userId:table" → data) — what saves and newly mounted
// instances build on (the browser copy can be missing or outdated)
const _latest = new Map<string, unknown>();

/** Thrown by a save before the data was loaded from Supabase — nothing was saved */
export class StoreNotLoadedError extends Error {
  constructor(tableName: string) {
    super(`"${tableName}" has not been loaded yet — nothing was saved`);
    this.name = 'StoreNotLoadedError';
  }
}

let lastNotLoadedToast = 0;
function warnNotLoaded() {
  if (Date.now() - lastNotLoadedToast < 5000) return;
  lastNotLoadedToast = Date.now();
  toast({ title: 'Still loading your data', description: 'This change was not saved — please try again in a moment.', variant: 'destructive' });
}

let loadFailedWarned = false;
function warnLoadFailed() {
  if (loadFailedWarned) return;
  loadFailedWarned = true;
  toast({
    title: 'Your data could not be loaded',
    description: 'Changes cannot be saved right now, so nothing gets overwritten. Check the connection and reload the page.',
    variant: 'destructive',
    duration: 15000,
  });
}

// ─── Cross-instance sync ──────────────────────────────────────────────────────
// Every mounted hook instance of a table registers here. When one instance saves (or the
// table is updated via updateSupabaseStoreData), all instances get the new data — otherwise
// a page holding a stale copy would overwrite the newer data on its next save.
const _instances = new Map<string, Set<(data: unknown) => void>>();

function notifyInstances(tableName: string, data: unknown, except?: (data: unknown) => void): void {
  _instances.get(tableName)?.forEach(fn => { if (fn !== except) fn(data); });
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function readCache<T>(cacheKey: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCache<T>(cacheKey: string, value: T | null): void {
  if (value !== null) {
    localStorage.setItem(cacheKey, JSON.stringify(value));
  } else {
    localStorage.removeItem(cacheKey);
  }
}

// ─── Supabase upsert ──────────────────────────────────────────────────────────

async function upsertRow<T>(
  tableName: string,
  userId: string,
  data: T,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(tableName)
    .upsert({ user_id: userId, data, updated_at: now }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSupabaseStoreOptions<T> {
  /** Supabase table name, e.g. "training_programs" */
  tableName: string;
  /** localStorage key used as sync cache AND for legacy migration */
  legacyKey: string;
  /** Value returned before any data is available */
  defaultValue: T;
  /**
   * Optional migration transform applied to raw localStorage data before it
   * is written to Supabase. Use this to run the same schema migrations that
   * already existed in the hook. If omitted, data is used as-is.
   */
  migrate?: (raw: unknown) => T;
}

export function useSupabaseStore<T>({
  tableName,
  legacyKey,
  defaultValue,
  migrate,
}: UseSupabaseStoreOptions<T>): [T, (newData: T) => Promise<void>, boolean] {
  const { user, loading: authLoading } = useAuth();

  // Cache key — separate from the legacy key so we never accidentally wipe it
  const cacheKey = `${legacyKey}_sb_cache`;

  // Sync-init from cache (no flicker on revisit)
  const [data, setData] = useState<T>(() => readCache<T>(cacheKey) ?? defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const defaultRef = useRef(defaultValue);

  // Receive saves made by other instances of the same table
  const receiveRef = useRef<(incoming: unknown) => void>((incoming) => setData(incoming as T));
  useEffect(() => {
    const receive = receiveRef.current;
    const set = _instances.get(tableName) ?? new Set();
    set.add(receive);
    _instances.set(tableName, set);
    return () => { set.delete(receive); };
  }, [tableName]);

  // Prevent the load effect from running twice in StrictMode
  const loadedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      // While the login is still being checked there is no user yet — that is not "loaded"
      // (reporting it made callers act on the empty default data). Only a finished check
      // without a user (logged out) ends the loading.
      if (!authLoading) setIsLoading(false);
      return;
    }
    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;

    const fetchKey = `${user.id}:${tableName}`;

    // Another instance is already fetching (or has fetched) this table.
    if (_fetchedKeys.has(fetchKey)) {
      const cached = readCache<T>(cacheKey);
      if (_loadedKeys.has(fetchKey)) {
        // First fetch done — the latest data is in memory (the cache may be missing)
        const latest = _latest.has(fetchKey) ? (_latest.get(fetchKey) as T) : cached;
        if (latest !== null) setData(latest);
        setIsLoading(false);
      } else {
        // First fetch still in flight: show the cache meanwhile, but stay "loading" until it lands
        if (cached !== null) setData(cached);
        const callbacks = _pendingCallbacks.get(fetchKey) ?? [];
        callbacks.push((loaded) => {
          if (loaded !== null) setData(loaded as T);
          setIsLoading(false);
        });
        _pendingCallbacks.set(fetchKey, callbacks);
      }
      return;
    }
    _fetchedKeys.add(fetchKey);

    (async () => {
      let resolvedData: T | null = null;
      // Only a load that really reached Supabase allows saving (see the header)
      let loaded = false;
      try {
        // A failed load (e.g. a network hiccup) is tried again before giving up
        let row: { data: unknown } | null = null;
        for (let attempt = 0; ; attempt++) {
          const result = await supabase
            .from(tableName)
            .select('data')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!result.error) { row = result.data; break; }
          console.error(`[useSupabaseStore:${tableName}] load error (attempt ${attempt + 1}):`, result.error);
          if (attempt >= 2) {
            _fetchedKeys.delete(fetchKey); // allow retry on next mount
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }

        if (row) {
          // Supabase row exists — it is the source of truth
          const loadedData = row.data as T;
          setData(loadedData);
          writeCache(cacheKey, loadedData);
          resolvedData = loadedData;
          loaded = true;
        } else {
          // No Supabase row — try to migrate from legacy localStorage
          const legacyRaw = (() => {
            try {
              const s = localStorage.getItem(legacyKey);
              return s ? (JSON.parse(s) as unknown) : null;
            } catch {
              return null;
            }
          })();

          if (legacyRaw !== null) {
            const migrated = migrate ? migrate(legacyRaw) : (legacyRaw as T);
            try {
              await upsertRow(tableName, user.id, migrated);
              setData(migrated);
              writeCache(cacheKey, migrated);
              localStorage.removeItem(legacyKey);
              resolvedData = migrated;
              loaded = true;
            } catch (err) {
              console.error(`[useSupabaseStore:${tableName}] migration error:`, err);
            }
          } else {
            // Check if there's cached data that was saved before auth resolved
            const cached = readCache<T>(cacheKey);
            if (cached) {
              try {
                await upsertRow(tableName, user.id, cached);
              } catch (err) {
                console.error(`[useSupabaseStore:${tableName}] cache-sync error:`, err);
              }
            }
            // Nothing stored yet: the browser copy, or the empty default, is the data
            resolvedData = cached ?? defaultRef.current;
            loaded = true;
          }
        }
      } finally {
        if (loaded) {
          _loadedKeys.add(fetchKey);
          _latest.set(fetchKey, resolvedData);
        } else {
          // Not loaded: saving stays blocked, so nothing stored gets overwritten
          warnLoadFailed();
        }
        setIsLoading(false);
        // Every mounted instance gets the fetched data (not only this one and the waiting ones)
        if (resolvedData !== null) notifyInstances(tableName, resolvedData, receiveRef.current);
        // Notify any instances that were waiting for this fetch to complete.
        const waiting = _pendingCallbacks.get(fetchKey);
        if (waiting) {
          // Pass resolvedData (may be null if no row existed); callback handles both.
          waiting.forEach((cb) => cb(resolvedData));
          _pendingCallbacks.delete(fetchKey);
        }
      }
    })();
  }, [user?.id, authLoading, tableName, legacyKey, cacheKey, migrate]);

  // Optimistic save: state + cache first, Supabase in background. Only once the data has been
  // loaded — a save built on unloaded data would overwrite everything stored (see the header).
  const save = useCallback(
    async (newData: T): Promise<void> => {
      if (user) {
        const key = `${user.id}:${tableName}`;
        if (!_loadedKeys.has(key)) {
          warnNotLoaded();
          throw new StoreNotLoadedError(tableName);
        }
        _latest.set(key, newData);
      } else if (authLoading) {
        // The login is still being checked — the data isn't known yet
        warnNotLoaded();
        throw new StoreNotLoadedError(tableName);
      }
      setData(newData);
      writeCache(cacheKey, newData);
      notifyInstances(tableName, newData, receiveRef.current);
      if (!user) return;
      try {
        await upsertRow(tableName, user.id, newData);
      } catch (err) {
        console.error(`[useSupabaseStore:${tableName}] save error:`, err);
      }
    },
    [user, authLoading, tableName, cacheKey],
  );

  return [data, save, isLoading];
}

/**
 * Update a store from outside a component (e.g. propagating an exercise rename into every
 * program). If an instance of the table is mounted, the local cache is the freshest copy (it's
 * written before every upsert); otherwise the row is fetched from Supabase first, so an outdated
 * cache (e.g. edited on another device) can't overwrite newer server data. Mounted instances are
 * updated too. The updater returns the same object when nothing changed (then nothing is saved).
 */
export async function updateSupabaseStoreData<T>(
  tableName: string,
  legacyKey: string,
  updater: (current: T) => T,
): Promise<void> {
  const cacheKey = `${legacyKey}_sb_cache`;
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  // Loaded in this app: the latest data in memory. Otherwise straight from Supabase (the browser
  // copy can be missing or outdated). Logged out: the browser copy is all there is.
  const key = userId ? `${userId}:${tableName}` : null;
  let current: T | null = null;
  if (!key) {
    current = readCache<T>(cacheKey);
  } else if (_loadedKeys.has(key) && _latest.has(key)) {
    current = _latest.get(key) as T;
  } else {
    const { data: row, error } = await supabase.from(tableName).select('data').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    current = (row?.data as T | undefined) ?? null;
  }
  if (current === null) return;

  const next = updater(current);
  if (next === current) return;

  if (key && _loadedKeys.has(key)) _latest.set(key, next);
  writeCache(cacheKey, next);
  notifyInstances(tableName, next);
  if (userId) await upsertRow(tableName, userId, next);
}
