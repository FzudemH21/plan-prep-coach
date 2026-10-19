/**
 * Rest timer of the session logging (athlete app + coach-mobile logging).
 *
 * The countdown is computed from an end timestamp, so it stays correct when the phone throttles
 * timers or the screen was off for a moment. Ticks in the last 3 s and a signal when the rest is
 * over (sound can be switched off per device; vibration on Android), the screen is kept awake
 * while resting so the signal can actually be heard.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { playCountdownTick, playRestOver, unlockWorkoutAudio, vibrateRestOver } from '@/utils/workoutSound';

const SOUND_KEY = 'ppc.restTimerSound';

function readSoundPref(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}

export function useRestCountdown(running: boolean, onFinished: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [soundOn, setSoundOn] = useState(readSoundPref);
  const endsAt = useRef(0);
  const lastTick = useRef<number | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // Phones only allow sound after a tap — every tap on the page (re)unlocks it
  useEffect(() => {
    const unlock = () => unlockWorkoutAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchend', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (endsAt.current === Number.MAX_SAFE_INTEGER) return;
      const left = endsAt.current - Date.now();
      const secs = Math.max(0, Math.ceil(left / 1000));
      setSecondsLeft(secs);
      if (secs >= 1 && secs <= 3 && lastTick.current !== secs) {
        lastTick.current = secs;
        if (soundRef.current) playCountdownTick();
      }
      if (left <= 0) {
        endsAt.current = Number.MAX_SAFE_INTEGER; // only once, also if a tick comes before the re-render
        if (soundRef.current) playRestOver();
        vibrateRestOver();
        onFinishedRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  // Keep the screen on while resting
  useEffect(() => {
    if (!running) return;
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    let lock: WakeLock | null = null;
    let cancelled = false;
    nav.wakeLock?.request('screen')
      .then(l => { if (cancelled) void l.release().catch(() => {}); else lock = l; })
      .catch(() => {});
    return () => { cancelled = true; void lock?.release().catch(() => {}); };
  }, [running]);

  const start = useCallback((seconds: number) => {
    unlockWorkoutAudio();
    endsAt.current = Date.now() + seconds * 1000;
    lastTick.current = null;
    setSecondsLeft(seconds);
  }, []);

  /** −30 / +30 s — never below 1 s left */
  const adjust = useCallback((deltaSeconds: number) => {
    if (endsAt.current === Number.MAX_SAFE_INTEGER) return;
    endsAt.current = Math.max(Date.now() + 1000, endsAt.current + deltaSeconds * 1000);
    lastTick.current = null;
    setSecondsLeft(Math.max(1, Math.ceil((endsAt.current - Date.now()) / 1000)));
  }, []);

  /** Rest ended early (skipped) */
  const stop = useCallback(() => {
    endsAt.current = Number.MAX_SAFE_INTEGER;
    setSecondsLeft(0);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSoundOn(next);
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* per session only */ }
    if (next) { unlockWorkoutAudio(); playCountdownTick(); } // short preview: sound is on
  }, []);

  return { secondsLeft, start, adjust, stop, soundOn, toggleSound };
}
