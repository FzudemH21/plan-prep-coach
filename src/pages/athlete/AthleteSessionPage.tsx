import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Check, Dumbbell, RefreshCw,
  CheckCircle2, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAthleteApp, AthleteScheduleEntry, ExerciseSummary } from '@/hooks/useAthleteApp';
import { useToast } from '@/hooks/use-toast';

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'overview' | 'active' | 'rest' | 'sectionDone' | 'done';

interface SectionData {
  id: string;
  name: string;
  order: number;
  exercises: ExerciseSummary[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupIntoSections(exercises: ExerciseSummary[]): SectionData[] {
  if (exercises.length === 0) return [];
  const map = new Map<string, SectionData>();
  for (const ex of exercises) {
    const sid = ex.sectionId ?? '__none__';
    if (!map.has(sid)) {
      map.set(sid, {
        id: sid,
        name: ex.sectionName ?? (sid === '__none__' ? 'Workout' : sid),
        order: ex.sectionOrder ?? 0,
        exercises: [],
      });
    }
    map.get(sid)!.exercises.push(ex);
  }
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map(s => ({ ...s, exercises: [...s.exercises].sort((a, b) => a.order - b.order) }));
}

function getSetCount(ex: ExerciseSummary): number {
  return ex.plannedSets && ex.plannedSets > 0 ? ex.plannedSets : 3;
}

/** Derive which param names to show as columns (excluding the "sets" count param). */
function getParamColumns(ex: ExerciseSummary): string[] {
  // Build candidate list: coach-configured params take priority, otherwise
  // derive from all _setN keys present in plannedParams.
  let candidates: string[];
  if (ex.visibleParams && ex.visibleParams.length > 0) {
    candidates = ex.visibleParams;
  } else if (ex.plannedParams) {
    const bases = new Set<string>();
    for (const key of Object.keys(ex.plannedParams)) {
      const m = key.match(/^(.+)_set\d+$/);
      if (m) bases.add(m[1]);
    }
    candidates = bases.size > 0 ? Array.from(bases) : ['Reps'];
  } else {
    return ['Reps'];
  }

  // Filter to only columns that have at least one non-empty planned value.
  // Supports two storage formats:
  //   • Per-set keys: "Reps_set1", "Reps_set2", … (ad-hoc/toolbox exercises)
  //   • Plain keys:   "Reps", "Tempo", …          (periodization-table exercises)
  if (ex.plannedParams) {
    const withValues = candidates.filter(param => {
      for (const [key, val] of Object.entries(ex.plannedParams!)) {
        if (val === undefined || val === null || val === '') continue;
        const m = key.match(/^(.+)_set\d+$/);
        if (m && m[1] === param) return true;  // per-set format
        if (key === param) return true;          // plain format (periodization table)
      }
      return false;
    });
    if (withValues.length > 0) return withValues;
  }

  // plannedParams exists but no candidate has a non-empty _setN value.
  // This happens when the Supabase sync ran before the periodization table
  // was filled (stale data, plannedParams = {}).  Show a minimal grid rather
  // than an all-"—" table spanning every toolbox parameter.
  return ['Reps'];
}

function getPlannedValue(ex: ExerciseSummary, paramName: string, setIdx: number): string {
  if (!ex.plannedParams) return '';
  // Per-set format (ad-hoc/toolbox exercises): "Reps_set1", "Reps_set2", …
  const perSetVal = ex.plannedParams[`${paramName}_set${setIdx + 1}`];
  if (perSetVal !== undefined && perSetVal !== null && perSetVal !== '') return String(perSetVal);
  // Plain format (periodization-table exercises): one value applies to all sets
  const plainVal = ex.plannedParams[paramName];
  if (plainVal !== undefined && plainVal !== null && plainVal !== '') return String(plainVal);
  return '';
}

/** Resolve rest duration in seconds for an exercise.
 *  Priority: explicit restParamName from toolbox → regex heuristic → 90 s default. */
function getRestSeconds(ex: ExerciseSummary): number {
  if (!ex.plannedParams) return 90;

  function parseRestValue(key: string): number | null {
    const val = ex.plannedParams![key];
    if (val === undefined || val === '') return null;
    const n = Number(val);
    if (isNaN(n) || n <= 0) return null;
    const unitKey = ex.plannedParams![`${key}_unit`];
    if (/min/i.test(String(unitKey)) || n <= 15) return n * 60;
    return n;
  }

  // 1. Use the named rest parameter set by the toolbox
  if (ex.restParamName) {
    const secs = parseRestValue(ex.restParamName);
    if (secs !== null) return secs;
  }

  // 2. Heuristic fallback: scan for a key that smells like rest/pause/recovery
  const REST = /rest|pause|recovery/i;
  for (const key of Object.keys(ex.plannedParams)) {
    if (/_set\d+$/.test(key) || key.endsWith('_unit')) continue;
    if (REST.test(key)) {
      const secs = parseRestValue(key);
      if (secs !== null) return secs;
    }
  }

  return 90;
}

/** Returns base param entries that have a non-empty planned value but are NOT
 *  shown in the set-table columns — to be displayed as info chips below the grid. */
function getHiddenParamTags(ex: ExerciseSummary): Array<{ name: string; value: string; unit?: string }> {
  if (!ex.plannedParams) return [];
  const visible = new Set(getParamColumns(ex));
  const SET_RE = /^sets?$/i;
  const REST_RE = /rest|pause|recovery/i;
  const restNameLc = ex.restParamName?.toLowerCase();

  const seen = new Set<string>();
  const tags: Array<{ name: string; value: string; unit?: string }> = [];

  for (const key of Object.keys(ex.plannedParams)) {
    if (/_set\d+$/.test(key) || key.endsWith('_unit')) continue;
    if (visible.has(key)) continue;
    if (SET_RE.test(key)) continue;
    if (REST_RE.test(key) || (restNameLc && key.toLowerCase() === restNameLc)) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    const val = ex.plannedParams[key];
    if (val === undefined || val === null || val === '') continue;

    const unitRaw = ex.plannedParams[`${key}_unit`];
    const unit = unitRaw !== undefined && unitRaw !== '' ? String(unitRaw) : undefined;
    tags.push({ name: key, value: String(val), unit });
  }

  return tags;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Borg CR10 completion sheet ────────────────────────────────────────────────

const BORG_LABELS: Record<number, string> = {
  0: 'Rest', 1: 'Very, Very Easy', 2: 'Easy', 3: 'Moderate',
  4: 'Somewhat Hard', 5: 'Hard', 7: 'Very Hard', 10: 'Maximal',
};

interface CompletionSheetProps {
  open: boolean;
  onClose: () => void;
  connectionId: string;
  date: string;
  sessionId: string;
  sessionName: string;
  setsLogged: unknown[];
  onSaved: () => void;
}

function CompletionSheet({
  open, onClose, connectionId, date, sessionId, sessionName, setsLogged, onSaved,
}: CompletionSheetProps) {
  const [borgRating, setBorgRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from('athlete_session_logs').insert({
      athlete_connection_id: connectionId,
      date,
      session_id: sessionId,
      session_name: sessionName,
      completed_at: new Date().toISOString(),
      borg_rating: borgRating,
      comment: comment.trim() || null,
      sets_logged: setsLogged,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Error saving session', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Session logged!' });
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto p-0 sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-2xl">
        <div className="px-5 pt-4 pb-8">
          <SheetHeader className="mb-5">
            <div className="flex flex-col items-center gap-2 pt-2">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <SheetTitle>Workout Complete!</SheetTitle>
              <p className="text-sm text-muted-foreground">{sessionName}</p>
            </div>
          </SheetHeader>

          <p className="text-sm font-semibold mb-3">How hard was it? (Borg CR10)</p>
          <div className="flex flex-col gap-1 mb-5">
            {Array.from({ length: 11 }, (_, v) => (
              <button
                key={v}
                onClick={() => setBorgRating(borgRating === v ? null : v)}
                className={cn(
                  'flex items-center gap-3 w-full rounded-lg border px-3 py-2 text-sm text-left transition-colors',
                  'border-border hover:bg-muted/60',
                  borgRating === v && 'border-primary bg-primary/10 font-semibold',
                )}
              >
                <span className="w-5 text-center font-bold tabular-nums shrink-0">{v}</span>
                <span className={cn('text-sm', borgRating === v ? 'text-foreground' : 'text-muted-foreground')}>
                  {BORG_LABELS[v] ?? <span className="opacity-30">—</span>}
                </span>
              </button>
            ))}
          </div>

          <p className="text-sm font-semibold mb-2">Notes (optional)</p>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Any notes about this session…"
            className="resize-none h-20 mb-5"
          />

          <Button className="w-full" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save & Finish'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Set logging table ─────────────────────────────────────────────────────────

interface SetTableProps {
  exercise: ExerciseSummary;
  loggedValues: Record<string, Record<number, Record<string, string>>>;
  completedSets: Record<string, number[]>;
  onLogValue: (exId: string, setIdx: number, paramName: string, val: string) => void;
  onCompleteSet: (exId: string, setIdx: number) => void;
  onMarkAll: (exId: string) => void;
}

function SetTable({ exercise, loggedValues, completedSets, onLogValue, onCompleteSet, onMarkAll }: SetTableProps) {
  const setCount = getSetCount(exercise);
  const columns = getParamColumns(exercise);
  const doneArr = completedSets[exercise.id] ?? [];
  const allDone = doneArr.length >= setCount;

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-center py-2 px-2 text-xs text-muted-foreground font-semibold w-8">#</th>
            {columns.map(col => (
              <th key={col} className="text-center py-2 px-2 text-xs text-muted-foreground font-semibold">
                {col}
              </th>
            ))}
            {/* Mark-all header button */}
            <th className="w-10 py-2 text-center">
              <button
                onClick={() => !allDone && onMarkAll(exercise.id)}
                disabled={allDone}
                title="Mark all sets done"
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all text-xs font-bold',
                  allDone
                    ? 'bg-primary/20 text-primary cursor-default'
                    : 'border-2 border-dashed border-border hover:border-primary hover:bg-primary/10 active:scale-95 text-muted-foreground',
                )}
              >
                ✓✓
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: setCount }, (_, setIdx) => {
            const isDone = doneArr.includes(setIdx);
            return (
              <tr key={setIdx} className={cn('border-b last:border-0 transition-colors', isDone && 'bg-primary/5')}>
                <td className="text-center py-2 px-2 text-muted-foreground font-medium tabular-nums">
                  {setIdx + 1}
                </td>
                {columns.map(col => {
                  const planned = getPlannedValue(exercise, col, setIdx);
                  const logged = loggedValues[exercise.id]?.[setIdx]?.[col];
                  // Show logged value if the athlete typed one, otherwise fall back to the
                  // planned value so the athlete can see targets without re-typing them.
                  const displayValue = (logged !== undefined && logged !== '') ? logged : planned;
                  return (
                    <td key={col} className="py-1.5 px-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={displayValue}
                        placeholder="—"
                        onChange={e => onLogValue(exercise.id, setIdx, col, e.target.value)}
                        disabled={isDone}
                        className={cn(
                          'w-full text-center border rounded-md px-1.5 py-1.5 text-sm min-w-[48px]',
                          'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          isDone && 'line-through text-muted-foreground',
                          // Distinguish pre-filled planned values (not yet confirmed by athlete)
                          !logged && planned && !isDone && 'text-muted-foreground italic',
                        )}
                      />
                    </td>
                  );
                })}
                <td className="py-1.5 pr-2 text-center">
                  <button
                    onClick={() => !isDone && onCompleteSet(exercise.id, setIdx)}
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all',
                      isDone
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'border-2 border-border hover:border-primary hover:bg-primary/10 active:scale-95',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface LocationState {
  entry: AthleteScheduleEntry;
  sessionIdx: number;
}

export default function AthleteSessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { connection } = useAthleteApp();

  const state = location.state as LocationState | null;

  // ── State ──────────────────────────────────────────────────────────────────

  const [phase, setPhase] = useState<Phase>('overview');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState(90);
  const nextAfterRestRef = useRef<(() => void) | null>(null);

  // loggedValues: exerciseId -> setIdx -> paramName -> actual value string
  const [loggedValues, setLoggedValues] = useState<Record<string, Record<number, Record<string, string>>>>({});
  // completedSets: exerciseId -> number[] of completed set indices
  const [completedSets, setCompletedSets] = useState<Record<string, number[]>>({});
  const [borgSheetOpen, setBorgSheetOpen] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const sections = useMemo<SectionData[]>(() => {
    if (!state) return [];
    const session = state.entry.sessions[state.sessionIdx];
    return groupIntoSections(session?.exercises ?? []);
  }, [state]);

  const currentSection = sections[sectionIdx];
  const currentExercise = currentSection?.exercises[exerciseIdx];

  // ── Rest timer ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'rest') return;
    if (restSecondsLeft <= 0) {
      const next = nextAfterRestRef.current;
      nextAfterRestRef.current = null;
      next?.();
      return;
    }
    const timer = setTimeout(() => setRestSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, restSecondsLeft]);

  function startRest(seconds: number, next: () => void) {
    nextAfterRestRef.current = next;
    setRestSecondsLeft(Math.max(1, seconds));
    setPhase('rest');
  }

  function skipRest() {
    const next = nextAfterRestRef.current;
    nextAfterRestRef.current = null;
    setRestSecondsLeft(0);
    next?.();
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleLogValue(exId: string, setIdx: number, paramName: string, val: string) {
    setLoggedValues(prev => ({
      ...prev,
      [exId]: {
        ...(prev[exId] ?? {}),
        [setIdx]: { ...(prev[exId]?.[setIdx] ?? {}), [paramName]: val },
      },
    }));
  }

  /** Auto-log the planned value for every column in a set that the athlete
   *  hasn't typed a value for, so the Borg/completion payload captures the
   *  target values even when the athlete just taps the check without editing. */
  function autoFillPlanned(ex: ExerciseSummary, setIdx: number) {
    const cols = getParamColumns(ex);
    cols.forEach(col => {
      const already = loggedValues[ex.id]?.[setIdx]?.[col];
      if (already !== undefined && already !== '') return;
      const planned = getPlannedValue(ex, col, setIdx);
      if (planned) handleLogValue(ex.id, setIdx, col, planned);
    });
  }

  function handleCompleteSet(exerciseId: string, setIdx: number) {
    const doneArr = completedSets[exerciseId] ?? [];
    if (doneArr.includes(setIdx)) return; // already marked

    const ex = currentExercise;
    if (!ex) return;

    // Persist planned values for any cell the athlete didn't manually fill
    autoFillPlanned(ex, setIdx);

    const setCount = getSetCount(ex);
    const newDoneArr = [...doneArr, setIdx];
    const allSetsDone = newDoneArr.length >= setCount &&
      Array.from({ length: setCount }, (_, i) => i).every(i => newDoneArr.includes(i));

    setCompletedSets(prev => ({
      ...prev,
      [exerciseId]: [...(prev[exerciseId] ?? []), setIdx],
    }));

    const isLastExercise = exerciseIdx === (currentSection?.exercises.length ?? 0) - 1;
    const isLastSection = sectionIdx === sections.length - 1;
    const restSecs = getRestSeconds(ex);

    if (allSetsDone && isLastExercise && isLastSection) {
      startRest(restSecs, () => { setPhase('done'); setBorgSheetOpen(true); });
    } else if (allSetsDone && isLastExercise) {
      startRest(restSecs, () => setPhase('sectionDone'));
    } else if (allSetsDone) {
      startRest(restSecs, () => { setExerciseIdx(i => i + 1); setPhase('active'); });
    } else {
      // Between sets — rest then return
      startRest(restSecs, () => setPhase('active'));
    }
  }

  /** Mark every remaining set for the current exercise as done in one tap. */
  function handleMarkAll(exerciseId: string) {
    const ex = currentExercise;
    if (!ex || ex.id !== exerciseId) return;
    const setCount = getSetCount(ex);
    const doneArr = completedSets[exerciseId] ?? [];
    const undone = Array.from({ length: setCount }, (_, i) => i).filter(i => !doneArr.includes(i));
    if (undone.length === 0) return;

    // Auto-fill planned values for every undone set
    undone.forEach(setIdx => autoFillPlanned(ex, setIdx));

    const newDoneArr = [...doneArr, ...undone];
    setCompletedSets(prev => ({ ...prev, [exerciseId]: newDoneArr }));

    const isLastExercise = exerciseIdx === (currentSection?.exercises.length ?? 0) - 1;
    const isLastSection = sectionIdx === sections.length - 1;
    const restSecs = getRestSeconds(ex);

    if (isLastExercise && isLastSection) {
      startRest(restSecs, () => { setPhase('done'); setBorgSheetOpen(true); });
    } else if (isLastExercise) {
      startRest(restSecs, () => setPhase('sectionDone'));
    } else {
      startRest(restSecs, () => { setExerciseIdx(i => i + 1); setPhase('active'); });
    }
  }

  function handleNextSection() {
    setSectionIdx(i => i + 1);
    setExerciseIdx(0);
    setPhase('active');
  }

  function handleSaved() {
    setBorgSheetOpen(false);
    navigate(-1);
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-sm text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const { entry, sessionIdx: sessionIdxProp } = state;
  const session = entry.sessions[sessionIdxProp];

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-sm text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  // Build sets_logged payload for Borg sheet
  const setsLoggedPayload = Object.entries(loggedValues).map(([exId, sets]) => {
    const ex = session.exercises.find(e => e.id === exId);
    return {
      exerciseName: ex?.name ?? exId,
      sets: Object.entries(sets).map(([idx, vals]) => ({ setNumber: Number(idx) + 1, values: vals })),
    };
  });

  // ── Screen: Overview ───────────────────────────────────────────────────────

  if (phase === 'overview') {
    return (
      <div className="flex flex-col h-screen bg-background max-w-[480px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-base truncate pr-8">{session.name}</h1>
        </div>

        {/* Sub-header */}
        <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            {[entry.programName, entry.mesocycleName, formatDate(entry.date)].filter(Boolean).join(' · ')}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Dumbbell className="h-8 w-8 opacity-30" />
                <p className="text-sm">No exercises assigned yet.</p>
              </div>
            ) : (
              sections.map((sec, i) => (
                <Card key={sec.id} className="border-border/60">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{sec.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sec.exercises.length} exercise{sec.exercises.length !== 1 ? 's' : ''}
                        {sec.exercises.some(e => e.isCircuit) ? ' · circuit' : ''}
                      </p>
                      {/* Mini exercise preview */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {sec.exercises.slice(0, 4).map(ex => (
                          <span key={ex.id} className="text-xs bg-muted rounded px-1.5 py-0.5 truncate max-w-[120px]">
                            {ex.name}
                          </span>
                        ))}
                        {sec.exercises.length > 4 && (
                          <span className="text-xs text-muted-foreground">+{sec.exercises.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        {sections.length > 0 && (
          <div className="px-4 py-4 border-t bg-background shrink-0">
            <Button className="w-full" size="lg" onClick={() => setPhase('active')}>
              Start Workout
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Screen: Rest timer ─────────────────────────────────────────────────────

  if (phase === 'rest') {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center gap-8 px-6 max-w-[480px] mx-auto">
        <div className="flex flex-col items-center gap-2">
          <Timer className="h-8 w-8 text-primary opacity-70" />
          <p className="text-lg font-semibold text-muted-foreground">Rest</p>
        </div>

        {/* Big countdown */}
        <p className="text-[80px] font-bold tabular-nums leading-none">
          {formatTime(restSecondsLeft)}
        </p>

        {/* Adjust buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            size="lg"
            className="w-24"
            onClick={() => setRestSecondsLeft(s => Math.max(1, s - 30))}
          >
            −30s
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-24"
            onClick={() => setRestSecondsLeft(s => s + 30)}
          >
            +30s
          </Button>
        </div>

        <button
          onClick={skipRest}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Skip rest
        </button>
      </div>
    );
  }

  // ── Screen: Section done ───────────────────────────────────────────────────

  if (phase === 'sectionDone') {
    const doneSection = sections[sectionIdx];
    const isLast = sectionIdx === sections.length - 1;
    const nextSection = sections[sectionIdx + 1];

    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center gap-6 px-6 max-w-[480px] mx-auto">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <div className="text-center">
          <p className="text-2xl font-bold">Section Complete!</p>
          <p className="text-muted-foreground mt-1">{doneSection?.name}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {doneSection?.exercises.length} exercise{doneSection?.exercises.length !== 1 ? 's' : ''} done
        </p>

        {!isLast ? (
          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
            <p className="text-xs text-muted-foreground">Up next</p>
            <Card className="w-full">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {sectionIdx + 2}
                </div>
                <div>
                  <p className="font-medium text-sm">{nextSection?.name}</p>
                  <p className="text-xs text-muted-foreground">{nextSection?.exercises.length} exercises</p>
                </div>
              </CardContent>
            </Card>
            <Button className="w-full mt-2" size="lg" onClick={handleNextSection}>
              Start {nextSection?.name}
            </Button>
          </div>
        ) : (
          <Button className="w-full max-w-xs" size="lg" onClick={() => { setPhase('done'); setBorgSheetOpen(true); }}>
            Finish Workout
          </Button>
        )}
      </div>
    );
  }

  // ── Screen: Active exercise ────────────────────────────────────────────────

  if (phase === 'active' || phase === 'done') {
    const ex = currentExercise;
    const totalSections = sections.length;
    const totalExercisesInSection = currentSection?.exercises.length ?? 0;

    return (
      <div className="flex flex-col h-screen bg-background max-w-[480px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <button
            onClick={() => setPhase('overview')}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 text-center pr-8">
            <p className="text-xs text-muted-foreground truncate">{session.name}</p>
            <p className="text-sm font-semibold truncate">{currentSection?.name}</p>
          </div>
        </div>

        {/* Section + exercise progress indicators */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          {/* Section dots */}
          {totalSections > 1 && (
            <div className="flex justify-center gap-1.5 mb-2">
              {sections.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-full transition-all',
                    i === sectionIdx ? 'w-4 h-2 bg-primary' : 'w-2 h-2 bg-muted-foreground/30',
                  )}
                />
              ))}
            </div>
          )}
          {/* Exercise counter */}
          <p className="text-xs text-center text-muted-foreground">
            Exercise {exerciseIdx + 1} of {totalExercisesInSection}
          </p>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="py-3 space-y-4">
            {ex ? (
              <>
                {/* Exercise header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {ex.isCircuit
                      ? <RefreshCw className="h-4 w-4 text-primary" />
                      : <Dumbbell className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold leading-snug">{ex.name}</h2>
                    {ex.notes && (
                      <p className="text-sm text-muted-foreground mt-0.5">{ex.notes}</p>
                    )}
                  </div>
                </div>

                {/* Set logging table */}
                <SetTable
                  exercise={ex}
                  loggedValues={loggedValues}
                  completedSets={completedSets}
                  onLogValue={handleLogValue}
                  onCompleteSet={handleCompleteSet}
                  onMarkAll={handleMarkAll}
                />

                {/* Hidden param tags — params configured but not visible in the grid */}
                {(() => {
                  const tags = getHiddenParamTags(ex);
                  if (tags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {tags.map(tag => (
                        <span
                          key={tag.name}
                          className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 border border-border/50"
                        >
                          {tag.name}: {tag.value}{tag.unit ? ` ${tag.unit}` : ''}
                        </span>
                      ))}
                    </div>
                  );
                })()}

                {/* Planned info chip */}
                {ex.plannedSets && (
                  <p className="text-xs text-muted-foreground text-center">
                    Planned: {ex.plannedSets} sets
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Dumbbell className="h-8 w-8 opacity-30" />
                <p className="text-sm">No exercise selected.</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom navigation */}
        <div className="px-4 py-4 border-t bg-background shrink-0">
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={exerciseIdx === 0 && sectionIdx === 0}
              onClick={() => {
                if (exerciseIdx > 0) {
                  setExerciseIdx(i => i - 1);
                } else if (sectionIdx > 0) {
                  setSectionIdx(i => i - 1);
                  setExerciseIdx(sections[sectionIdx - 1].exercises.length - 1);
                }
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>

            {exerciseIdx < (currentSection?.exercises.length ?? 0) - 1 ? (
              <Button
                size="lg"
                className="flex-1"
                onClick={() => setExerciseIdx(i => i + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : sectionIdx < sections.length - 1 ? (
              <Button
                size="lg"
                className="flex-1"
                onClick={() => setPhase('sectionDone')}
              >
                Done
                <Check className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="flex-1"
                onClick={() => { setPhase('done'); setBorgSheetOpen(true); }}
              >
                Finish
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Borg completion sheet */}
        {connection && (
          <CompletionSheet
            open={borgSheetOpen}
            onClose={() => setBorgSheetOpen(false)}
            connectionId={connection.id}
            date={entry.date}
            sessionId={session.id}
            sessionName={session.name}
            setsLogged={setsLoggedPayload}
            onSaved={handleSaved}
          />
        )}
      </div>
    );
  }

  return null;
}
