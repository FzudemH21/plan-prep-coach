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
 * Table schema expected (see migration SQL):
 *   id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *   user_id     uuid REFERENCES auth.users NOT NULL UNIQUE
 *   data        jsonb NOT NULL
 *   updated_at  timestamptz DEFAULT now()
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

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
  const { error } = await supabase.from(tableName).upsert(
    { user_id: userId, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
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
  const { user } = useAuth();

  // Cache key — separate from the legacy key so we never accidentally wipe it
  const cacheKey = `${legacyKey}_sb_cache`;

  // Sync-init from cache (no flicker on revisit)
  const [data, setData] = useState<T>(() => readCache<T>(cacheKey) ?? defaultValue);
  const [isLoading, setIsLoading] = useState(true);

  // Prevent the load effect from running twice in StrictMode
  const loadedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;

    (async () => {
      try {
        const { data: row, error } = await supabase
          .from(tableName)
          .select('data')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error(`[useSupabaseStore:${tableName}] load error:`, error);
          return;
        }

        if (row) {
          // Supabase row exists — it is the source of truth
          const loaded = row.data as T;
          setData(loaded);
          writeCache(cacheKey, loaded);
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
            // State is already correct from initial sync-init
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user?.id, tableName, legacyKey, cacheKey, migrate]);

  // Optimistic save: state + cache first, Supabase in background
  const save = useCallback(
    async (newData: T): Promise<void> => {
      setData(newData);
      writeCache(cacheKey, newData);
      if (!user) return;
      try {
        await upsertRow(tableName, user.id, newData);
      } catch (err) {
        console.error(`[useSupabaseStore:${tableName}] save error:`, err);
      }
    },
    [user, tableName, cacheKey],
  );

  return [data, save, isLoading];
}
