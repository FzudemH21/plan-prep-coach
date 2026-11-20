/**
 * Edit lock for the program open in the planner (organizations, phase 5 — see
 * supabase/migrations/20261116_program_locks.sql).
 *
 * Whoever opens a program they may change takes its lock and renews it every 10 s (and at once when
 * the tab comes back to the front — browsers slow down timers of background tabs); a lock not
 * renewed for 2 minutes is free. Another coach opening it meanwhile gets it read-only ("… is
 * editing") — the program store then refuses their saves (setProgramLockedOut), so nothing is
 * overwritten. Owners and the program's author can take the lock over.
 *
 * Whenever the lock comes (back) to someone who was locked out, the planner may hold an older
 * version than the stored one (the other coach saved meanwhile): status 'freed' — the page reloads
 * the program before editing goes on. The same check runs when a lock is first taken.
 *
 * Before the SQL has run (function missing) or without the right to lock: no lock — as before.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { refreshPrograms, setProgramLockedOut } from '@/lib/programStore';

export type ProgramLockStatus = 'none' | 'checking' | 'mine' | 'other' | 'lost' | 'freed';

/** Renewing doubles as checking: a takeover or a freed lock shows within ~10 s */
const RENEW_MS = 10_000;
/** Moving between the planner pages: the lock is given back only if no planner page takes it again */
const RELEASE_DELAY_MS = 4_000;
const releaseTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface LockRow { acquired: boolean; holder: string | null; holder_name: string | null; holder_is_owner?: boolean }

export function useProgramLock(programId: string | null, enabled: boolean, onStale: () => void) {
  const [status, setStatus] = useState<ProgramLockStatus>('none');
  const [holderName, setHolderName] = useState('');
  // Owners' locks can only be taken over by owners (20261116_program_locks_hierarchy.sql)
  const [holderIsOwner, setHolderIsOwner] = useState(false);
  const statusRef = useRef<ProgramLockStatus>('none');
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;
  const set = (s: ProgramLockStatus) => { statusRef.current = s; setStatus(s); };

  const attempt = useCallback(async (takeOver: boolean): Promise<void> => {
    if (!programId) return;
    const { data, error } = await supabase.rpc('lock_program', { p_program: programId, p_take_over: takeOver });
    if (error) {
      // SQL not run yet, not allowed, or offline: no lock — keep working as before
      if (statusRef.current === 'checking') { setProgramLockedOut(programId, false); set('none'); }
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as LockRow | null;
    if (!row) return;
    const before = statusRef.current;
    if (row.acquired) {
      if (before === 'other' || before === 'lost' || before === 'freed') {
        // The lock is ours again, but the planner may show an older version: reload first
        setProgramLockedOut(programId, true);
        set('freed');
        return;
      }
      if (before === 'checking') {
        // First time: was the program changed since this page loaded it?
        const takenOver = await refreshPrograms().catch(() => [] as string[]);
        if (takenOver.includes(programId)) {
          setProgramLockedOut(programId, true);
          onStaleRef.current();
          return;
        }
      }
      setProgramLockedOut(programId, false);
      set('mine');
    } else {
      setHolderName(row.holder_name ?? 'Another coach');
      setHolderIsOwner(!!row.holder_is_owner);
      setProgramLockedOut(programId, true);
      set(before === 'mine' ? 'lost' : before === 'lost' ? 'lost' : 'other');
    }
  }, [programId]);

  useEffect(() => {
    if (!enabled || !programId) { set('none'); return; }
    const pending = releaseTimers.get(programId);
    if (pending) { clearTimeout(pending); releaseTimers.delete(programId); }
    set('checking');
    void attempt(false);
    const timer = setInterval(() => { void attempt(false); }, RENEW_MS);
    const onFront = () => { if (document.visibilityState === 'visible') void attempt(false); };
    document.addEventListener('visibilitychange', onFront);
    window.addEventListener('focus', onFront);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFront);
      window.removeEventListener('focus', onFront);
      const wasMine = statusRef.current === 'mine' || statusRef.current === 'freed';
      setProgramLockedOut(programId, false);
      if (wasMine) {
        releaseTimers.set(programId, setTimeout(() => {
          releaseTimers.delete(programId);
          // (a Supabase request is only sent once its result is asked for — hence the .then)
          supabase.rpc('unlock_program', { p_program: programId }).then(() => undefined, () => undefined);
        }, RELEASE_DELAY_MS));
      }
    };
  }, [enabled, programId, attempt]);

  /** Owners and the author: take the lock from whoever holds it (the page then reloads) */
  const takeOver = useCallback(async () => {
    if (!programId) return false;
    const { data, error } = await supabase.rpc('lock_program', { p_program: programId, p_take_over: true });
    const row = (Array.isArray(data) ? data[0] : data) as LockRow | null;
    if (error || !row?.acquired) return false;
    setProgramLockedOut(programId, true);
    set('freed');
    return true;
  }, [programId]);

  return { status, holderName, holderIsOwner, takeOver };
}
