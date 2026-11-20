/**
 * Edit locks for athletes, per item (supabase/migrations/20261120_athlete_locks_per_item.sql).
 *
 * Only what is being edited is locked: the athlete's profile form ('profile') or one anamnesis
 * ('anamnesis:<id>'). The lock is taken when the coach clicks Edit and held while that edit mode is
 * open — renewed every 10 s (and at once when the tab comes back to the front), given back shortly
 * after the edit mode closes, and at once when the tab is closed or reloaded. A lock not renewed for
 * 2 minutes is free. Other coaches see "… is editing" next to that item's Edit button; owners can
 * take the lock over — the coach who had it then leaves edit mode (unsaved changes are not saved).
 *
 * Before the SQL has run (functions missing) or offline: no lock — editing works as before.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** 'profile' or `anamnesis:<id>` */
export type AthleteLockItem = 'profile' | `anamnesis:${string}`;

export interface AthleteLockResult {
  acquired: boolean;
  holderName: string;
  /** The caller may take the lock over (owners) */
  canTakeOver: boolean;
}

interface LockRow { acquired: boolean; holder_name: string | null; can_take_over: boolean | null }

const RENEW_MS = 10_000;
const RELEASE_DELAY_MS = 2_000;

/** Takes (or renews) a lock. Without the SQL / offline: counts as taken (works as before). */
export async function lockAthlete(athleteId: string, item: AthleteLockItem, takeOver = false): Promise<AthleteLockResult> {
  const { data, error } = await supabase.rpc('lock_athlete', { p_athlete: athleteId, p_item: item, p_take_over: takeOver });
  const row = (Array.isArray(data) ? data[0] : data) as LockRow | null;
  if (error || !row) return { acquired: true, holderName: '', canTakeOver: false };
  return { acquired: !!row.acquired, holderName: row.holder_name || 'Another coach', canTakeOver: !!row.can_take_over };
}

// ─── Giving locks back when the tab closes ──────────────────────────────────────

const PROXY_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let accessToken: string | null = null;
void supabase.auth.getSession().then(({ data }) => { accessToken = data.session?.access_token ?? null; }).catch(() => undefined);
supabase.auth.onAuthStateChange((_event, session) => { accessToken = session?.access_token ?? null; });

/** A request that still goes out while the page closes (keepalive) */
function unlockOnClose(athleteId: string, item: string) {
  if (!PROXY_BASE || !ANON_KEY || !accessToken) return;
  try {
    void fetch(`${PROXY_BASE}/rest/v1/rpc/unlock_athlete`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ p_athlete: athleteId, p_item: item }),
    }).catch(() => undefined);
  } catch { /* the lock frees itself after 2 minutes */ }
}

// ─── Sessions: the edit modes open in this tab, per athlete item ─────────────────

interface Entry {
  athleteId: string;
  item: AthleteLockItem;
  sessions: number;
  timer: ReturnType<typeof setInterval> | null;
  release: ReturnType<typeof setTimeout> | null;
  /** Someone took the lock over: the open edit mode closes */
  lostTo: string | null;
  listeners: Set<() => void>;
}
const entries = new Map<string, Entry>();
const keyOf = (athleteId: string, item: string) => `${athleteId}\u0000${item}`;

function entryOf(athleteId: string, item: AthleteLockItem): Entry {
  const key = keyOf(athleteId, item);
  let e = entries.get(key);
  if (!e) {
    e = { athleteId, item, sessions: 0, timer: null, release: null, lostTo: null, listeners: new Set() };
    entries.set(key, e);
  }
  return e;
}

async function renew(e: Entry) {
  if (e.sessions === 0 || e.lostTo) return;
  const r = await lockAthlete(e.athleteId, e.item);
  if (!r.acquired && e.sessions > 0) {
    e.lostTo = r.holderName;
    e.listeners.forEach(fn => fn());
  }
}

const onFront = () => {
  if (document.visibilityState !== 'visible') return;
  entries.forEach(e => { if (e.sessions > 0) void renew(e); });
};
const onClose = () => {
  entries.forEach(e => {
    if ((e.sessions > 0 || e.release) && !e.lostTo) unlockOnClose(e.athleteId, e.item);
  });
};
let listening = false;

function startSession(athleteId: string, item: AthleteLockItem): Entry {
  const e = entryOf(athleteId, item);
  if (e.release) { clearTimeout(e.release); e.release = null; }
  e.sessions += 1;
  if (e.sessions === 1) {
    e.lostTo = null;
    void renew(e);
    e.timer = setInterval(() => { void renew(e); }, RENEW_MS);
  }
  if (!listening) {
    listening = true;
    document.addEventListener('visibilitychange', onFront);
    window.addEventListener('focus', onFront);
    window.addEventListener('pagehide', onClose);
  }
  return e;
}

function endSession(e: Entry) {
  if (e.sessions === 0) return;
  e.sessions -= 1;
  if (e.sessions > 0) return;
  if (e.timer) { clearInterval(e.timer); e.timer = null; }
  const lost = !!e.lostTo;
  e.release = setTimeout(() => {
    e.release = null;
    if (e.sessions === 0 && !lost) void supabase.rpc('unlock_athlete', { p_athlete: e.athleteId, p_item: e.item });
  }, RELEASE_DELAY_MS);
}

/**
 * Holds the item's lock while `active` (its edit mode is open). The lock itself is taken before
 * entering edit mode (lockAthlete). `lostTo`: the name of whoever took it over — the edit mode
 * must close then.
 */
export function useAthleteEditSession(athleteId: string | undefined, item: AthleteLockItem | null, active: boolean): { lostTo: string | null } {
  const [lostTo, setLostTo] = useState<string | null>(null);
  useEffect(() => {
    if (!athleteId || !item || !active) { setLostTo(null); return; }
    const e = startSession(athleteId, item);
    const listener = () => setLostTo(e.lostTo);
    e.listeners.add(listener);
    return () => {
      e.listeners.delete(listener);
      endSession(e);
    };
  }, [athleteId, item, active]);
  return { lostTo };
}

/** Who else is editing which item of the athlete right now (item → name) — checked every 10 s */
export function useAthleteLockHolders(athleteId: string | undefined, myUserId: string | undefined): Map<string, string> {
  const [holders, setHolders] = useState<Map<string, string>>(new Map());
  const me = useRef(myUserId);
  me.current = myUserId;
  useEffect(() => {
    setHolders(new Map());
    if (!athleteId) return;
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data, error } = await supabase.rpc('athlete_lock_holders', { p_athlete: athleteId });
      if (cancelled || error) return;
      const rows = (Array.isArray(data) ? data : []) as Array<{ item: string; holder: string; holder_name: string | null }>;
      const next = new Map<string, string>();
      rows.forEach(r => { if (r.holder !== me.current) next.set(r.item, r.holder_name || 'Another coach'); });
      setHolders(prev => (prev.size === next.size && [...next].every(([k, v]) => prev.get(k) === v) ? prev : next));
    };
    void check();
    const timer = setInterval(() => { void check(); }, RENEW_MS);
    const front = () => { void check(); };
    window.addEventListener('focus', front);
    document.addEventListener('visibilitychange', front);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', front);
      document.removeEventListener('visibilitychange', front);
    };
  }, [athleteId]);
  return holders;
}
