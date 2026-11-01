import { toast } from '@/hooks/use-toast';

/**
 * Browser storage (localStorage) holds ~5 MB per site. It keeps the wizard's working data AND
 * offline copies of the Supabase data ("<key>_sb_cache" — saved programs, libraries, athletes …,
 * fetched again on every load). With a big plan the two together can run out of space; a failed
 * write then threw and crashed the page (e.g. the second microcycle copy in exercise distribution).
 *
 * This guard makes every localStorage write safe, app-wide:
 * - plan data that doesn't fit makes room by dropping offline copies (largest first) and retries
 * - an offline copy that doesn't fit is simply not kept (it never pushes plan data out)
 * - if it still doesn't fit, the coach gets a warning instead of a crash
 */

const CACHE_SUFFIX = '_sb_cache';

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22
  );
}

/** Offline copies of Supabase data, largest first */
function cacheKeysBySize(storage: Storage, except: string): string[] {
  const keys: Array<[string, number]> = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.endsWith(CACHE_SUFFIX) && key !== except) keys.push([key, storage.getItem(key)?.length ?? 0]);
  }
  return keys.sort((a, b) => b[1] - a[1]).map(([key]) => key);
}

let warned = false;
function warnStorageFull() {
  if (warned) return;
  warned = true;
  toast({
    title: 'Browser storage is full',
    description: 'The latest change is too large for this browser and could not be kept. Reload the page to continue from the last saved state.',
    variant: 'destructive',
    duration: 10000,
  });
}

let installed = false;
export function installStorageGuard() {
  if (installed || typeof Storage === 'undefined') return;
  installed = true;
  const originalSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function guardedSetItem(this: Storage, key: string, value: string) {
    try {
      originalSetItem.call(this, key, value);
      return;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
    }

    // An offline copy that doesn't fit: don't keep it (it is fetched again on the next load)
    if (key.endsWith(CACHE_SUFFIX)) {
      this.removeItem(key);
      return;
    }

    // Plan data: make room by dropping offline copies, largest first
    for (const cacheKey of cacheKeysBySize(this, key)) {
      this.removeItem(cacheKey);
      try {
        originalSetItem.call(this, key, value);
        return;
      } catch (error) {
        if (!isQuotaError(error)) throw error;
      }
    }

    console.error(`Browser storage full — "${key}" could not be kept in this browser`);
    warnStorageFull();
  };
}
