import { useEffect, useState } from "react";

/**
 * Custom event name used to synchronize multiple useLocalStorage instances
 * that share the same key within the same page/tab.
 *
 * Problem this solves:
 *   Multiple React components can call useLocalStorage with the same key.
 *   Each call creates an independent React state. When one instance updates
 *   its state and writes to localStorage, the other instances are unaware and
 *   will overwrite localStorage with their stale state on the next write —
 *   silently losing data (e.g. a freshly assigned calendar program).
 *
 * Solution:
 *   - Before writing to localStorage we compare the serialized new value with
 *     what is already stored. We only write (and dispatch a sync event) when
 *     the content actually changed.
 *   - Every instance listens for the sync event and updates its React state
 *     from localStorage when another instance has written a newer value.
 *   - The storage event is also handled so cross-tab changes are reflected.
 */
const SAME_PAGE_SYNC_EVENT = "useLocalStorage:sync";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Write to localStorage — but only when the serialized value actually
  // differs from what is already stored. After writing, notify all other
  // instances on this page so they can pull the updated value.
  useEffect(() => {
    try {
      const serialized = JSON.stringify(storedValue);
      const current = window.localStorage.getItem(key);
      if (current !== serialized) {
        window.localStorage.setItem(key, serialized);
        window.dispatchEvent(
          new CustomEvent(SAME_PAGE_SYNC_EVENT, { detail: { key } })
        );
      }
    } catch {}
  }, [key, storedValue]);

  // Receive updates from:
  //   - Other instances on the same page (SAME_PAGE_SYNC_EVENT)
  //   - Other browser tabs / windows (native "storage" event)
  useEffect(() => {
    const handleSamePageSync = (event: Event) => {
      const { detail } = event as CustomEvent<{ key: string }>;
      if (detail.key !== key) return;
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          setStoredValue(JSON.parse(item) as T);
        }
      } catch {}
    };

    const handleCrossTabSync = (event: StorageEvent) => {
      if (event.key !== key || event.newValue === null) return;
      try {
        setStoredValue(JSON.parse(event.newValue) as T);
      } catch {}
    };

    window.addEventListener(SAME_PAGE_SYNC_EVENT, handleSamePageSync);
    window.addEventListener("storage", handleCrossTabSync);
    return () => {
      window.removeEventListener(SAME_PAGE_SYNC_EVENT, handleSamePageSync);
      window.removeEventListener("storage", handleCrossTabSync);
    };
  }, [key]);

  return [storedValue, setStoredValue] as const;
}
