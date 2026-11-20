/**
 * Edit lock for an athlete (supabase/migrations/20261120_athlete_locks.sql).
 *
 * Taken when a coach starts editing the athlete (profile "Edit", an anamnesis in edit mode, a new
 * anamnesis) and held while any of those edit modes is open in this tab — renewed every 10 s (and
 * at once when the tab comes back to the front). Given back shortly after the last edit mode
 * closes. A lock not renewed for 2 minutes is free. Other coaches can look at the athlete, but
 * can't start editing ("… is editing"); owners can take the lock over — the coach who had it then
 * leaves edit mode (their unsaved changes are not saved).
 *
 * Before the SQL has run (functions missing) or offline: no lock — editing works as before.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AthleteLockResult {
  acquired: boolean;
  holderName: string;
  /** The caller may take the lock over (owners) */
  canTakeOver: boolean;
}

interface LockRow { acquired: boolean; holder_name: string | null; can_take_over: boolean | null }

const RENEW_MS = 10_000;
const RELEASE_DELAY_MS = 2_000;

/** Takes (or renews) the lock. Without the SQL / offline: counts as taken (works as before). */
export async function lockAthlete(athleteId: string, takeOver = false): Promise<AthleteLockResult> {
  const { data, error } = await supabase.rpc('lock_athlete', { p_athlete: athleteId, p_take_over: takeOver });
  const row = (Array.isArray(data) ? data[0] : data) as LockRow | null;
  if (error || !row) return { acquired: true, holderName: '', canTakeOver: false };
  return { acquired: !!row.acquired, holderName: row.holder_name || 'Another coach', canTakeOver: !!row.can_take_over };
}

// ─── Sessions: the edit modes open in this tab, per athlete ──────────────────────

interface Entry {
  sessions: number;
  timer: ReturnType<typeof setInterval> | null;
  release: ReturnType<typeof setTimeout> | null;
  /** Someone took the lock over: the open edit modes close */
  lostTo: string | null;
  listeners: Set<() => void>;
}
const entries = new Map<string, Entry>();

function entryOf(athleteId: string): Entry {
  let e = entries.get(athleteId);
  if (!e) {
    e = { sessions: 0, timer: null, release: null, lostTo: null, listeners: new Set() };
    entries.set(athleteId, e);
  }
  return e;
}

async function renew(athleteId: string) {
  const e = entries.get(athleteId);
  if (!e || e.sessions === 0 || e.lostTo) return;
  const r = await lockAthlete(athleteId);
  if (!r.acquired && e.sessions > 0) {
    e.lostTo = r.holderName;
    e.listeners.forEach(fn => fn());
  }
}

const onFront = () => {
  if (document.visibilityState !== 'visible') return;
  entries.forEach((e, id) => { if (e.sessions > 0) void renew(id); });
};
let frontListening = false;

function startSession(athleteId: string): Entry {
  const e = entryOf(athleteId);
  if (e.release) { clearTimeout(e.release); e.release = null; }
  e.sessions += 1;
  if (e.sessions === 1) {
    e.lostTo = null;
    void renew(athleteId);
    e.timer = setInterval(() => { void renew(athleteId); }, RENEW_MS);
  }
  if (!frontListening) {
    frontListening = true;
    document.addEventListener('visibilitychange', onFront);
    window.addEventListener('focus', onFront);
  }
  return e;
}

function endSession(athleteId: string) {
  const e = entries.get(athleteId);
  if (!e || e.sessions === 0) return;
  e.sessions -= 1;
  if (e.sessions > 0) return;
  if (e.timer) { clearInterval(e.timer); e.timer = null; }
  const lost = !!e.lostTo;
  // Moving between edit modes of the same athlete keeps the lock; otherwise it goes back
  e.release = setTimeout(() => {
    e.release = null;
    if (e.sessions === 0 && !lost) void supabase.rpc('unlock_athlete', { p_athlete: athleteId });
  }, RELEASE_DELAY_MS);
}

/**
 * Holds the athlete's lock while `active` (an edit mode is open). The lock itself is taken before
 * entering edit mode (lockAthlete). `lostTo`: the name of whoever took it over — the edit mode
 * must close then.
 */
export function useAthleteEditSession(athleteId: string | undefined, active: boolean): { lostTo: string | null } {
  const [lostTo, setLostTo] = useState<string | null>(null);
  useEffect(() => {
    if (!athleteId || !active) { setLostTo(null); return; }
    const e = startSession(athleteId);
    const listener = () => setLostTo(e.lostTo);
    e.listeners.add(listener);
    return () => {
      e.listeners.delete(listener);
      endSession(athleteId);
    };
  }, [athleteId, active]);
  return { lostTo };
}

/** Who else is editing the athlete right now (null: nobody, or this coach) — checked every 10 s */
export function useAthleteLockHolder(athleteId: string | undefined, myUserId: string | undefined): string | null {
  const [holder, setHolder] = useState<string | null>(null);
  const me = useRef(myUserId);
  me.current = myUserId;
  useEffect(() => {
    if (!athleteId) { setHolder(null); return; }
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data, error } = await supabase.rpc('athlete_lock_holder', { p_athlete: athleteId });
      if (cancelled || error) return;
      const row = (Array.isArray(data) ? data[0] : data) as { holder: string; holder_name: string | null } | null;
      setHolder(row && row.holder !== me.current ? row.holder_name || 'Another coach' : null);
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
  return holder;
}
