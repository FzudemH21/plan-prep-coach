/**
 * Interval timer for methods with interval roles (Training Toolbox), e.g. HIIT — athlete app and
 * coach-mobile logging.
 *
 * IntervalLauncher sits above the set table: "Start intervals" for the next set that isn't done,
 * with that set's values (what the athlete typed, else the plan). IntervalTimer runs full screen:
 * Get ready → WORK → REST → … → WORK (no rest after the last rep), with the rep counter, intensity,
 * a beep + vibration at every switch and short ticks in the last 3 seconds. The time is computed
 * from timestamps, so a throttled phone doesn't drift; the screen is kept awake while it runs.
 * When it is done the set is ticked off (which starts the normal rest between sets).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, SkipForward, Timer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseMeasuredNumber } from '@/utils/latestParameterValue';
import type { ExerciseSummary } from '@/hooks/useAthleteApp';

const READY_SECONDS = 5;

/** "120" s → 120 · "2" min → 120 · "1,5" min → 90 */
function toSeconds(raw: string, unit?: string): number | null {
  const n = parseMeasuredNumber(raw);
  if (n === null || n <= 0) return null;
  const u = (unit ?? '').toLowerCase();
  if (u.startsWith('min')) return Math.round(n * 60);
  if (u === 'h') return Math.round(n * 3600);
  return Math.round(n);
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
}

type Phase = 'ready' | 'work' | 'rest' | 'done';

interface IntervalTimerProps {
  exerciseName: string;
  plan: IntervalPlan;
  onComplete: () => void;
  onCancel: () => void;
}

function IntervalTimer({ exerciseName, plan, onComplete, onCancel }: IntervalTimerProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [rep, setRep] = useState(1);
  const [remainingMs, setRemainingMs] = useState(READY_SECONDS * 1000);
  const [paused, setPaused] = useState(false);
  const endsAt = useRef(Date.now() + READY_SECONDS * 1000);
  const lastTick = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);

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
      setPaused(false);
    } else {
      setRemainingMs(Math.max(0, endsAt.current - Date.now()));
      setPaused(true);
    }
  };

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
              <p className="text-base opacity-80">{plan.reps} × {clock(plan.workSeconds)} work</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-widest">
                {phase === 'ready' ? 'GET READY' : phase === 'work' ? 'WORK' : 'REST'}
              </p>
              <p className="text-8xl font-bold tabular-nums leading-none">{clock(seconds)}</p>
              {intensity && <p className="text-2xl font-semibold">@ {intensity}</p>}
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
              onClick={onComplete}
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
  onCompleteSet: (setIdx: number) => void;
}

/** "Start intervals" for the next set that isn't done — only for methods with an interval timer */
export function IntervalLauncher({ exercise, setCount, doneSets, valueFor, onCompleteSet }: IntervalLauncherProps) {
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
        })}
        className={cn(
          'w-full mb-2 flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all active:scale-[0.98]',
          ready ? 'border-primary bg-primary/5 text-primary hover:bg-primary/10' : 'border-dashed text-muted-foreground',
        )}
      >
        <Timer className="h-4 w-4" />
        {ready
          ? `Start intervals · Set ${nextSet + 1}: ${Math.round(reps!)} × ${clock(work!)} / ${clock(rest!)} rest`
          : 'Interval timer: enter reps, work and rest time first'}
      </button>
      {running && (
        <IntervalTimer
          exerciseName={exercise.name}
          plan={running}
          onCancel={() => setRunning(null)}
          onComplete={() => { onCompleteSet(running.setNumber - 1); setRunning(null); }}
        />
      )}
    </>
  );
}
