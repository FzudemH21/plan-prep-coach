/**
 * Interval timer for methods with interval roles (Training Toolbox), e.g. HIIT — athlete app and
 * coach-mobile logging.
 *
 * IntervalLauncher sits above the set table: "Start intervals" for the next set that isn't done,
 * with that set's values (what the athlete typed, else the plan). IntervalTimer runs full screen:
 * Get ready → WORK → REST → … → WORK (no rest after the last rep), with the rep counter, intensity,
 * a beep + vibration at every switch and short ticks in the last 3 seconds. The time is computed
 * from timestamps, so a throttled phone doesn't drift; the screen is kept awake while it runs.
 * The timer always runs on time (the stimulus is time at an intensity); parameters marked "show
 * during work" (e.g. distance, pace) are shown for orientation only. The athlete can shorten or
 * extend the running phase (−5 / +5 / +15 s); when it is done, the actual average work / rest
 * time per rep goes into the set's values if it differs from the plan, then the set is ticked off
 * (which starts the normal rest between sets).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, SkipForward, Timer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseMeasuredNumber } from '@/utils/latestParameterValue';
import type { ExerciseSummary } from '@/hooks/useAthleteApp';

const READY_SECONDS = 5;

/** Time units of the Training Toolbox (its unit list is fixed) → seconds per unit */
const TIME_UNITS: Record<string, number> = { s: 1, sec: 1, min: 60, h: 3600 };

/** Whether a unit is a duration (no unit = seconds) */
export function isTimeUnit(unit?: string): boolean {
  return !unit || TIME_UNITS[unit.trim().toLowerCase()] !== undefined;
}

/** "120" s → 120 · "2" min → 120 · "1,5" min → 90 · "400" m → null (not a duration) */
function toSeconds(raw: string, unit?: string): number | null {
  const n = parseMeasuredNumber(raw);
  if (n === null || n <= 0) return null;
  if (!isTimeUnit(unit)) return null;
  const factor = unit ? TIME_UNITS[unit.trim().toLowerCase()] : 1;
  return Math.round(n * factor);
}

function clock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface IntervalPlan {
  setNumber: number;
  reps: number;
  workSeconds: number;
  restSeconds: number;
  workIntensity?: string;
  restIntensity?: string;
  /** Shown during work for orientation, e.g. "400 m" */
  workTargets?: string[];
}

/** What was actually done: average seconds per rep (rest: null with a single rep) */
export interface IntervalActuals {
  avgWorkSeconds: number;
  avgRestSeconds: number | null;
}

type Phase = 'ready' | 'work' | 'rest' | 'done';

interface IntervalTimerProps {
  exerciseName: string;
  plan: IntervalPlan;
  onComplete: (actuals: IntervalActuals) => void;
  onCancel: () => void;
}

const ADJUSTMENTS = [-5, 5, 15];

function IntervalTimer({ exerciseName, plan, onComplete, onCancel }: IntervalTimerProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [rep, setRep] = useState(1);
  const [remainingMs, setRemainingMs] = useState(READY_SECONDS * 1000);
  const [paused, setPaused] = useState(false);
  const endsAt = useRef(Date.now() + READY_SECONDS * 1000);
  const lastTick = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  // Actual times: when the phase started, paused time in it, totals of the finished phases
  const phaseStartedAt = useRef(Date.now());
  const pausedSince = useRef<number | null>(null);
  const pausedInPhase = useRef(0);
  const workDoneMs = useRef(0);
  const restDoneMs = useRef(0);

  const beep = useCallback((freq: number, ms: number) => {
    try {
      if (!audio.current) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        audio.current = new Ctor();
      }
      const ctx = audio.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000);
    } catch { /* no sound — the vibration and the screen still change */ }
  }, []);

  const startPhase = useCallback((next: Phase, nextRep: number) => {
    setPhase(next);
    setRep(nextRep);
    lastTick.current = null;
    phaseStartedAt.current = Date.now();
    pausedInPhase.current = 0;
    if (pausedSince.current !== null) pausedSince.current = Date.now();
    if (next === 'done') {
      endsAt.current = Number.MAX_SAFE_INTEGER; // no further switch from a tick before the re-render
      beep(880, 600);
      navigator.vibrate?.([200, 100, 200, 100, 400]);
      return;
    }
    const seconds = next === 'work' ? plan.workSeconds : plan.restSeconds;
    endsAt.current = Date.now() + seconds * 1000;
    setRemainingMs(seconds * 1000);
    beep(next === 'work' ? 880 : 520, 350);
    navigator.vibrate?.(next === 'work' ? [300] : [150, 80, 150]);
  }, [plan.workSeconds, plan.restSeconds, beep]);

  const advance = useCallback(() => {
    // Time actually spent in the finished phase (without pauses) — skipping counts as done
    const now = Date.now();
    const pausedNow = pausedSince.current !== null ? now - pausedSince.current : 0;
    const spent = Math.max(0, now - phaseStartedAt.current - pausedInPhase.current - pausedNow);
    if (phase === 'work') workDoneMs.current += spent;
    if (phase === 'rest') restDoneMs.current += spent;
    if (phase === 'ready') startPhase('work', 1);
    else if (phase === 'work') startPhase(rep >= plan.reps ? 'done' : 'rest', rep);
    else if (phase === 'rest') startPhase('work', rep + 1);
  }, [phase, rep, plan.reps, startPhase]);

  // Clock
  useEffect(() => {
    if (paused || phase === 'done') return;
    const id = setInterval(() => {
      const left = endsAt.current - Date.now();
      setRemainingMs(Math.max(0, left));
      const secs = Math.ceil(left / 1000);
      if (secs <= 3 && secs >= 1 && lastTick.current !== secs) {
        lastTick.current = secs;
        beep(660, 90);
      }
      if (left <= 0) advance();
    }, 200);
    return () => clearInterval(id);
  }, [paused, phase, advance, beep]);

  // Keep the screen on while the timer runs
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    let lock: WakeLock | null = null;
    nav.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => { void lock?.release().catch(() => {}); };
  }, []);

  useEffect(() => () => { void audio.current?.close().catch(() => {}); }, []);

  const togglePause = () => {
    if (paused) {
      endsAt.current = Date.now() + remainingMs;
      if (pausedSince.current !== null) pausedInPhase.current += Date.now() - pausedSince.current;
      pausedSince.current = null;
      setPaused(false);
    } else {
      setRemainingMs(Math.max(0, endsAt.current - Date.now()));
      pausedSince.current = Date.now();
      setPaused(true);
    }
  };

  /** Shorten / extend the running phase — never below zero (then it ends with the next tick) */
  const adjust = (seconds: number) => {
    if (phase === 'done') return;
    if (paused) {
      setRemainingMs(ms => Math.max(0, ms + seconds * 1000));
    } else {
      endsAt.current = Math.max(Date.now(), endsAt.current + seconds * 1000);
      setRemainingMs(Math.max(0, endsAt.current - Date.now()));
    }
  };

  const actuals = (): IntervalActuals => ({
    avgWorkSeconds: Math.round(workDoneMs.current / 1000 / plan.reps),
    avgRestSeconds: plan.reps > 1 ? Math.round(restDoneMs.current / 1000 / (plan.reps - 1)) : null,
  });

  const seconds = Math.ceil(remainingMs / 1000);
  const total = phase === 'work' ? plan.workSeconds : phase === 'rest' ? plan.restSeconds : READY_SECONDS;
  const progress = phase === 'done' ? 1 : 1 - remainingMs / (total * 1000);
  const intensity = phase === 'work' ? plan.workIntensity : phase === 'rest' ? plan.restIntensity : undefined;

  const tone = phase === 'work'
    ? 'bg-red-600 text-white'
    : phase === 'rest'
      ? 'bg-emerald-600 text-white'
      : 'bg-background text-foreground';

  return createPortal(
    <div className="fixed inset-0 z-[400] flex justify-center bg-black/60">
      <div className={cn('w-full sm:w-[480px] h-full flex flex-col transition-colors duration-300', tone)}>
        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
          <div className="min-w-0">
            <p className="text-sm opacity-80 truncate">{exerciseName}</p>
            <p className="text-xs opacity-70">Set {plan.setNumber}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 w-11 rounded-full flex items-center justify-center active:bg-black/10"
            aria-label="Stop intervals"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          {phase === 'done' ? (
            <>
              <p className="text-4xl font-bold">Set done</p>
              <p className="text-base opacity-80">
                {plan.reps} × {clock(actuals().avgWorkSeconds)} work
                {actuals().avgRestSeconds !== null ? ` / ${clock(actuals().avgRestSeconds!)} rest` : ''} (average)
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-widest">
                {phase === 'ready' ? 'GET READY' : phase === 'work' ? 'WORK' : 'REST'}
              </p>
              <p className="text-8xl font-bold tabular-nums leading-none">{clock(seconds)}</p>
              {intensity && <p className="text-2xl font-semibold">@ {intensity}</p>}
              {phase !== 'rest' && plan.workTargets && plan.workTargets.length > 0 && (
                <p className="text-xl font-medium opacity-90">{plan.workTargets.join(' · ')}</p>
              )}
              <p className="text-lg opacity-80">
                {phase === 'ready' ? `${plan.reps} × ${clock(plan.workSeconds)} / ${clock(plan.restSeconds)} rest` : `Rep ${rep} / ${plan.reps}`}
              </p>
              <div className="w-full max-w-xs h-2 rounded-full bg-black/15 overflow-hidden">
                <div className="h-full bg-current opacity-80" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
              </div>
              {phase !== 'ready' && (
                <p className="text-sm opacity-75">
                  {phase === 'work'
                    ? rep < plan.reps ? `Next: rest ${clock(plan.restSeconds)}` : 'Last rep'
                    : `Next: work ${clock(plan.workSeconds)}`}
                </p>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="shrink-0 px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {phase === 'done' ? (
            <button
              type="button"
              onClick={() => onComplete(actuals())}
              className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-semibold active:scale-[0.98]"
            >
              Done — tick off set {plan.setNumber}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={togglePause}
                className="h-20 w-20 rounded-full bg-black/15 flex items-center justify-center active:scale-95"
                aria-label={paused ? 'Resume' : 'Pause'}
              >
                {paused ? <Play className="h-9 w-9" /> : <Pause className="h-9 w-9" />}
              </button>
              <button
                type="button"
                onClick={advance}
                className="h-14 w-14 rounded-full bg-black/10 flex items-center justify-center active:scale-95"
                aria-label="Skip to the next phase"
              >
                <SkipForward className="h-6 w-6" />
              </button>
            </div>
          )}
          {phase !== 'done' && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {ADJUSTMENTS.map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => adjust(sec)}
                  className="h-11 min-w-[64px] px-3 rounded-full bg-black/10 text-sm font-semibold tabular-nums active:scale-95"
                >
                  {sec > 0 ? `+${sec}` : `−${Math.abs(sec)}`} s
                </button>
              ))}
            </div>
          )}
          {paused && phase !== 'done' && <p className="text-center text-sm mt-3 opacity-80">Paused</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface IntervalLauncherProps {
  exercise: ExerciseSummary;
  setCount: number;
  doneSets: number[];
  /** What the set shows for a parameter: the athlete's value, else the planned one */
  valueFor: (setIdx: number, param: string) => string;
  /** Writes a value into the set (the actual work / rest time when it differs from the plan) */
  onLogValue: (setIdx: number, param: string, value: string) => void;
  onCompleteSet: (setIdx: number) => void;
}

/** Seconds → the parameter's unit ("125" s, "2.1" min) */
function fromSeconds(seconds: number, unit?: string): string {
  const u = (unit ?? '').trim().toLowerCase();
  if (u === 'min') return String(Math.round((seconds / 60) * 10) / 10);
  if (u === 'h') return String(Math.round((seconds / 3600) * 100) / 100);
  return String(seconds);
}

/** "Start intervals" for the next set that isn't done — only for methods with an interval timer */
export function IntervalLauncher({ exercise, setCount, doneSets, valueFor, onLogValue, onCompleteSet }: IntervalLauncherProps) {
  const [running, setRunning] = useState<IntervalPlan | null>(null);
  const spec = exercise.interval;
  if (!spec) return null;

  const nextSet = Array.from({ length: setCount }, (_, i) => i).find(i => !doneSets.includes(i));
  if (nextSet === undefined) return null;

  const unit = (p: string) => {
    const u = exercise.plannedParams?.[`${p}_unit`];
    return u ? String(u) : undefined;
  };
  const withUnit = (p?: string) => {
    if (!p) return undefined;
    const v = valueFor(nextSet, p);
    if (!v) return undefined;
    const u = unit(p);
    return u ? `${v} ${u}` : v;
  };
  const reps = parseMeasuredNumber(valueFor(nextSet, spec.reps));
  const work = toSeconds(valueFor(nextSet, spec.work), unit(spec.work));
  const rest = toSeconds(valueFor(nextSet, spec.rest), unit(spec.rest));
  const ready = reps !== null && reps >= 1 && work !== null && rest !== null;
  // Work or rest given as a distance etc. (e.g. 400 m) — the timer only runs on durations
  const notTime = [spec.work, spec.rest].filter(p => !isTimeUnit(unit(p)));

  return (
    <>
      <button
        type="button"
        disabled={!ready}
        onClick={() => ready && setRunning({
          setNumber: nextSet + 1,
          reps: Math.round(reps!),
          workSeconds: work!,
          restSeconds: rest!,
          workIntensity: withUnit(spec.workIntensity),
          restIntensity: withUnit(spec.restIntensity),
          workTargets: (spec.workTargets ?? []).map(withUnit).filter((t): t is string => !!t),
        })}
        className={cn(
          'w-full mb-2 flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all active:scale-[0.98]',
          ready ? 'border-primary bg-primary/5 text-primary hover:bg-primary/10' : 'border-dashed text-muted-foreground',
        )}
      >
        <Timer className="h-4 w-4" />
        {ready
          ? `Start intervals · Set ${nextSet + 1}: ${Math.round(reps!)} × ${clock(work!)} / ${clock(rest!)} rest`
          : notTime.length > 0
            ? `Interval timer needs a time (s / min) for ${notTime.join(' and ')}`
            : 'Interval timer: enter reps, work and rest time first'}
      </button>
      {running && (
        <IntervalTimer
          exerciseName={exercise.name}
          plan={running}
          onCancel={() => setRunning(null)}
          onComplete={(actual) => {
            const setIdx = running.setNumber - 1;
            // The time actually spent (extended / shortened / skipped) — the coach sees the real exposure
            if (Math.abs(actual.avgWorkSeconds - running.workSeconds) >= 1) {
              onLogValue(setIdx, spec.work, fromSeconds(actual.avgWorkSeconds, unit(spec.work)));
            }
            if (actual.avgRestSeconds !== null && Math.abs(actual.avgRestSeconds - running.restSeconds) >= 1) {
              onLogValue(setIdx, spec.rest, fromSeconds(actual.avgRestSeconds, unit(spec.rest)));
            }
            onCompleteSet(setIdx);
            setRunning(null);
          }}
        />
      )}
    </>
  );
}
