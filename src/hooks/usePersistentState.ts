import { useCallback, useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';

/**
 * UI state kept in this browser (localStorage) — what is folded / expanded in the wizard, so it is
 * the same after leaving and reopening a page. All components using the same key share one value
 * (e.g. every session column of the exercise distribution), and every update starts from the
 * stored value, so they never overwrite each other.
 */

const listeners = new Map<string, Set<() => void>>();

function readRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeRaw(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable — keep it in memory only */ }
  listeners.get(key)?.forEach(listener => listener());
}

function usePersistentJSON<T>(key: string, fallback: T, revive: (parsed: unknown) => T): [T, Dispatch<SetStateAction<T>>] {
  const subscribe = useCallback((listener: () => void) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(listener);
    return () => { listeners.get(key)?.delete(listener); };
  }, [key]);
  const raw = useSyncExternalStore(subscribe, () => readRaw(key));

  const parse = useCallback((text: string | null): T => {
    if (!text) return fallback;
    try { return revive(JSON.parse(text)); } catch { return fallback; }
  }, [fallback, revive]);
  const value = useMemo(() => parse(raw), [raw, parse]);

  const setValue = useCallback((next: SetStateAction<T>) => {
    const current = parse(readRaw(key));
    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(current) : next;
    writeRaw(key, JSON.stringify(resolved instanceof Set ? [...resolved] : resolved));
  }, [key, parse]);

  return [value, setValue];
}

const EMPTY_SET = new Set<string>();
const toSet = (parsed: unknown) => new Set(Array.isArray(parsed) ? parsed.map(String) : []);

/** A set of ids (e.g. the expanded categories), kept in this browser under `key` */
export function usePersistentSet(key: string): [Set<string>, Dispatch<SetStateAction<Set<string>>>] {
  return usePersistentJSON<Set<string>>(key, EMPTY_SET, toSet);
}

const EMPTY_FLAGS: Record<string, boolean> = {};
const toFlags = (parsed: unknown) =>
  (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, boolean> : {});

/** id → true/false (e.g. which sections are collapsed), kept in this browser under `key` */
export function usePersistentFlags(key: string): [Record<string, boolean>, Dispatch<SetStateAction<Record<string, boolean>>>] {
  return usePersistentJSON<Record<string, boolean>>(key, EMPTY_FLAGS, toFlags);
}
