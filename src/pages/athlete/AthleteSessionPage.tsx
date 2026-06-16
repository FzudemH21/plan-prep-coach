import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronDown, Check, Dumbbell, RefreshCw,
  CheckCircle2, Timer, Plus, Minus, ArrowUpDown, TrendingUp, TrendingDown,
  MessageSquare, Send, Loader2, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAthleteSettings } from '@/hooks/useAthleteSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAthleteApp, AthleteScheduleEntry, ExerciseSummary, SessionLog } from '@/hooks/useAthleteApp';
import { useChat } from '@/hooks/useChat';
import { ExerciseHistorySheet } from '@/components/shared/ExerciseHistorySheet';
import { useToast } from '@/hooks/use-toast';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'overview' | 'sectionIntro' | 'active' | 'rest' | 'done';

interface SectionData {
  id: string;
  name: string;
  order: number;
  notes?: string;
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
        name: ex.sectionName ?? (sid === '__none__' ? 'Workout' : 'Section'),
        order: ex.sectionOrder ?? 0,
        // sectionNotes is the same for every exercise in the section — grab once
        notes: ex.sectionNotes || undefined,
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
  if (ex.isCircuit) return Math.max(1, Number(ex.circuitRounds ?? 3));
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

  // Strip rest parameters — rest drives the timer, not a log column for the athlete
  const REST_RE = /rest|pause|recovery/i;
  candidates = candidates.filter(p => p !== ex.restParamName && !REST_RE.test(p));

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

    // plannedParams exists but no candidate has a non-empty value yet.
    // This happens for brand-new toolbox exercises (adhocPlannedParams has all
    // empty per-set placeholder keys) or when the periodization table wasn't filled.
    // If the coach configured visible columns, show them so the athlete can
    // fill in their actual values during the workout.
    if (candidates.length > 0) return candidates;
  }

  // No plannedParams or it was empty — fall back to the configured visible
  // columns if available, otherwise default to a single Reps column.
  return candidates.length > 0 ? candidates : ['Reps'];
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
 *  Circuits use circuitRestBetweenRounds; regular exercises use planned params. */
function getRestSeconds(ex: ExerciseSummary): number {
  if (ex.isCircuit) {
    const secs = Number(ex.circuitRestBetweenRounds ?? 60);
    return secs > 0 ? secs : 60;
  }
  if (!ex.plannedParams) return 90;

  function parseRestValue(key: string): number | null {
    // Per-set keys take priority over the plain key so that training-calendar overrides
    // (stored as Rest_set1, Rest_set2, …) win over the periodization-table baseline.
    // Also handles ad-hoc exercises where the plain key is always ''.
    for (let i = 1; i <= 20; i++) {
      const sv = ex.plannedParams![`${key}_set${i}`];
      if (sv === undefined) break;   // no more set keys — stop scanning
      if (sv === '') continue;       // empty slot — try next
      const n = Number(sv);
      if (!isNaN(n) && n > 0) {
        const unitKey = ex.plannedParams![`${key}_unit`];
        if (/min/i.test(String(unitKey)) || n <= 15) return n * 60;
        return n;
      }
    }
    // Plain key fallback: periodization-table baseline for exercises without per-set overrides.
    const raw = ex.plannedParams![key];
    if (raw === undefined || raw === '') return null;
    const n = Number(raw);
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


function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatCompletedAt(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
  durationSeconds: number;
  setsLogged: unknown[];
  onSaved: () => void;
  /** ID of the in-progress row created when "Start Workout" was tapped.
   *  When present, we UPDATE that row instead of INSERTing a new one. */
  sessionLogId?: string | null;
}

function CompletionSheet({
  open, onClose, connectionId, date, sessionId, sessionName, durationSeconds, setsLogged, onSaved, sessionLogId,
}: CompletionSheetProps) {
  const [borgRating, setBorgRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleSave() {
    setSaving(true);
    const completionPayload = {
      completed_at: new Date().toISOString(),
      borg_rating: borgRating,
      duration_seconds: durationSeconds > 0 ? durationSeconds : null,
      comment: comment.trim() || null,
      sets_logged: setsLogged,
    };

    let error;
    if (sessionLogId) {
      // Update the in-progress row that was created on "Start Workout"
      ({ error } = await supabase
        .from('athlete_session_logs')
        .update(completionPayload)
        .eq('id', sessionLogId));
    } else {
      // Fallback: insert a fresh row (no in-progress row was created)
      ({ error } = await supabase.from('athlete_session_logs').insert({
        athlete_connection_id: connectionId,
        date,
        session_id: sessionId,
        session_name: sessionName,
        ...completionPayload,
      }));
    }

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

// ── Circuit helpers ───────────────────────────────────────────────────────────

function formatCircuitExerciseParams(cex: {
  reps: string; time?: string; distance?: string; enabledParams?: string[];
}): string {
  const enabled = cex.enabledParams ?? ['reps'];
  const parts: string[] = [];
  if (enabled.includes('reps') && cex.reps) parts.push(`${cex.reps}×`);
  if (enabled.includes('time') && cex.time) parts.push(`${cex.time}s`);
  if (enabled.includes('distance') && cex.distance) parts.push(`${cex.distance}m`);
  return parts.join(' · ');
}

interface CircuitCardProps {
  exercise: ExerciseSummary;
  completedSets: Record<string, number[]>;
  onCompleteRound: (exId: string, roundIdx: number) => void;
  onShowDetail?: (target: ExerciseDetailTarget) => void;
}

function CircuitCard({ exercise, completedSets, onCompleteRound, onShowDetail }: CircuitCardProps) {
  const rounds = Math.max(1, Number(exercise.circuitRounds ?? 3));
  const completedRoundsList = completedSets[exercise.id] ?? [];
  const nextRoundIdx = Array.from({ length: rounds }, (_, i) => i)
    .find(i => !completedRoundsList.includes(i));
  const allDone = completedRoundsList.length >= rounds;

  const [exListOpen, setExListOpen] = useState(true);
  const circuitExercises = (exercise.circuitExercises ?? [])
    .slice()
    .sort((a, b) => a.order - b.order);

  const restBetweenRounds = Number(exercise.circuitRestBetweenRounds ?? 0);
  const restBetweenExercises = Number(exercise.circuitRestBetweenExercises ?? 0);

  return (
    <div className="space-y-3">
      {/* Info line */}
      <p className="text-xs text-muted-foreground">
        {restBetweenRounds > 0 && `${restBetweenRounds}s rest between rounds`}
        {restBetweenRounds > 0 && restBetweenExercises > 0 && ' · '}
        {restBetweenExercises > 0 && `${restBetweenExercises}s between exercises`}
      </p>

      {/* Coach comments */}
      {exercise.circuitComments && (
        <p className="text-xs text-muted-foreground/80 italic leading-relaxed">
          {exercise.circuitComments}
        </p>
      )}

      {/* Collapsible exercise list */}
      {circuitExercises.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40 active:bg-muted/60 transition-colors"
            onClick={() => setExListOpen(o => !o)}
          >
            <span className="text-muted-foreground">
              {circuitExercises.length} exercise{circuitExercises.length !== 1 ? 's' : ''}
            </span>
            <ChevronDown className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              exListOpen && 'rotate-180'
            )} />
          </button>
          {exListOpen && (
            <div className="border-t divide-y divide-border/30 bg-muted/10">
              {circuitExercises.map((cex, i) => {
                const paramStr = formatCircuitExerciseParams(cex);
                const canShowDetail = !!(cex.exerciseId || cex.exerciseVideoUrl || cex.exerciseDescription);
                return (
                  <div key={cex.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="text-muted-foreground w-4 shrink-0 text-right">{i + 1}.</span>
                    {canShowDetail && onShowDetail ? (
                      <button
                        onClick={() => onShowDetail({ name: cex.exerciseName, videoUrl: cex.exerciseVideoUrl, description: cex.exerciseDescription, exerciseLibraryId: cex.exerciseId })}
                        className="flex-1 min-w-0 text-left hover:underline active:opacity-60 transition-opacity truncate"
                      >
                        {cex.exerciseName}
                      </button>
                    ) : (
                      <span className="flex-1 min-w-0 truncate">{cex.exerciseName}</span>
                    )}
                    {paramStr && (
                      <span className="text-muted-foreground shrink-0">{paramStr}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Rounds</span>
          <span className="font-semibold tabular-nums">
            {completedRoundsList.length} / {rounds}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(completedRoundsList.length / rounds) * 100}%` }}
          />
        </div>
      </div>

      {/* Complete round CTA / all-done state */}
      {allDone ? (
        <div className="flex items-center justify-center gap-2 py-1.5 text-sm text-primary font-medium">
          <Check className="h-4 w-4" />
          All rounds complete
        </div>
      ) : nextRoundIdx !== undefined && (
        <button
          onClick={() => onCompleteRound(exercise.id, nextRoundIdx)}
          className="w-full rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 active:scale-[0.98] text-primary font-semibold text-sm py-3 transition-all"
        >
          Complete Round {nextRoundIdx + 1}
        </button>
      )}

      {/* Undo last round — visible whenever ≥1 round is done */}
      {completedRoundsList.length > 0 && (
        <button
          onClick={() => onCompleteRound(exercise.id, Math.max(...completedRoundsList))}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-0.5"
        >
          Undo last round
        </button>
      )}
    </div>
  );
}

// ── Set logging table ─────────────────────────────────────────────────────────

interface SetTableProps {
  exercise: ExerciseSummary;
  setCount: number;
  loggedValues: Record<string, Record<number, Record<string, string>>>;
  completedSets: Record<string, number[]>;
  onLogValue: (exId: string, setIdx: number, paramName: string, val: string) => void;
  onCompleteSet: (exId: string, setIdx: number) => void;
  onMarkAll: (exId: string) => void;
}

function SetTable({ exercise, setCount, loggedValues, completedSets, onLogValue, onCompleteSet, onMarkAll }: SetTableProps) {
  const columns = getParamColumns(exercise);
  const doneArr = completedSets[exercise.id] ?? [];
  const allDone = doneArr.length >= setCount &&
    Array.from({ length: setCount }, (_, i) => i).every(i => doneArr.includes(i));

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-center py-2 px-2 text-xs text-muted-foreground font-semibold w-8">#</th>
            {columns.map(col => {
              const unit = exercise.plannedParams?.[`${col}_unit`] as string | undefined;
              return (
                <th key={col} className="text-center py-2 px-2 text-xs text-muted-foreground font-semibold">
                  {unit ? `${col} (${unit})` : col}
                </th>
              );
            })}
            {/* Mark-all / unmark-all header button — always tappable */}
            <th className="w-10 py-2 text-center">
              <button
                onClick={() => onMarkAll(exercise.id)}
                title={allDone ? 'Unmark all sets' : 'Mark all sets done'}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all text-xs font-bold active:scale-95',
                  allDone
                    ? 'bg-primary/20 text-primary hover:bg-red-50 hover:text-red-400'
                    : 'border-2 border-dashed border-border hover:border-primary hover:bg-primary/10 text-muted-foreground',
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
                {/* Tick button — tapping a done set un-ticks it (misclick recovery) */}
                <td className="py-1.5 pr-2 text-center">
                  <button
                    onClick={() => onCompleteSet(exercise.id, setIdx)}
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all active:scale-95',
                      isDone
                        ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/80'
                        : 'border-2 border-border hover:border-primary hover:bg-primary/10',
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

// ── Exercise Detail Sheet ─────────────────────────────────────────────────────

interface ExerciseDetailTarget {
  name: string;
  videoUrl?: string;
  description?: string;
  exerciseLibraryId?: string;
}

interface ExerciseDetailSheetProps {
  target: ExerciseDetailTarget | null;
  onClose: () => void;
}

/** Ensure a non-YouTube URL has a protocol so browsers don't treat it as relative. */
function normalizeUrl(url: string): string {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Extract YouTube video ID from any of:
 *  • Full URL:   https://www.youtube.com/watch?v=VIDEO_ID
 *  • Short URL:  https://youtu.be/VIDEO_ID
 *  • Embed URL:  https://youtube.com/embed/VIDEO_ID
 *  • Bare ID:    VIDEO_ID  (exactly 11 alphanumeric / - / _ chars, no slashes)
 */
function getYouTubeVideoId(raw: string): string | null {
  const s = raw.trim();
  // Full / protocol-less URL patterns
  const m = s.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  if (m) return m[1];
  // Bare video ID — exactly 11 chars, no path separators or spaces
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  return null;
}

/** Reads video URL and description from the pre-embedded schedule data, falling back to a
 *  live lookup in the exercise library by ID when the session snapshot didn't carry them
 *  (e.g. exercises added to a manually-created session before/without a snapshot). */
function ExerciseDetailSheet({ target, onClose }: ExerciseDetailSheetProps) {
  const { libraries } = useCustomLibraries();

  const resolvedVideoUrl = target?.videoUrl || (() => {
    if (!target?.exerciseLibraryId) return undefined;
    for (const lib of libraries) {
      const ex = lib.exercises.find(e => e.id === target.exerciseLibraryId);
      if (!ex) continue;
      if (ex.videoUrl) return ex.videoUrl;
      const vidCol = lib.columns.find(c => c.role === 'video');
      if (vidCol) { const v = ex.data[vidCol.id]; if (typeof v === 'string' && v) return v; }
    }
    return undefined;
  })();

  const resolvedDescription = target?.description || (() => {
    if (!target?.exerciseLibraryId) return undefined;
    for (const lib of libraries) {
      const ex = lib.exercises.find(e => e.id === target.exerciseLibraryId);
      if (!ex) continue;
      if (ex.description) return ex.description;
      const descCol = lib.columns.find(c => c.role === 'description');
      if (descCol) { const d = ex.data[descCol.id]; if (typeof d === 'string' && d) return d; }
    }
    return undefined;
  })();

  const rawUrl   = resolvedVideoUrl ?? null;
  const videoId  = rawUrl ? getYouTubeVideoId(rawUrl) : null;
  // Build a guaranteed-valid URL: YouTube canonical form or normalised arbitrary URL
  const safeUrl  = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : (rawUrl ? normalizeUrl(rawUrl) : null);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  const hasContent   = !!(safeUrl || resolvedDescription);

  return (
    <Dialog open={target !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        <div className="px-5 pt-5 pb-7 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-left">{target?.name ?? 'Exercise'}</DialogTitle>
          </DialogHeader>

          {!hasContent && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No details available for this exercise.
            </p>
          )}

          {hasContent && (
            <>
              {/* YouTube thumbnail → opens video in new tab */}
              {thumbnailUrl && safeUrl && (
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl overflow-hidden relative group"
                >
                  <img
                    src={thumbnailUrl}
                    alt={`${target!.name} video`}
                    className="w-full object-cover aspect-video bg-muted"
                    onError={e => {
                      // hqdefault can be a black placeholder for some videos — fall back progressively
                      const img = e.currentTarget;
                      if (img.src.includes('hqdefault')) {
                        img.src = img.src.replace('hqdefault', 'mqdefault');
                      } else if (img.src.includes('mqdefault')) {
                        img.src = img.src.replace('mqdefault', 'sddefault');
                      }
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-active:bg-black/30 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-red-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </a>
              )}

              {/* Non-YouTube URL — styled button link */}
              {safeUrl && !thumbnailUrl && (
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm font-medium text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch video
                </a>
              )}

              {resolvedDescription && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {resolvedDescription}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface LocationState {
  entry: AthleteScheduleEntry;
  sessionIdx: number;
  log?: SessionLog | null;
}

export default function AthleteSessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { connection, getSessionLog, refetchLogs } = useAthleteApp();

  const state = location.state as LocationState | null;

  // ── State ──────────────────────────────────────────────────────────────────

  const [phase, setPhase] = useState<Phase>('overview');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState(90);
  const nextAfterRestRef = useRef<(() => void) | null>(null);

  // loggedValues: exerciseId -> setIdx -> paramName -> actual value string
  const [loggedValues, setLoggedValues] = useState<Record<string, Record<number, Record<string, string>>>>({});
  // completedSets: exerciseId -> number[] of completed set indices
  const [completedSets, setCompletedSets] = useState<Record<string, number[]>>({});
  const [borgSheetOpen, setBorgSheetOpen] = useState(false);
  // ID of the athlete_session_logs row created when "Start Workout" is tapped
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  // Per-exercise set count overrides: exId → actual set count (athlete can add/remove sets)
  const [setCountOverrides, setSetCountOverrides] = useState<Record<string, number>>({});
  // Shown when the athlete tries to finish with incomplete sets
  const [incompleteWarning, setIncompleteWarning] = useState<'section' | 'workout' | null>(null);
  // Shown when the athlete tries to leave the session page after the workout has started
  const [abandonWarning, setAbandonWarning] = useState(false);

  // Exercise detail sheet — tapping a name or ⓘ opens it
  const [detailTarget, setDetailTarget] = useState<ExerciseDetailTarget | null>(null);

  // Settings
  const { chatEnabled } = useAthleteSettings();

  // Chat — exercise/section comment sheet
  const { sendMessage: chatSend } = useChat({
    connectionId: connection?.id ?? null,
    callerRole: 'athlete',
  });
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<{
    exerciseName?: string;
    sectionName?: string;
  } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);

  // ── Exercise swap ──────────────────────────────────────────────────────────
  interface ChainEntry { id: string; toExerciseId: string; toExerciseName: string; direction: 'progression' | 'regression'; level: number; notes: string | null; }
  interface SwapRecord { replacementName: string; originalName: string; direction: 'progression' | 'regression'; level: number; reason: string; }
  const [swappedExercises, setSwappedExercises] = useState<Record<string, SwapRecord>>({});
  const [swapSheetEx, setSwapSheetEx] = useState<ExerciseSummary | null>(null);
  const [swapChain, setSwapChain] = useState<ChainEntry[]>([]);
  const [swapChainLoading, setSwapChainLoading] = useState(false);
  const [swapSelectedEntry, setSwapSelectedEntry] = useState<ChainEntry | null>(null);
  const [swapReason, setSwapReason] = useState('');

  async function openSwapSheet(ex: ExerciseSummary) {
    if (!connection || !ex.exerciseLibraryId) return;
    setSwapSheetEx(ex);
    setSwapChainLoading(true);
    setSwapSelectedEntry(null);
    setSwapReason('');

    const { data: progData } = await supabase
      .from('exercise_progressions')
      .select('id, to_exercise_id, to_exercise_name, direction, level, notes')
      .eq('from_exercise_id', ex.exerciseLibraryId)
      .eq('coach_user_id', connection.coachUserId)
      .order('direction').order('level');

    const entries: ChainEntry[] = (progData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      toExerciseId: r.to_exercise_id as string,
      toExerciseName: (r.to_exercise_name as string) || '',
      direction: r.direction as 'progression' | 'regression',
      level: r.level as number,
      notes: r.notes as string | null,
    }));

    // Back-fill missing names from coach's exercise library
    const needsName = entries.filter(e => !e.toExerciseName);
    if (needsName.length > 0) {
      const { data: libRow } = await supabase
        .from('custom_libraries')
        .select('data')
        .eq('user_id', connection.coachUserId)
        .single();
      if (libRow?.data) {
        type RawLib = { id: string; columns: Array<{ id: string }>; exercises: Array<{ id: string; data: Record<string, unknown> }> };
        const libs = (libRow.data as { libraries?: RawLib[] }).libraries ?? [];
        const nameMap = new Map<string, string>();
        for (const lib of libs) {
          const nameColId = lib.columns?.[0]?.id ?? 'exercise';
          for (const exc of lib.exercises ?? []) {
            const n = (exc.data?.[nameColId] ?? exc.data?.['name'] ?? '') as string;
            if (n) nameMap.set(exc.id, n);
          }
        }
        for (const entry of needsName) {
          const resolved = nameMap.get(entry.toExerciseId);
          if (resolved) {
            entry.toExerciseName = resolved;
            // Back-fill in DB so future loads are instant
            supabase.from('exercise_progressions').update({ to_exercise_name: resolved }).eq('id', entry.id);
          }
        }
      }
    }

    setSwapChain(entries);
    setSwapChainLoading(false);
  }

  function applySwap() {
    if (!swapSheetEx || !swapSelectedEntry) return;
    setSwappedExercises(prev => ({
      ...prev,
      [swapSheetEx.id]: {
        replacementName: swapSelectedEntry.toExerciseName,
        originalName: swapSheetEx.name,
        direction: swapSelectedEntry.direction,
        level: swapSelectedEntry.level,
        reason: swapReason.trim(),
      },
    }));
    setSwapSheetEx(null);
    setSwapSelectedEntry(null);
    setSwapReason('');
  }

  // Workout elapsed timer — counts up from the moment the athlete starts the first section
  const workoutStartTimeRef = useRef<number | null>(null);
  const [workoutElapsed, setWorkoutElapsed] = useState(0);

  // Overview: which section cards are expanded (by section id); all start expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set<string>());
  const expandedInitRef = useRef(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const sections = useMemo<SectionData[]>(() => {
    if (!state) return [];
    const session = state.entry.sessions[state.sessionIdx];
    return groupIntoSections(session?.exercises ?? []);
  }, [state]);

  const currentSection = sections[sectionIdx];

  // ── Workout elapsed timer ──────────────────────────────────────────────────

  useEffect(() => {
    const TICKING: Phase[] = ['sectionIntro', 'active', 'rest'];
    if (!TICKING.includes(phase) || workoutStartTimeRef.current === null) return;
    const id = setInterval(() => {
      setWorkoutElapsed(Math.floor((Date.now() - workoutStartTimeRef.current!) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  function startWorkoutTimer() {
    if (workoutStartTimeRef.current === null) {
      workoutStartTimeRef.current = Date.now();
      setWorkoutElapsed(0);
    }
  }

  // Initialise all section cards as expanded once sections are available
  useEffect(() => {
    if (expandedInitRef.current || sections.length === 0) return;
    expandedInitRef.current = true;
    setExpandedSections(new Set(sections.map(s => s.id)));
  }, [sections]);

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

  /** Returns true when all superset siblings have also completed setIdx.
   *  Non-superset exercises always return true (no siblings to wait for).
   *  Siblings whose own set count is ≤ setIdx are treated as done for this round. */
  function isSupersetRoundComplete(
    exerciseId: string,
    setIdx: number,
    newCS: Record<string, number[]>,
    section: SectionData,
  ): boolean {
    const ex = section.exercises.find(e => e.id === exerciseId);
    if (!ex?.supersetId) return true;
    return section.exercises
      .filter(e => e.supersetId === ex.supersetId && e.id !== exerciseId)
      .every(sib => {
        if (setIdx >= getSetCount(sib)) return true; // sibling has no set at this index
        return (newCS[sib.id] ?? []).includes(setIdx);
      });
  }

  /** Returns true when every exercise in the given section has all its sets ticked,
   *  given a (possibly speculative) completedSets map. */
  function isSectionComplete(
    section: SectionData,
    cs: Record<string, number[]>,
  overrides?: Record<string, number>,
  ): boolean {
    return section.exercises.every(ex => {
      const sc = overrides?.[ex.id] ?? getSetCount(ex);
      const done = cs[ex.id] ?? [];
      return done.length >= sc &&
        Array.from({ length: sc }, (_, i) => i).every(i => done.includes(i));
    });
  }

  function handleCompleteSet(exerciseId: string, setIdx: number) {
    const doneArr = completedSets[exerciseId] ?? [];

    // Allow un-ticking a set (misclick recovery)
    if (doneArr.includes(setIdx)) {
      setCompletedSets(prev => ({ ...prev, [exerciseId]: (prev[exerciseId] ?? []).filter(i => i !== setIdx) }));
      return;
    }

    // Find the exercise in the current section (not exerciseIdx-dependent)
    const ex = currentSection?.exercises.find(e => e.id === exerciseId);
    if (!ex) return;

    autoFillPlanned(ex, setIdx);

    const newDoneArr = [...doneArr, setIdx];
    const newCS = { ...completedSets, [exerciseId]: newDoneArr };
    setCompletedSets(newCS);

    const isLastSection = sectionIdx === sections.length - 1;
    const restSecs = getRestSeconds(ex);

    if (isSectionComplete(currentSection!, newCS)) {
      if (isLastSection) {
        startRest(restSecs, () => { setPhase('done'); setBorgSheetOpen(true); });
      } else {
        startRest(restSecs, () => { setSectionIdx(i => i + 1); setPhase('sectionIntro'); });
      }
    } else {
      // Mid-superset: all siblings haven't completed this set yet — skip rest entirely
      if (!isSupersetRoundComplete(exerciseId, setIdx, newCS, currentSection!)) {
        setPhase('active');
        return;
      }
      // Between rounds (or standalone set) — fire the rest timer
      startRest(restSecs, () => setPhase('active'));
    }
  }

  /** Mark every remaining set for an exercise as done in one tap.
   *  If all sets are already done, un-marks all (toggle). */
  function handleMarkAll(exerciseId: string) {
    const ex = currentSection?.exercises.find(e => e.id === exerciseId);
    if (!ex) return;
    const setCount = setCountOverrides[exerciseId] ?? getSetCount(ex);
    const doneArr = completedSets[exerciseId] ?? [];
    const undone = Array.from({ length: setCount }, (_, i) => i).filter(i => !doneArr.includes(i));

    // Toggle off — all sets already done, so un-mark all
    if (undone.length === 0) {
      setCompletedSets(prev => ({ ...prev, [exerciseId]: [] }));
      return;
    }

    undone.forEach(setIdx => autoFillPlanned(ex, setIdx));

    const newDoneArr = [...doneArr, ...undone];
    const newCS = { ...completedSets, [exerciseId]: newDoneArr };
    setCompletedSets(newCS);

    const isLastSection = sectionIdx === sections.length - 1;

    if (isSectionComplete(currentSection!, newCS)) {
      const restSecs = getRestSeconds(ex);
      if (isLastSection) {
        startRest(restSecs, () => { setPhase('done'); setBorgSheetOpen(true); });
      } else {
        startRest(restSecs, () => { setSectionIdx(i => i + 1); setPhase('sectionIntro'); });
      }
    }
    // If section not yet complete, just update completed sets — no rest needed
  }

  function handleSaved() {
    setBorgSheetOpen(false);
    refetchLogs().catch(console.error);
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

  // Real-time completion check: hook data first (updates after refetch), nav-state snapshot as fallback
  const currentLog = getSessionLog(entry.date, session.id) ?? state.log ?? null;

  // Lookup map for completed-session review (exerciseName → logged data)
  type LoggedEx = {
    exerciseName: string;
    sets?: Array<{ setNumber: number; values: Record<string, string> }>;
    isCircuit?: boolean;
    roundsCompleted?: number;
    totalRounds?: number;
  };
  const logMap = new Map<string, LoggedEx>();
  if (currentLog) {
    (currentLog.setsLogged as LoggedEx[]).forEach(e => logMap.set(e.exerciseName, e));
  }

  // Add / remove a set for a specific exercise
  function handleAddSet(exId: string) {
    const ex = session.exercises.find(e => e.id === exId);
    if (!ex) return;
    setSetCountOverrides(prev => ({ ...prev, [exId]: (prev[exId] ?? getSetCount(ex)) + 1 }));
  }

  function handleRemoveSet(exId: string) {
    const ex = session.exercises.find(e => e.id === exId);
    if (!ex) return;
    const current = setCountOverrides[exId] ?? getSetCount(ex);
    const next = Math.max(1, current - 1);
    const removedIdx = current - 1;
    // Clear logged values and completion flag for the removed set
    setLoggedValues(prev => {
      const copy = { ...(prev[exId] ?? {}) };
      delete copy[removedIdx];
      return { ...prev, [exId]: copy };
    });
    setCompletedSets(prev => ({
      ...prev,
      [exId]: (prev[exId] ?? []).filter(i => i !== removedIdx),
    }));
    setSetCountOverrides(prev => ({ ...prev, [exId]: next }));
  }

  // Build sets_logged payload — includes ALL exercises (with section/superset structure)
  // so the coach can see the full session, including skipped exercises.
  const setsLoggedPayload = session.exercises.map(ex => {
    if (ex.isCircuit) {
      return {
        exerciseName: ex.name,
        isCircuit: true as const,
        roundsCompleted: (completedSets[ex.id] ?? []).length,
        totalRounds: Math.max(1, Number(ex.circuitRounds ?? 3)),
        circuitRestBetweenRounds: ex.circuitRestBetweenRounds,
        circuitRestBetweenExercises: ex.circuitRestBetweenExercises,
        circuitComments: ex.circuitComments,
        circuitExercises: ex.circuitExercises,
        sectionId: ex.sectionId,
        sectionName: ex.sectionName,
        sectionOrder: ex.sectionOrder ?? 0,
        supersetId: ex.supersetId,
        exerciseOrder: ex.order,
      };
    }
    const plannedSetCount = getSetCount(ex);
    const actualSetCount = setCountOverrides[ex.id] ?? plannedSetCount;
    const exCompleted = completedSets[ex.id] ?? [];
    const exLogged = loggedValues[ex.id] ?? {};
    // Convert plannedParams to string values for storage
    const plannedParamsStr: Record<string, string> = {};
    if (ex.plannedParams) {
      for (const [k, v] of Object.entries(ex.plannedParams)) {
        plannedParamsStr[k] = String(v);
      }
    }
    const swap = swappedExercises[ex.id];
    return {
      exerciseName: swap ? swap.replacementName : ex.name,
      methodId: ex.methodKey,
      swappedFrom: swap ? swap.originalName : undefined,
      swapDirection: swap ? swap.direction : undefined,
      swapReason: swap?.reason || undefined,
      plannedSets: plannedSetCount,
      plannedParams: Object.keys(plannedParamsStr).length > 0 ? plannedParamsStr : undefined,
      sectionId: ex.sectionId,
      sectionName: ex.sectionName,
      sectionOrder: ex.sectionOrder ?? 0,
      supersetId: ex.supersetId,
      exerciseOrder: ex.order,
      sets: Array.from({ length: actualSetCount }, (_, setIdx) => ({
        setNumber: setIdx + 1,
        values: exLogged[setIdx] ?? {},
        completed: exCompleted.includes(setIdx),
      })),
    };
  });

  // ── Screen: Overview ───────────────────────────────────────────────────────

  if (phase === 'overview') {
    return (
      <div className="flex flex-col h-screen bg-background max-w-[480px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <button
            onClick={() => {
              if (workoutStartTimeRef.current !== null) {
                setAbandonWarning(true);
              } else {
                navigate(-1);
              }
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-base truncate pr-8">{session.name}</h1>
        </div>

        {sections.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Dumbbell className="h-8 w-8 opacity-30" />
            <p className="text-sm">No exercises assigned yet.</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="px-4 py-4 space-y-3">
                {/* Completed banner */}
                {currentLog && (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-800">Session Completed</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        {currentLog.completedAt ? formatCompletedAt(currentLog.completedAt) : ''}
                        {currentLog.durationSeconds
                          ? ` · ${Math.round(currentLog.durationSeconds / 60)} min`
                          : ''}
                        {currentLog.borgRating !== null ? ` · RPE ${currentLog.borgRating}` : ''}
                        {currentLog.borgRating !== null && currentLog.durationSeconds
                          ? ` · sRPE: ${currentLog.borgRating * Math.round(currentLog.durationSeconds / 60)} AU`
                          : ''}
                      </p>
                      {currentLog.comment && (
                        <p className="text-xs text-muted-foreground mt-1 italic leading-relaxed">
                          "{currentLog.comment}"
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Session notes */}
                {session.notes && (
                  <p className="text-sm text-muted-foreground leading-relaxed pb-1">
                    {session.notes}
                  </p>
                )}

                {/* Collapsible section cards */}
                {sections.map(sec => {
                  const isOpen = expandedSections.has(sec.id);
                  return (
                    <Card key={sec.id} className="overflow-hidden">
                      {/* Section header — tap to toggle */}
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors"
                        onClick={() =>
                          setExpandedSections(prev => {
                            const next = new Set(prev);
                            isOpen ? next.delete(sec.id) : next.add(sec.id);
                            return next;
                          })
                        }
                      >
                        <div className="text-left">
                          <p className="font-semibold text-sm">{sec.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {sec.exercises.length} exercise{sec.exercises.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </button>

                      {/* Exercise list — shown when expanded */}
                      {isOpen && (
                        <div className="border-t divide-y divide-border/50">
                          {sec.exercises.map((ex, i) => (
                            <div key={ex.id}>
                              <div className="flex items-center gap-3 px-4 py-2.5">
                                <span className="text-xs text-muted-foreground w-4 shrink-0 text-right tabular-nums">
                                  {i + 1}
                                </span>
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  {ex.isCircuit && <RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" />}
                                  {ex.isCircuit ? (
                                    <span className="text-sm truncate">{ex.name}</span>
                                  ) : (
                                    <button
                                      onClick={() => setDetailTarget({ name: ex.name, videoUrl: ex.exerciseVideoUrl, description: ex.exerciseDescription, exerciseLibraryId: ex.exerciseLibraryId })}
                                      className="text-sm truncate text-left hover:text-primary active:opacity-60 transition-colors"
                                    >{ex.name}</button>
                                  )}
                                  {ex.eachSide && (
                                    <span className="shrink-0 inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 leading-none">
                                      Perform on each side
                                    </span>
                                  )}
                                  {/* Comment button */}
                                  <button
                                    onClick={() => {
                                      setCommentTarget({ exerciseName: ex.name, sectionName: sec.name });
                                      setCommentText('');
                                    }}
                                    className="shrink-0 text-muted-foreground hover:text-foreground active:opacity-60 transition-colors"
                                    aria-label="Add comment"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {ex.isCircuit ? (
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {ex.circuitRounds ?? 3} rounds
                                  </span>
                                ) : ex.plannedSets ? (
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {ex.plannedSets} sets
                                  </span>
                                ) : null}
                              </div>

                              {/* Circuit sub-exercises — read-only in overview */}
                              {ex.isCircuit && (ex.circuitExercises ?? []).length > 0 && (
                                <div className="bg-muted/20">
                                  {(ex.circuitExercises ?? [])
                                    .slice()
                                    .sort((a, b) => a.order - b.order)
                                    .map((cex, ci) => {
                                      const paramStr = formatCircuitExerciseParams(cex);
                                      const canShowDetail = !!(cex.exerciseId || cex.exerciseVideoUrl || cex.exerciseDescription);
                                      return (
                                        <div key={cex.id} className="flex items-center gap-2 pl-10 pr-4 py-2 text-xs border-t border-border/20">
                                          <span className="text-muted-foreground w-4 shrink-0 text-right">{ci + 1}.</span>
                                          {canShowDetail ? (
                                            <button
                                              onClick={() => setDetailTarget({ name: cex.exerciseName, videoUrl: cex.exerciseVideoUrl, description: cex.exerciseDescription, exerciseLibraryId: cex.exerciseId })}
                                              className="flex-1 min-w-0 text-left text-muted-foreground hover:text-foreground hover:underline active:opacity-60 transition-colors truncate"
                                            >
                                              {cex.exerciseName}
                                            </button>
                                          ) : (
                                            <span className="flex-1 min-w-0 truncate text-muted-foreground">{cex.exerciseName}</span>
                                          )}
                                          {paramStr && (
                                            <span className="text-muted-foreground shrink-0">{paramStr}</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              )}

                              {/* Logged results — shown in completed session overview */}
                              {currentLog && (() => {
                                const logged = logMap.get(ex.name);
                                if (!logged) return null;
                                if (logged.isCircuit) {
                                  return (
                                    <p className="px-4 pb-2.5 text-xs font-medium text-green-700">
                                      {logged.roundsCompleted} / {logged.totalRounds} rounds completed
                                    </p>
                                  );
                                }
                                const sets = logged.sets ?? [];
                                if (sets.length === 0) return null;
                                const paramNames = Array.from(new Set(sets.flatMap(s => Object.keys(s.values))));
                                if (paramNames.length === 0) return null;
                                return (
                                  <div className="px-4 pb-3 overflow-x-auto">
                                    <table className="text-xs w-full">
                                      <thead>
                                        <tr className="text-muted-foreground">
                                          <th className="text-left font-normal pb-1 pr-4 w-5">#</th>
                                          {paramNames.map(p => {
                                            const unit = ex.plannedParams?.[`${p}_unit`] as string | undefined;
                                            return (
                                              <th key={p} className="text-left font-normal pb-1 pr-4">
                                                {unit ? `${p} (${unit})` : p}
                                              </th>
                                            );
                                          })}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sets.map(s => (
                                          <tr key={s.setNumber} className="border-t border-border/20">
                                            <td className="pr-4 py-1 text-muted-foreground">{s.setNumber}</td>
                                            {paramNames.map(p => (
                                              <td key={p} className="pr-4 py-1 font-medium">{s.values[p] ?? '—'}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Start CTA */}
            <div className="px-4 py-4 border-t bg-background shrink-0">
              {currentLog ? (
                <Button className="w-full" size="lg" variant="outline" onClick={() => navigate(-1)}>
                  Close
                </Button>
              ) : (
                <Button className="w-full" size="lg" onClick={async () => {
                  setPhase('sectionIntro');
                  if (connection) {
                    const { data } = await supabase
                      .from('athlete_session_logs')
                      .insert({
                        athlete_connection_id: connection.id,
                        date: entry.date,
                        session_id: session.id,
                        session_name: session.name,
                        started_at: new Date().toISOString(),
                      })
                      .select('id')
                      .single();
                    if (data) setSessionLogId(data.id);
                  }
                }}>
                  Start Workout
                </Button>
              )}
            </div>
          </>
        )}

        {/* Abandon workout confirmation */}
        <AlertDialog open={abandonWarning} onOpenChange={o => { if (!o) setAbandonWarning(false); }}>
          <AlertDialogContent className="sm:max-w-[360px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
            <AlertDialogHeader>
              <AlertDialogTitle>Abandon workout?</AlertDialogTitle>
              <AlertDialogDescription>
                Your progress will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep going</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  setAbandonWarning(false);
                  if (sessionLogId) {
                    await supabase
                      .from('athlete_session_logs')
                      .delete()
                      .eq('id', sessionLogId);
                  }
                  navigate(-1);
                }}
              >
                Abandon
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Exercise detail sheet — available in overview so circuit exercises can be tapped */}
        <ExerciseDetailSheet
          target={detailTarget}
          onClose={() => setDetailTarget(null)}
        />

        {/* Exercise/Section comment dialog */}
        <Dialog open={!!commentTarget} onOpenChange={(o) => { if (!o) { setCommentTarget(null); setCommentText(''); } }}>
          <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base">Add Comment</DialogTitle>
              {commentTarget && (
                <DialogDescription className="text-xs">
                  📎 {[commentTarget.exerciseName, commentTarget.sectionName, session.name, entry.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined].filter(Boolean).join(' · ')}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="flex items-end gap-2 mt-1">
              <Textarea
                autoFocus
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write your comment…"
                rows={3}
                className="flex-1 resize-none text-sm"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={!commentText.trim() || commentSending}
                onClick={async () => {
                  if (!commentText.trim() || commentSending || !commentTarget) return;
                  setCommentSending(true);
                  try {
                    await chatSend(commentText, {
                      messageType: 'exercise_comment',
                      reference: {
                        exerciseName: commentTarget.exerciseName,
                        sectionName: commentTarget.sectionName,
                        sessionName: session.name,
                        date: entry.date,
                      },
                    });
                    setCommentTarget(null);
                    setCommentText('');
                  } catch {
                    // silent
                  } finally {
                    setCommentSending(false);
                  }
                }}
              >
                {commentSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Screen: Section intro ──────────────────────────────────────────────────

  if (phase === 'sectionIntro') {
    const introSection = sections[sectionIdx];
    const isFirst = sectionIdx === 0;
    const totalSections = sections.length;

    return (
      <div className="flex flex-col h-screen bg-background max-w-[480px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <button
            onClick={() => {
              if (isFirst) {
                setPhase('overview');
              } else {
                setSectionIdx(i => i - 1);
                setPhase('active');
              }
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-base truncate pr-8">{session.name}</h1>
        </div>

        {/* Section intro body */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          {totalSections > 1 && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Section {sectionIdx + 1} of {totalSections}
            </p>
          )}
          <h2 className="text-3xl font-bold text-center">{introSection?.name}</h2>
          {introSection && (
            <p className="text-sm text-muted-foreground">
              {introSection.exercises.length} exercise{introSection.exercises.length !== 1 ? 's' : ''}
            </p>
          )}
          {introSection?.notes && (
            <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-xs">
              {introSection.notes}
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="px-6 py-6 shrink-0">
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              startWorkoutTimer();
              setPhase('active');
            }}
          >
            Start Section
          </Button>
        </div>
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

  // ── Screen: Active section — all exercises visible, scrollable ───────────────

  if (phase === 'active' || phase === 'done') {
    const totalSections = sections.length;
    const sectionExercises = currentSection?.exercises ?? [];
    const doneCounts = sectionExercises.map(ex => (completedSets[ex.id] ?? []).length);
    const totalSetsDone = doneCounts.reduce((a, b) => a + b, 0);
    const totalSetsPlanned = sectionExercises.reduce((a, ex) => a + (setCountOverrides[ex.id] ?? getSetCount(ex)), 0);
    const sectionComplete = isSectionComplete(currentSection!, completedSets, setCountOverrides);
    const isLastSection = sectionIdx === sections.length - 1;

    return (
      <div className="flex flex-col h-screen bg-background max-w-[480px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <button
            onClick={() => setPhase('sectionIntro')}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-xs text-muted-foreground truncate">{session.name}</p>
            <p className="text-sm font-semibold truncate">{currentSection?.name}</p>
          </div>
          {/* Elapsed workout timer */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums shrink-0 w-10 justify-end">
            <Timer className="h-3 w-3 shrink-0" />
            <span>{formatTime(workoutElapsed)}</span>
          </div>
        </div>

        {/* Section progress bar */}
        <div className="px-4 pt-3 pb-2 shrink-0">
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
          <p className="text-xs text-center text-muted-foreground">
            {totalSetsDone} / {totalSetsPlanned} sets done
          </p>
        </div>

        {/* All exercises in this section — grouped by superset */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-3 space-y-4">
            {sectionExercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Dumbbell className="h-8 w-8 opacity-30" />
                <p className="text-sm">No exercises in this section.</p>
              </div>
            ) : (() => {
              // ── Build superset groups ───────────────────────────────────────
              const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
              const supersetLabel = new Map<string, string>();
              let labelCount = 0;
              for (const ex of sectionExercises) {
                if (ex.supersetId && !supersetLabel.has(ex.supersetId)) {
                  supersetLabel.set(ex.supersetId, LABELS[labelCount++ % 26]);
                }
              }

              type Group =
                | { kind: 'single'; ex: ExerciseSummary; n: number }
                | { kind: 'superset'; ssId: string; label: string; members: Array<{ ex: ExerciseSummary; n: number }> };

              const groups: Group[] = [];
              const seen = new Set<string>();
              let counter = 1;

              for (const ex of sectionExercises) {
                if (seen.has(ex.id)) continue;
                if (ex.supersetId && !seen.has(ex.supersetId + '__group')) {
                  seen.add(ex.supersetId + '__group');
                  const members = sectionExercises
                    .filter(e => e.supersetId === ex.supersetId)
                    .map(e => { seen.add(e.id); return { ex: e, n: counter++ }; });
                  groups.push({ kind: 'superset', ssId: ex.supersetId, label: supersetLabel.get(ex.supersetId)!, members });
                } else if (!ex.supersetId) {
                  seen.add(ex.id);
                  groups.push({ kind: 'single', ex, n: counter++ });
                }
              }

              // ── Render groups ───────────────────────────────────────────────
              const renderExerciseCard = (ex: ExerciseSummary, displayN: number, supersetLabel?: string) => {
                const exDone = completedSets[ex.id] ?? [];
                const exSetCount = setCountOverrides[ex.id] ?? getSetCount(ex);
                const exComplete = exDone.length >= exSetCount &&
                  Array.from({ length: exSetCount }, (_, i) => i).every(i => exDone.includes(i));

                return (
                  <div key={ex.id} className={cn('p-4 space-y-3 transition-colors', supersetLabel ? '' : 'rounded-xl border', exComplete ? 'bg-primary/5' : '')}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold',
                        exComplete ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                      )}>
                        {exComplete ? <Check className="h-4 w-4" /> : (supersetLabel ? supersetLabel : displayN)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Exercise name row */}
                        <div className="flex items-center gap-1.5">
                          {ex.isCircuit && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          {ex.isCircuit ? (
                            <h3 className={cn('font-semibold text-base leading-snug', exComplete && 'text-muted-foreground')}>
                              {swappedExercises[ex.id]?.replacementName ?? ex.name}
                            </h3>
                          ) : (
                            <button
                              onClick={() => setDetailTarget({ name: ex.name, videoUrl: ex.exerciseVideoUrl, description: ex.exerciseDescription, exerciseLibraryId: ex.exerciseLibraryId })}
                              className={cn('font-semibold text-base leading-snug text-left hover:text-primary active:opacity-60 transition-colors', exComplete && 'text-muted-foreground')}
                            >
                              {swappedExercises[ex.id]?.replacementName ?? ex.name}
                            </button>
                          )}
                          {connection?.id && !ex.isCircuit && (
                            <button
                              onClick={() => setHistoryTarget(ex.name)}
                              className="shrink-0 text-muted-foreground hover:text-foreground active:opacity-60 transition-colors ml-0.5"
                              aria-label="Exercise history"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          )}
                          {chatEnabled && (
                            <button
                              onClick={() => setCommentTarget({ exerciseName: swappedExercises[ex.id]?.replacementName ?? ex.name, sectionName: currentSection?.name })}
                              className="shrink-0 text-muted-foreground hover:text-foreground active:opacity-60 transition-colors ml-0.5"
                              aria-label="Comment on exercise"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {/* Swap badge */}
                        {swappedExercises[ex.id] && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 leading-none">
                              {swappedExercises[ex.id].direction === 'regression' ? '↓ Regression' : '↑ Progression'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              instead of {swappedExercises[ex.id].originalName}
                            </span>
                            <button
                              onClick={() => setSwappedExercises(prev => { const n = { ...prev }; delete n[ex.id]; return n; })}
                              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                            >
                              Undo
                            </button>
                          </div>
                        )}
                        {ex.eachSide && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 mt-1 w-fit">
                            Perform on each side
                          </span>
                        )}
                        {ex.notes && <p className="text-xs text-muted-foreground mt-0.5">{ex.notes}</p>}
                        {/* Adjust button — only for exercises with a library ID and no active swap */}
                        {!ex.isCircuit && ex.exerciseLibraryId && !swappedExercises[ex.id] && (
                          <button
                            onClick={() => openSwapSheet(ex)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 active:opacity-60"
                          >
                            <ArrowUpDown className="h-3 w-3" />
                            Adjust exercise
                          </button>
                        )}
                      </div>
                    </div>
                    {ex.isCircuit ? (
                      <CircuitCard
                        exercise={ex}
                        completedSets={completedSets}
                        onCompleteRound={handleCompleteSet}
                        onShowDetail={setDetailTarget}
                      />
                    ) : (
                      <>
                        <SetTable
                          exercise={ex}
                          setCount={exSetCount}
                          loggedValues={loggedValues}
                          completedSets={completedSets}
                          onLogValue={handleLogValue}
                          onCompleteSet={handleCompleteSet}
                          onMarkAll={handleMarkAll}
                        />
                        {/* Add / remove set buttons */}
                        <div className="flex items-center justify-between px-1 pt-1">
                          <button
                            onClick={() => handleRemoveSet(ex.id)}
                            disabled={exSetCount <= 1}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:opacity-60"
                          >
                            <Minus className="h-3 w-3" />
                            Remove set
                          </button>
                          <button
                            onClick={() => handleAddSet(ex.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors active:opacity-60"
                          >
                            <Plus className="h-3 w-3" />
                            Add set
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              };

              return groups.map(group => {
                if (group.kind === 'single') {
                  return (
                    <div key={group.ex.id} className={cn(
                      'rounded-xl border transition-colors',
                      (completedSets[group.ex.id] ?? []).length >= (setCountOverrides[group.ex.id] ?? getSetCount(group.ex)) ? 'border-primary/20' : 'border-border',
                    )}>
                      {renderExerciseCard(group.ex, group.n)}
                    </div>
                  );
                }
                // Superset group — connected card with dividers
                const allDone = group.members.every(({ ex }) => {
                  const sc = setCountOverrides[ex.id] ?? getSetCount(ex);
                  const done = completedSets[ex.id] ?? [];
                  return done.length >= sc && Array.from({ length: sc }, (_, i) => i).every(i => done.includes(i));
                });
                return (
                  <div key={group.ssId} className={cn(
                    'rounded-xl border overflow-hidden transition-colors',
                    allDone ? 'border-primary/20' : 'border-primary/40',
                  )}>
                    {/* Superset header badge */}
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-primary/20">
                      <span className="text-xs font-bold text-primary tracking-wider">SUPERSET {group.label}</span>
                    </div>
                    {group.members.map(({ ex, n }, mi) => (
                      <div key={ex.id}>
                        {renderExerciseCard(ex, n, `${group.label}${mi + 1}`)}
                        {mi < group.members.length - 1 && (
                          <div className="mx-4 border-t border-dashed border-primary/20" />
                        )}
                      </div>
                    ))}
                  </div>
                );
              });
            })()}
            <div className="h-2" />
          </div>
        </ScrollArea>

        {/* Bottom action bar — shows finish action; warns if sets are missing */}
        <div className="px-4 py-4 border-t bg-background shrink-0">
          {isLastSection ? (
            <Button
              className="w-full"
              size="lg"
              variant={sectionComplete ? 'default' : 'outline'}
              onClick={() => {
                if (!sectionComplete) { setIncompleteWarning('workout'); return; }
                setPhase('done'); setBorgSheetOpen(true);
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Finish Workout
            </Button>
          ) : (
            <Button
              className="w-full"
              size="lg"
              variant={sectionComplete ? 'default' : 'outline'}
              onClick={() => {
                if (!sectionComplete) { setIncompleteWarning('section'); return; }
                setSectionIdx(i => i + 1);
                setPhase('sectionIntro');
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Finish Section
            </Button>
          )}
        </div>

        {/* Exercise history sheet */}
        {connection?.id && historyTarget && (
          <ExerciseHistorySheet
            open={!!historyTarget}
            onClose={() => setHistoryTarget(null)}
            exerciseName={historyTarget}
            athleteConnectionId={connection.id}
          />
        )}

        {/* Borg completion sheet */}
        {connection && (
          <CompletionSheet
            open={borgSheetOpen}
            onClose={() => setBorgSheetOpen(false)}
            connectionId={connection.id}
            date={entry.date}
            sessionId={session.id}
            sessionName={session.name}
            durationSeconds={workoutElapsed}
            setsLogged={setsLoggedPayload}
            onSaved={handleSaved}
            sessionLogId={sessionLogId}
          />
        )}

        {/* Incomplete sets warning */}
        <AlertDialog
          open={incompleteWarning !== null}
          onOpenChange={o => { if (!o) setIncompleteWarning(null); }}
        >
          <AlertDialogContent className="sm:max-w-[360px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {incompleteWarning === 'workout' ? 'Finish workout?' : 'Finish section?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Not all sets are completed yet. Finish anyway?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go back</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const warn = incompleteWarning;
                  setIncompleteWarning(null);
                  if (warn === 'workout') {
                    setPhase('done'); setBorgSheetOpen(true);
                  } else {
                    setSectionIdx(i => i + 1);
                    setPhase('sectionIntro');
                  }
                }}
              >
                Finish anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Exercise detail sheet */}
        <ExerciseDetailSheet
          target={detailTarget}
          onClose={() => setDetailTarget(null)}
        />

        {/* Exercise/Section comment dialog */}
        <Dialog open={!!commentTarget} onOpenChange={(o) => { if (!o) { setCommentTarget(null); setCommentText(''); } }}>
          <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base">Add Comment</DialogTitle>
              {commentTarget && (
                <DialogDescription className="text-xs">
                  📎 {[commentTarget.exerciseName, commentTarget.sectionName, session.name, entry.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined].filter(Boolean).join(' · ')}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="flex items-end gap-2 mt-1">
              <Textarea
                autoFocus
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write your comment…"
                rows={3}
                className="flex-1 resize-none text-sm"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={!commentText.trim() || commentSending}
                onClick={async () => {
                  if (!commentText.trim() || commentSending || !commentTarget) return;
                  setCommentSending(true);
                  try {
                    await chatSend(commentText, {
                      messageType: 'exercise_comment',
                      reference: {
                        exerciseName: commentTarget.exerciseName,
                        sectionName: commentTarget.sectionName,
                        sessionName: session.name,
                        date: entry.date,
                      },
                    });
                    setCommentTarget(null);
                    setCommentText('');
                  } catch {
                    // silent
                  } finally {
                    setCommentSending(false);
                  }
                }}
              >
                {commentSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Swap dialog (centered) ────────────────────────────────────────── */}
        <Dialog open={!!swapSheetEx} onOpenChange={o => { if (!o) { setSwapSheetEx(null); setSwapSelectedEntry(null); setSwapReason(''); } }}>
          <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 rounded-2xl max-h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
              <DialogTitle className="text-base text-left">Adjust exercise</DialogTitle>
              <p className="text-xs text-muted-foreground text-left mt-0.5">
                Replace <span className="font-medium">{swapSheetEx?.name}</span> for this session only.
              </p>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5">
              {swapChainLoading ? (
                <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
              ) : swapChain.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No progressions or regressions defined for this exercise.
                </p>
              ) : (() => {
                const chainProgs = swapChain.filter(e => e.direction === 'progression').sort((a, b) => b.level - a.level);
                const chainRegs = swapChain.filter(e => e.direction === 'regression').sort((a, b) => a.level - b.level);
                const renderEntry = (entry: ChainEntry) => {
                  const isSelected = swapSelectedEntry?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSwapSelectedEntry(isSelected ? null : entry)}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-primary/10 border border-primary/40'
                          : 'bg-muted/40 hover:bg-muted/70 active:bg-muted border border-transparent'
                      )}
                    >
                      {entry.direction === 'progression'
                        ? <TrendingUp className="h-4 w-4 text-orange-500 shrink-0" />
                        : <TrendingDown className="h-4 w-4 text-blue-500 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{entry.toExerciseName || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.direction === 'progression' ? 'Progression' : 'Regression'} {entry.level}
                          {entry.notes ? ` · ${entry.notes}` : ''}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                };
                return (
                  <>
                    {chainProgs.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Harder</p>
                        {chainProgs.map(renderEntry)}
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-primary/10 border border-primary/30">
                      <div className="h-4 w-4 rounded-full bg-primary shrink-0" />
                      <p className="text-sm font-semibold flex-1">{swapSheetEx?.name}</p>
                      <span className="text-xs text-muted-foreground">current</span>
                    </div>
                    {chainRegs.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Easier</p>
                        {chainRegs.map(renderEntry)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {swapSelectedEntry && (
              <div className="px-5 pb-6 pt-3 border-t space-y-3 shrink-0">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Why are you adapting? <span className="font-normal">(optional)</span></label>
                  <Textarea
                    value={swapReason}
                    onChange={e => setSwapReason(e.target.value)}
                    placeholder="e.g. knee pain, no equipment available…"
                    className="resize-none text-sm min-h-[60px]"
                  />
                </div>
                <Button className="w-full" onClick={applySwap}>
                  Swap for {swapSelectedEntry.toExerciseName || '—'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return null;
}
