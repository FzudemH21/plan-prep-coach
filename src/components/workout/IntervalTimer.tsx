/**
 * Interval timer for methods with interval roles (Training Toolbox), e.g. HIIT — athlete app and
 * coach-mobile logging.
 *
 * IntervalLauncher sits above the set table: "Start intervals" from the next set that isn't done,
 * with each set's values (what the athlete typed, else the plan). IntervalTimer first shows an
 * overview of the whole run (sets, work / rest with intensities, rest between sets, total time);
 * after "Start" it runs through on its own — nothing to tap until the end — through all remaining
 * sets: Get ready → WORK → REST → … → WORK (last rep) → REST BETWEEN SETS →
 * next set … → done. The rest between sets is the parameter flagged as rest (with its intensity
 * role); without one (or without a time value) the timer covers one set per start.
 *
 * The timer always runs on time (the stimulus is time at an intensity); parameters marked "show
 * during work" (e.g. distance, pace) are shown for orientation only. Rep / set counters, intensity,
 * a beep + vibration at every switch and ticks in the last 3 s; the time is computed from
 * timestamps (no drift on a throttled phone) and the screen is kept awake. The athlete can shorten
 * or extend the running phase (−5 / +5 / +15 s). Finished sets — also when stopped early — are
 * ticked off together, with the actual average work / rest time per rep and the actual rest
 * between sets written into the set's values where they differ from the plan.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, SkipForward, Timer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseMeasuredNumber } from '@/utils/latestParameterValue';
import type { ExerciseSummary } from '@/hooks/useAthleteApp';

const READY_SECONDS = 5;
const ADJUSTMENTS = [-5, 5, 15];

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

/** Seconds → the parameter's unit ("125" s, "2.1" min) */
function fromSeconds(seconds: number, unit?: string): string {
  const u = (unit ?? '').trim().toLowerCase();
  if (u === 'min') return String(Math.round((seconds / 60) * 10) / 10);
  if (u === 'h') return String(Math.round((seconds / 3600) * 100) / 100);
  return String(seconds);
}

function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface IntervalSetPlan {
  setIdx: number;
  reps: number;
  workSeconds: number;
  restSeconds: number;
  /** Rest after this set (null for the last set of the run) */
  setRestSeconds: number | null;
  workIntensity?: string;
  restIntensity?: string;
  setRestIntensity?: string;
  /** Shown during work for orientation, e.g. "400 m" */
  workTargets?: string[];
}

/** What was actually done in a finished set: average seconds per rep, rest after the set */
export interface IntervalSetResult {
  setIdx: number;
  avgWorkSeconds: number;
  avgRestSeconds: number | null;
  setRestSeconds: number | null;
}

type Phase = 'overview' | 'ready' | 'work' | 'rest' | 'setRest' | 'done';

interface IntervalTimerProps {
  exerciseName: string;
  sets: IntervalSetPlan[];
  totalSets: number;
  /** Finished sets with their actual times — after the last set or when stopped early */
  onFinish: (results: IntervalSetResult[]) => void;
}

function IntervalTimer({ exerciseName, sets, totalSets, onFinish }: IntervalTimerProps) {
  const [phase, setPhase] = useState<Phase>('overview');
  const [setPos, setSetPos] = useState(0);
  const [rep, setRep] = useState(1);
  const [remainingMs, setRemainingMs] = useState(READY_SECONDS * 1000);
  const [paused, setPaused] = useState(false);
  const endsAt = useRef(Date.now() + READY_SECONDS * 1000);
  const lastTick = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  // Actual times: start of the running phase, paused time in it, per set the finished phases
  const phaseStartedAt = useRef(Date.now());
  const pausedSince = useRef<number | null>(null);
  const pausedInPhase = useRef(0);
  const workMs = useRef<number[]>(sets.map(() => 0));
  const restMs = useRef<number[]>(sets.map(() => 0));
  const setRestMs = useRef<Array<number | null>>(sets.map(() => null));
  const finishedSets = useRef(0);

  const current = sets[Math.min(setPos, sets.length - 1)];

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

  const startPhase = useCallback((next: Phase, nextSetPos: number, nextRep: number) => {
    setPhase(next);
    setSetPos(nextSetPos);
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
    const plan = sets[nextSetPos];
    const seconds = next === 'work' ? plan.workSeconds : next === 'rest' ? plan.restSeconds : (plan.setRestSeconds ?? 0);
    endsAt.current = Date.now() + seconds * 1000;
    setRemainingMs(seconds * 1000);
    beep(next === 'work' ? 880 : 520, 350);
    navigator.vibrate?.(next === 'work' ? [300] : [150, 80, 150]);
  }, [sets, beep]);

  const advance = useCallback(() => {
    // Time actually spent in the finished phase (without pauses) — skipping counts as done
    const now = Date.now();
    const pausedNow = pausedSince.current !== null ? now - pausedSince.current : 0;
    const spent = Math.max(0, now - phaseStartedAt.current - pausedInPhase.current - pausedNow);
    if (phase === 'ready') { startPhase('work', 0, 1); return; }
    if (phase === 'work') {
      workMs.current[setPos] += spent;
      if (rep < current.reps) { startPhase('rest', setPos, rep); return; }
      // Last rep of the set
      finishedSets.current = setPos + 1;
      if (setPos + 1 < sets.length) {
        if (current.setRestSeconds && current.setRestSeconds > 0) startPhase('setRest', setPos, rep);
        else startPhase('work', setPos + 1, 1);
      } else {
        startPhase('done', setPos, rep);
      }
      return;
    }
    if (phase === 'rest') { restMs.current[setPos] += spent; startPhase('work', setPos, rep + 1); return; }
    if (phase === 'setRest') { setRestMs.current[setPos] = spent; startPhase('work', setPos + 1, 1); }
  }, [phase, setPos, rep, current, sets.length, startPhase]);

  // Clock
  useEffect(() => {
    if (paused || phase === 'done' || phase === 'overview') return;
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

  const begin = () => {
    beep(440, 120);
    endsAt.current = Date.now() + READY_SECONDS * 1000;
    phaseStartedAt.current = Date.now();
    setRemainingMs(READY_SECONDS * 1000);
    setPhase('ready');
  };

  // Whole run: reps × work + rests between reps + rests between sets
  const totalSeconds = sets.reduce((sum, p) =>
    sum + p.reps * p.workSeconds + (p.reps - 1) * p.restSeconds + (p.setRestSeconds ?? 0), 0);

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

  /** The finished sets (all sets when done, else those completed before stopping) */
  const results = (): IntervalSetResult[] =>
    sets.slice(0, finishedSets.current).map((plan, i) => ({
      setIdx: plan.setIdx,
      avgWorkSeconds: Math.round(workMs.current[i] / 1000 / plan.reps),
      avgRestSeconds: plan.reps > 1 ? Math.round(restMs.current[i] / 1000 / (plan.reps - 1)) : null,
      setRestSeconds: setRestMs.current[i] !== null ? Math.round(setRestMs.current[i]! / 1000) : null,
    }));

  const seconds = Math.ceil(remainingMs / 1000);
  const total = phase === 'work' ? current.workSeconds
    : phase === 'rest' ? current.restSeconds
      : phase === 'setRest' ? (current.setRestSeconds ?? 1)
        : READY_SECONDS;
  const progress = phase === 'done' ? 1 : 1 - remainingMs / (total * 1000);
  const intensity = phase === 'work' ? current.workIntensity
    : phase === 'rest' ? current.restIntensity
      : phase === 'setRest' ? current.setRestIntensity
        : undefined;
  const setLabel = `Set ${current.setIdx + 1} / ${totalSets}`;
  const nextSet = sets[setPos + 1];
  const done = results();

  const tone = phase === 'work'
    ? 'bg-red-600 text-white'
    : phase === 'rest'
      ? 'bg-emerald-600 text-white'
      : phase === 'setRest'
        ? 'bg-sky-700 text-white'
        : 'bg-background text-foreground';

  return createPortal(
    <div className="fixed inset-0 z-[400] flex justify-center bg-black/60">
      <div className={cn('w-full sm:w-[480px] h-full flex flex-col transition-colors duration-300', tone)}>
        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
          <div className="min-w-0">
            <p className="text-sm opacity-80 truncate">{exerciseName}</p>
            {phase !== 'overview' && <p className="text-xs opacity-70">{setLabel}</p>}
          </div>
          <button
            type="button"
            onClick={() => onFinish(results())}
            className="h-11 w-11 rounded-full flex items-center justify-center active:bg-black/10"
            aria-label="Stop intervals"
            title="Stop — finished sets are ticked off"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          {phase === 'overview' ? (
            <div className="w-full max-w-sm text-left space-y-3 overflow-y-auto max-h-full py-2">
              <div>
                <p className="text-2xl font-bold">{sets.length > 1 ? `Sets ${sets[0].setIdx + 1}–${sets[sets.length - 1].setIdx + 1}` : `Set ${sets[0].setIdx + 1}`}</p>
                <p className="text-sm text-muted-foreground">About {Math.max(1, Math.round(totalSeconds / 60))} min · runs through on its own once started</p>
              </div>
              <ol className="space-y-2">
                {sets.map((p, i) => (
                  <li key={p.setIdx} className="space-y-1.5">
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-sm font-semibold">Set {p.setIdx + 1} · {p.reps} {p.reps === 1 ? 'rep' : 'reps'}</p>
                      <p className="text-sm flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-600 shrink-0" />
                        Work {clock(p.workSeconds)}{p.workIntensity ? ` @ ${p.workIntensity}` : ''}
                        {p.workTargets && p.workTargets.length > 0 ? ` · ${p.workTargets.join(' · ')}` : ''}
                      </p>
                      {p.reps > 1 && (
                        <p className="text-sm flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shrink-0" />
                          Rest {clock(p.restSeconds)}{p.restIntensity ? ` @ ${p.restIntensity}` : ''} between reps
                        </p>
                      )}
                    </div>
                    {p.setRestSeconds !== null && i < sets.length - 1 && (
                      <p className="text-sm flex items-center gap-2 px-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-700 shrink-0" />
                        Rest between sets {clock(p.setRestSeconds)}{p.setRestIntensity ? ` @ ${p.setRestIntensity}` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                A beep and vibration at every switch. You can pause, skip or change a phase by −5 / +5 / +15 s at any time.
              </p>
            </div>
          ) : phase === 'done' ? (
            <>
              <p className="text-4xl font-bold">{done.length > 1 ? `${done.length} sets done` : 'Set done'}</p>
              <div className="text-base opacity-85 space-y-0.5">
                {done.map(r => (
                  <p key={r.setIdx}>
                    Set {r.setIdx + 1}: {clock(r.avgWorkSeconds)} work
                    {r.avgRestSeconds !== null ? ` / ${clock(r.avgRestSeconds)} rest` : ''}
                  </p>
                ))}
                <p className="text-xs opacity-75 pt-1">average per rep</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-widest">
                {phase === 'ready' ? 'GET READY' : phase === 'work' ? 'WORK' : phase === 'rest' ? 'REST' : 'REST BETWEEN SETS'}
              </p>
              <p className="text-8xl font-bold tabular-nums leading-none">{clock(seconds)}</p>
              {intensity && <p className="text-2xl font-semibold">@ {intensity}</p>}
              {(phase === 'work' || phase === 'ready') && current.workTargets && current.workTargets.length > 0 && (
                <p className="text-xl font-medium opacity-90">{current.workTargets.join(' · ')}</p>
              )}
              <p className="text-lg opacity-80">
                {phase === 'ready'
                  ? `${current.reps} × ${clock(current.workSeconds)} / ${clock(current.restSeconds)} rest`
                  : phase === 'setRest'
                    ? `Next: set ${(nextSet?.setIdx ?? current.setIdx) + 1}`
                    : `Rep ${rep} / ${current.reps}`}
              </p>
              <div className="w-full max-w-xs h-2 rounded-full bg-black/15 overflow-hidden">
                <div className="h-full bg-current opacity-80" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
              </div>
              {(phase === 'work' || phase === 'rest') && (
                <p className="text-sm opacity-75">
                  {phase === 'rest'
                    ? `Next: work ${clock(current.workSeconds)}`
                    : rep < current.reps
                      ? `Next: rest ${clock(current.restSeconds)}`
                      : nextSet
                        ? current.setRestSeconds ? `Next: rest between sets ${clock(current.setRestSeconds)}` : `Next: set ${nextSet.setIdx + 1}`
                        : 'Last rep'}
                </p>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="shrink-0 px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {phase === 'overview' ? (
            <button
              type="button"
              onClick={begin}
              className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Play className="h-5 w-5" /> Start
            </button>
          ) : phase === 'done' ? (
            <button
              type="button"
              onClick={() => onFinish(done)}
              className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-semibold active:scale-[0.98]"
            >
              Done — tick off {done.length > 1 ? `${done.length} sets` : `set ${done[0]?.setIdx + 1}`}
            </button>
          ) : (
            <>
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
              {paused && <p className="text-center text-sm mt-3 opacity-80">Paused</p>}
            </>
          )}
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
  /** Writes a value into a set (the actual times when they differ from the plan) */
  onLogValue: (setIdx: number, param: string, value: string) => void;
  /** Ticks off several sets at once (finished in the timer) */
  onCompleteSets: (setIdxs: number[]) => void;
}

/** "Start intervals" from the next set that isn't done — only for methods with an interval timer */
export function IntervalLauncher({ exercise, setCount, doneSets, valueFor, onLogValue, onCompleteSets }: IntervalLauncherProps) {
  const [running, setRunning] = useState<IntervalSetPlan[] | null>(null);
  const spec = exercise.interval;
  if (!spec) return null;

  const open = Array.from({ length: setCount }, (_, i) => i).filter(i => !doneSets.includes(i));
  if (open.length === 0) return null;

  const unit = (p: string) => {
    const u = exercise.plannedParams?.[`${p}_unit`];
    return u ? String(u) : undefined;
  };
  const withUnit = (setIdx: number, p?: string) => {
    if (!p) return undefined;
    const v = valueFor(setIdx, p);
    if (!v) return undefined;
    const u = unit(p);
    return u ? `${v} ${u}` : v;
  };
  const setRestOf = (setIdx: number) => (spec.setRest ? toSeconds(valueFor(setIdx, spec.setRest), unit(spec.setRest)) : null);
  const planFor = (setIdx: number): IntervalSetPlan | null => {
    const reps = parseMeasuredNumber(valueFor(setIdx, spec.reps));
    const work = toSeconds(valueFor(setIdx, spec.work), unit(spec.work));
    const rest = toSeconds(valueFor(setIdx, spec.rest), unit(spec.rest));
    if (reps === null || reps < 1 || work === null || rest === null) return null;
    return {
      setIdx,
      reps: Math.round(reps),
      workSeconds: work,
      restSeconds: rest,
      setRestSeconds: null,
      workIntensity: withUnit(setIdx, spec.workIntensity),
      restIntensity: withUnit(setIdx, spec.restIntensity),
      setRestIntensity: withUnit(setIdx, spec.setRestIntensity),
      workTargets: (spec.workTargets ?? []).map(p => withUnit(setIdx, p)).filter((t): t is string => !!t),
    };
  };

  // The run: from the next open set through the following ones while each has its values — with
  // a rest between sets; without one the timer covers one set per start
  const first = planFor(open[0]);
  const runPlans: IntervalSetPlan[] = [];
  if (first) {
    runPlans.push(first);
    for (const idx of open.slice(1)) {
      const prev = runPlans[runPlans.length - 1];
      const between = setRestOf(prev.setIdx);
      const next = planFor(idx);
      if (!between || !next) break;
      prev.setRestSeconds = between;
      runPlans.push(next);
    }
  }

  const notTime = [spec.work, spec.rest].filter(p => !isTimeUnit(unit(p)));

  const finish = (results: IntervalSetResult[]) => {
    const plans = running ?? [];
    for (const r of results) {
      const plan = plans.find(p => p.setIdx === r.setIdx);
      if (!plan) continue;
      // The time actually spent (extended / shortened / skipped) — the coach sees the real exposure
      if (Math.abs(r.avgWorkSeconds - plan.workSeconds) >= 1) onLogValue(r.setIdx, spec.work, fromSeconds(r.avgWorkSeconds, unit(spec.work)));
      if (r.avgRestSeconds !== null && Math.abs(r.avgRestSeconds - plan.restSeconds) >= 1) {
        onLogValue(r.setIdx, spec.rest, fromSeconds(r.avgRestSeconds, unit(spec.rest)));
      }
      if (spec.setRest && r.setRestSeconds !== null && plan.setRestSeconds && Math.abs(r.setRestSeconds - plan.setRestSeconds) >= 1) {
        onLogValue(r.setIdx, spec.setRest, fromSeconds(r.setRestSeconds, unit(spec.setRest)));
      }
    }
    if (results.length > 0) onCompleteSets(results.map(r => r.setIdx));
    setRunning(null);
  };

  const label = (() => {
    if (!first) {
      return notTime.length > 0
        ? `Interval timer needs a time (s / min) for ${notTime.join(' and ')}`
        : 'Interval timer: enter reps, work and rest time first';
    }
    const sets = runPlans.length > 1
      ? `Sets ${runPlans[0].setIdx + 1}–${runPlans[runPlans.length - 1].setIdx + 1}`
      : `Set ${first.setIdx + 1}`;
    const between = runPlans.length > 1 && runPlans[0].setRestSeconds ? ` · ${clock(runPlans[0].setRestSeconds)} between sets` : '';
    return `Start intervals · ${sets}: ${first.reps} × ${clock(first.workSeconds)} / ${clock(first.restSeconds)} rest${between}`;
  })();

  return (
    <>
      <button
        type="button"
        disabled={!first}
        onClick={() => first && setRunning(runPlans)}
        className={cn(
          'w-full mb-2 flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all active:scale-[0.98]',
          first ? 'border-primary bg-primary/5 text-primary hover:bg-primary/10' : 'border-dashed text-muted-foreground',
        )}
      >
        <Timer className="h-4 w-4 shrink-0" />
        <span className="text-left">{label}</span>
      </button>
      {running && (
        <IntervalTimer
          exerciseName={exercise.name}
          sets={running}
          totalSets={setCount}
          onFinish={finish}
        />
      )}
    </>
  );
}
