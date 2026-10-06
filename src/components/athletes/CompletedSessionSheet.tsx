import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Clock, Activity, Flame, RefreshCw, Reply, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getBorgLabel, isBorgLevel } from '@/utils/intensityScale';
import { fetchCoachRemark, parseExerciseComments, remarksAsText, removeCoachExerciseRemark, saveCoachRemark, sendCommentReply, type ExerciseComment } from '@/utils/sessionComments';

// ── Exported types ─────────────────────────────────────────────────────────────

export interface SetEntry {
  setNumber: number;
  values: Record<string, string>;
  /** true = athlete ticked this set; false/undefined = planned but not done */
  completed?: boolean;
}

export interface RegularExerciseLog {
  exerciseName: string;
  isCircuit?: false;
  plannedSets?: number;
  /** Coach-prescribed values per param — used to show crossed-out planned values on removed/skipped rows */
  plannedParams?: Record<string, string>;
  /** Set when athlete swapped this exercise in-session */
  swappedFrom?: string;
  swapDirection?: 'progression' | 'regression';
  swapReason?: string;
  // Session structure metadata (new logs only)
  sectionId?: string;
  sectionName?: string;
  sectionOrder?: number;
  supersetId?: string;
  exerciseOrder?: number;
  sets: SetEntry[];
}

export interface CircuitExerciseItemLog {
  exerciseName: string;
  reps: string;
  time?: string;
  distance?: string;
  enabledParams?: string[];
}

export interface CircuitExerciseLog {
  exerciseName: string;
  isCircuit: true;
  roundsCompleted: number;
  totalRounds: number;
  circuitRestBetweenRounds?: string;
  circuitRestBetweenExercises?: string;
  circuitComments?: string;
  circuitExercises?: CircuitExerciseItemLog[];
  // Session structure metadata (new logs only)
  sectionId?: string;
  sectionName?: string;
  sectionOrder?: number;
  supersetId?: string;
  exerciseOrder?: number;
}

export type SetLogEntry = RegularExerciseLog | CircuitExerciseLog;

export interface CoachSessionLog {
  id: string;
  date: string;
  session_id: string | null;
  session_name: string | null;
  borg_rating: number | null;
  duration_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  /** Set while an unfinished workout is paused (pause / resume) */
  paused_at?: string | null;
  comment: string | null;
  sets_logged: SetLogEntry[] | null;
  /** Athlete comments on single exercises (needs the session-comments migration) */
  exercise_comments?: unknown;
  /** 'coach' when the session was logged with the coach app */
  started_by?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function computeSRPE(log: CoachSessionLog): number | null {
  if (log.borg_rating === null || !log.duration_seconds) return null;
  return log.borg_rating * Math.round(log.duration_seconds / 60);
}

function borgLabel(rating: number): string {
  const lvl = String(rating);
  return isBorgLevel(lvl) ? `${rating} – ${getBorgLabel(lvl)}` : String(rating);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, valueClass = '',
}: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3 px-3">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-sm font-semibold leading-snug ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ExerciseLogCard({ entry }: { entry: SetLogEntry }) {
  if (entry.isCircuit) {
    const skipped = entry.roundsCompleted === 0;
    const restRounds = entry.circuitRestBetweenRounds ? Number(entry.circuitRestBetweenRounds) : null;
    const restExercises = entry.circuitRestBetweenExercises ? Number(entry.circuitRestBetweenExercises) : null;
    const exercises = entry.circuitExercises ?? [];

    return (
      <div className="rounded-md border overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 bg-muted/30 border-b flex items-center gap-2">
          <Badge variant="outline" className="text-xs shrink-0">Circuit</Badge>
          <span className={`text-sm font-medium flex-1 min-w-0 ${skipped ? 'text-muted-foreground' : ''}`}>{entry.exerciseName}</span>
          {skipped && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
              Not done
            </span>
          )}
        </div>

        {/* Rounds completed — skipped circuits in red, like skipped sets */}
        {skipped ? (
          <div className="px-3 py-1.5 text-sm border-b bg-red-50/60 dark:bg-red-950/20 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground/70">
              <span className="line-through">0 / {entry.totalRounds} rounds</span>
              <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-500 dark:text-red-400 leading-none">
                Skipped
              </span>
            </span>
            <span className="text-xs text-red-400 dark:text-red-500">Skipped</span>
          </div>
        ) : (
          <div className="px-3 py-2 text-sm border-b text-muted-foreground">
            {entry.roundsCompleted} / {entry.totalRounds} rounds completed
          </div>
        )}

        {/* Circuit config */}
        {(restRounds !== null || restExercises !== null || entry.circuitComments) && (
          <div className="px-3 py-2 border-b space-y-1">
            {restRounds !== null && restRounds > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 shrink-0" />
                <span>Rest between rounds: <span className="font-medium text-foreground">{formatDuration(restRounds)}</span></span>
              </div>
            )}
            {restExercises !== null && restExercises > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 shrink-0" />
                <span>Rest between exercises: <span className="font-medium text-foreground">{formatDuration(restExercises)}</span></span>
              </div>
            )}
            {entry.circuitComments && (
              <p className="text-xs text-muted-foreground italic">{entry.circuitComments}</p>
            )}
          </div>
        )}

        {/* Exercise list */}
        {exercises.length > 0 && (
          <div className="divide-y divide-border/40">
            {exercises.map((cex, i) => {
              const params: string[] = [];
              // Circuits store the toggled params in lowercase ('reps' | 'time' | 'distance'); checking
              // for 'Reps' / 'Distance' matched nothing, so every exercise fell back to its reps.
              // Default ['reps'], like the circuit builder and the phone apps.
              const enabled = (cex.enabledParams ?? ['reps']).map(p => p.toLowerCase());
              if (enabled.includes('reps') && cex.reps) params.push(`${cex.reps} reps`);
              if (enabled.includes('time') && cex.time) params.push(`${cex.time}s`);
              if (enabled.includes('distance') && cex.distance) params.push(`${cex.distance}m`);
              // fallback: show reps if no enabledParams
              if (params.length === 0 && cex.reps) params.push(`${cex.reps} reps`);
              return (
                <div key={i} className="px-3 py-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{cex.exerciseName}</span>
                  {params.length > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">{params.join(' · ')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Collect all param column names across logged sets only
  // (plannedParams may have per-set keys like Reps_set1 — don't use for column headers)
  const paramNames = Array.from(
    new Set(entry.sets.flatMap((s) => Object.keys(s.values)))
  );

  // Determine skipped sets: sets where completed is explicitly false,
  // or (for old logs) where values is empty and completed is undefined.
  const hasCompletedFlag = entry.sets.some(s => s.completed !== undefined);
  const isSetSkipped = (s: SetEntry) =>
    hasCompletedFlag ? s.completed === false : Object.keys(s.values).length === 0;
  const isSetAdded = (s: SetEntry) =>
    entry.plannedSets !== undefined && s.setNumber > entry.plannedSets;

  const allSetsSkipped = entry.sets.length > 0 && entry.sets.every(s => isSetSkipped(s));
  const noSetsAtAll = entry.sets.length === 0;

  return (
    <div className="rounded-md border overflow-hidden">
      {/* Exercise header */}
      <div className="px-3 py-2 bg-muted/30 border-b space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-medium ${allSetsSkipped || noSetsAtAll ? 'text-muted-foreground' : ''}`}>
            {entry.exerciseName}
          </span>
          {(allSetsSkipped || noSetsAtAll) && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
              Not done
            </span>
          )}
        </div>
        {entry.swappedFrom && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 leading-none">
              {entry.swapDirection === 'regression' ? '↓ Regression' : '↑ Progression'}
            </span>
            <span className="text-xs text-muted-foreground">
              Swapped from <span className="font-medium text-foreground">{entry.swappedFrom}</span>
            </span>
            {entry.swapReason && (
              <span className="text-xs text-muted-foreground italic">· "{entry.swapReason}"</span>
            )}
          </div>
        )}
      </div>

      {noSetsAtAll ? (
        <p className="px-3 py-2 text-xs text-muted-foreground italic">No sets logged.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left px-3 py-1.5 font-medium w-12">Set</th>
                {paramNames.map((p) => {
                  const unit = entry.plannedParams?.[`${p}_unit`];
                  return (
                    <th key={p} className="text-right px-3 py-1.5 font-medium">
                      {unit ? `${p} (${unit})` : p}
                    </th>
                  );
                })}
                {/* When no param values were logged, show a Status column */}
                {paramNames.length === 0 && (
                  <th className="text-right px-3 py-1.5 font-medium">Status</th>
                )}
              </tr>
            </thead>
            <tbody>
              {entry.sets.map((set) => {
                const skipped = isSetSkipped(set);
                const added = isSetAdded(set);
                return (
                  <tr
                    key={set.setNumber}
                    className={
                      added
                        ? 'border-b last:border-0 bg-amber-50 dark:bg-amber-950/40'
                        : skipped
                        ? 'border-b last:border-0 bg-red-50/60 dark:bg-red-950/20'
                        : 'border-b last:border-0'
                    }
                  >
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`tabular-nums font-medium ${skipped ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'}`}>
                          {set.setNumber}
                        </span>
                        {added && !skipped && (
                          <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 leading-none shrink-0">
                            Added
                          </span>
                        )}
                        {skipped && (
                          <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-500 dark:text-red-400 leading-none shrink-0">
                            Skipped
                          </span>
                        )}
                      </div>
                    </td>
                    {paramNames.map((p) => (
                      <td
                        key={p}
                        className={`text-right px-3 py-1.5 tabular-nums ${skipped ? 'text-red-400 dark:text-red-500 line-through' : ''}`}
                      >
                        {set.values[p] || '—'}
                      </td>
                    ))}
                    {/* Status column when no params were logged */}
                    {paramNames.length === 0 && (
                      <td className="text-right px-3 py-1.5">
                        {skipped
                          ? <span className="text-red-400 dark:text-red-500">Skipped</span>
                          : <span className="text-green-600 dark:text-green-400">✓ Done</span>
                        }
                      </td>
                    )}
                  </tr>
                );
              })}
              {/* Ghost rows for sets removed by athlete (plannedSets > actual sets logged) */}
              {entry.plannedSets !== undefined && entry.plannedSets > entry.sets.filter(s => !isSetAdded(s)).length &&
                Array.from(
                  { length: entry.plannedSets - entry.sets.filter(s => !isSetAdded(s)).length },
                  (_, i) => {
                    const setNumber = entry.sets.filter(s => !isSetAdded(s)).length + i + 1;
                    return (
                      <tr key={`removed-${setNumber}`} className="border-b last:border-0 bg-red-50/60 dark:bg-red-950/20">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="tabular-nums font-medium text-muted-foreground/50 line-through">
                              {setNumber}
                            </span>
                            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-500 dark:text-red-400 leading-none shrink-0">
                              Removed
                            </span>
                          </div>
                        </td>
                        {paramNames.map((p) => {
                          // Try per-set key first (e.g. Reps_set3), then global key (e.g. Reps)
                          const val = entry.plannedParams?.[`${p}_set${setNumber}`]
                            ?? entry.plannedParams?.[p]
                            ?? '—';
                          return (
                            <td key={p} className="text-right px-3 py-1.5 tabular-nums text-red-400 dark:text-red-500 line-through">
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }
                )
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Session structure renderer ─────────────────────────────────────────────────

interface SectionGroup {
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  entries: SetLogEntry[];
}

interface SupersetGroup {
  kind: 'superset';
  supersetId: string;
  label: string;
  members: SetLogEntry[];
}

interface SingleGroup {
  kind: 'single';
  entry: SetLogEntry;
}

type ExerciseGroup = SupersetGroup | SingleGroup;

function groupBySection(entries: SetLogEntry[]): SectionGroup[] {
  const map = new Map<string, SectionGroup>();
  for (const entry of entries) {
    const key = entry.sectionId ?? '__none__';
    if (!map.has(key)) {
      map.set(key, {
        sectionId: key,
        sectionName: entry.sectionName ?? 'Workout',
        sectionOrder: entry.sectionOrder ?? 0,
        entries: [],
      });
    }
    map.get(key)!.entries.push(entry);
  }
  return Array.from(map.values()).sort((a, b) => a.sectionOrder - b.sectionOrder);
}

function groupBySupersetWithinSection(entries: SetLogEntry[]): ExerciseGroup[] {
  const sorted = [...entries].sort((a, b) => (a.exerciseOrder ?? 0) - (b.exerciseOrder ?? 0));
  const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const supersetLabel = new Map<string, string>();
  let labelCount = 0;
  for (const entry of sorted) {
    if (entry.supersetId && !supersetLabel.has(entry.supersetId)) {
      supersetLabel.set(entry.supersetId, LABELS[labelCount++ % 26]);
    }
  }

  const groups: ExerciseGroup[] = [];
  const seenSuperset = new Set<string>();
  for (const entry of sorted) {
    if (entry.supersetId) {
      if (seenSuperset.has(entry.supersetId)) continue;
      seenSuperset.add(entry.supersetId);
      const members = sorted.filter(e => e.supersetId === entry.supersetId);
      groups.push({ kind: 'superset', supersetId: entry.supersetId, label: supersetLabel.get(entry.supersetId)!, members });
    } else {
      groups.push({ kind: 'single', entry });
    }
  }
  return groups;
}

function SessionExercises({ entries, renderAfter }: { entries: SetLogEntry[]; renderAfter?: (entry: SetLogEntry) => React.ReactNode }) {
  const hasStructure = entries.some(e => e.sectionId);
  const sections = groupBySection(entries);
  const showSectionHeaders = hasStructure && (sections.length > 1 || (sections[0]?.sectionName && sections[0].sectionName !== 'Workout'));

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const groups = groupBySupersetWithinSection(section.entries);
        return (
          <div key={section.sectionId} className="space-y-2">
            {showSectionHeaders && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.sectionName}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div className="space-y-2">
              {groups.map((group, gi) => {
                if (group.kind === 'single') {
                  return (
                    <div key={gi} data-exlog={group.entry.exerciseName} className="rounded-md transition-shadow">
                      <ExerciseLogCard entry={group.entry} />
                      {renderAfter?.(group.entry)}
                    </div>
                  );
                }
                // Superset group
                return (
                  <div key={group.supersetId} className="rounded-md border border-primary/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-primary/20">
                      <span className="text-xs font-bold text-primary tracking-wider">
                        SUPERSET {group.label}
                      </span>
                    </div>
                    {group.members.map((member, mi) => (
                      <div key={mi} data-exlog={member.exerciseName} className="transition-shadow">
                        <ExerciseLogCard entry={member} />
                        {renderAfter && <div className="px-3 pb-2">{renderAfter(member)}</div>}
                        {mi < group.members.length - 1 && (
                          <div className="mx-3 border-t border-dashed border-primary/20" />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface CompletedSessionSheetProps {
  log: CoachSessionLog | null;
  open: boolean;
  onClose: () => void;
  /** The athlete's app connection — needed for coach remarks and replies */
  connectionId?: string;
  /** Adds a text to the athlete's profile notes */
  onAddToAthleteNotes?: (text: string) => Promise<void> | void;
}

interface ReplyTarget {
  quote: string;
  exerciseName?: string;
  sectionName?: string;
}

/** An athlete comment (or one the coach typed in while logging) with a Reply button */
function CommentBubble({ label, text, onReply, exerciseName, onJump }: {
  label: string; text: string; onReply?: () => void;
  /** Shown as a link that scrolls to the exercise in the session */
  exerciseName?: string; onJump?: () => void;
}) {
  return (
    <div className="mt-1.5 rounded-md border-l-2 border-violet-400 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground min-w-0">
          {exerciseName && (onJump ? (
            <button type="button" onClick={onJump} className="font-medium text-foreground hover:underline underline-offset-2" title="Show this exercise in the session">
              {exerciseName}
            </button>
          ) : (
            <span className="font-medium text-foreground">{exerciseName}</span>
          ))}
          {exerciseName ? ' · ' : ''}{label}
        </p>
        {onReply && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={onReply}>
            <Reply className="h-3 w-3" />
            Reply
          </Button>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap break-words leading-snug">{text}</p>
    </div>
  );
}

export function CompletedSessionSheet({ log, open, onClose, connectionId, onAddToAthleteNotes }: CompletedSessionSheetProps) {
  const { toast } = useToast();
  const exerciseComments = useMemo(() => parseExerciseComments(log?.exercise_comments), [log]);
  const loggedByCoach = log?.started_by === 'coach';

  // Coach remarks — private (coach_session_remarks)
  const [remark, setRemark] = useState('');
  const [savedRemark, setSavedRemark] = useState('');
  const [exerciseNotes, setExerciseNotes] = useState<ExerciseComment[]>([]);
  const [remarkSaving, setRemarkSaving] = useState(false);
  useEffect(() => {
    setRemark(''); setSavedRemark(''); setExerciseNotes([]);
    if (!log?.id || !open) return;
    let cancelled = false;
    void fetchCoachRemark(log.id).then(r => {
      if (cancelled) return;
      setRemark(r.remark); setSavedRemark(r.remark); setExerciseNotes(r.exerciseRemarks);
    });
    return () => { cancelled = true; };
  }, [log?.id, open]);

  const removeExerciseNote = async (noteId: string) => {
    if (!log || !connectionId) return;
    const next = await removeCoachExerciseRemark(log.id, connectionId, noteId);
    if (next) setExerciseNotes(next);
    else toast({ title: 'Note not removed', variant: 'destructive' });
  };

  const saveRemark = async () => {
    if (!log || !connectionId) return;
    setRemarkSaving(true);
    const error = await saveCoachRemark(log.id, connectionId, remark);
    setRemarkSaving(false);
    if (error) {
      toast({ title: 'Remarks not saved', description: error, variant: 'destructive' });
      return;
    }
    setSavedRemark(remark.trim());
    toast({ title: 'Remarks saved' });
  };

  // Reply — goes into the one athlete chat, with the comment quoted
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const sendReply = async () => {
    if (!log || !connectionId || !replyTarget || !replyText.trim()) return;
    setReplySending(true);
    const error = await sendCommentReply(connectionId, replyText, {
      exerciseName: replyTarget.exerciseName,
      sectionName: replyTarget.sectionName,
      sessionName: log.session_name ?? undefined,
      date: log.date,
      quote: replyTarget.quote,
    });
    setReplySending(false);
    if (error) {
      toast({ title: 'Reply not sent', description: error, variant: 'destructive' });
      return;
    }
    setReplyTarget(null);
    setReplyText('');
    toast({ title: 'Reply sent', description: 'It is in the athlete chat, with the comment quoted.' });
  };

  if (!log) return null;

  const athleteComments = exerciseComments.filter(c => c.author !== 'coach');
  // The coach's own exercise notes: private ones + older ones saved with the session log
  const allExerciseNotes = [...exerciseComments.filter(c => c.author === 'coach'), ...exerciseNotes];
  const loggedNames = new Set((log.sets_logged ?? []).map(e => e.exerciseName));
  /** Scroll the session to an exercise and highlight it briefly */
  const jumpToExercise = (name: string) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>('[data-exlog]')).find(e => e.dataset.exlog === name);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-violet-400');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-violet-400'), 1600);
  };
  // All athlete comments on exercises — one list near the top, also for exercises without any logged
  // set (e.g. "couldn't do it because…"); under the exercises they were easy to miss
  const otherComments = athleteComments;
  const commentLabel = (c: ExerciseComment) =>
    `${c.author === 'coach' ? 'Noted while logging' : 'Athlete'} · ${format(parseISO(c.createdAt), 'HH:mm')}`;
  const replyFor = (c: ExerciseComment) => (c.author !== 'coach' && connectionId
    ? () => setReplyTarget({ quote: c.text, exerciseName: c.exerciseName, sectionName: c.sectionName })
    : undefined);

  const sRPE = computeSRPE(log);
  const completedAt = log.completed_at ? parseISO(log.completed_at) : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">

        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <SheetTitle className="text-lg leading-snug">
              {log.session_name ?? 'Session'}
            </SheetTitle>
          </div>
          {completedAt && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Completed {format(completedAt, 'EEEE, MMM d yyyy')} at {format(completedAt, 'HH:mm')}
            </p>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Duration"
                value={log.duration_seconds ? formatDuration(log.duration_seconds) : '—'}
              />
              <StatCard
                icon={<Activity className="h-4 w-4 text-muted-foreground" />}
                label="RPE (Borg CR10)"
                value={log.borg_rating !== null ? borgLabel(log.borg_rating) : '—'}
              />
              <StatCard
                icon={<Flame className="h-4 w-4 text-muted-foreground" />}
                label="sRPE Load"
                value={sRPE !== null ? `${sRPE} AU` : '—'}
              />
              <StatCard
                icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                label="Status"
                value="Completed"
                valueClass="text-green-600"
              />
            </div>

            {/* Athlete feedback on the session — stays with the session; a reply goes to the chat */}
            {log.comment && (
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Athlete feedback{loggedByCoach ? ' (entered by you while logging)' : ''}
                  </p>
                  {connectionId && !loggedByCoach && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => setReplyTarget({ quote: log.comment! })}>
                      <Reply className="h-3 w-3" />
                      Reply
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap leading-snug">{log.comment}</p>
              </div>
            )}

            {/* Athlete comments on exercises */}
            {otherComments.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Exercise comments</p>
                {otherComments.map(c => (
                  <CommentBubble
                    key={c.id}
                    exerciseName={c.exerciseName}
                    onJump={loggedNames.has(c.exerciseName) ? () => jumpToExercise(c.exerciseName) : undefined}
                    label={commentLabel(c)}
                    text={c.text}
                    onReply={replyFor(c)}
                  />
                ))}
              </div>
            )}

            {/* Coach remarks — private */}
            {connectionId && (
              <div className="rounded-md border px-4 py-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  Coach remarks
                  <span className="text-muted-foreground font-normal">· private, only you see these</span>
                </p>
                {/* Your notes on single exercises (written while logging), then the general remark */}
                {allExerciseNotes.length > 0 && (
                  <ul className="space-y-1">
                    {allExerciseNotes.map(n => (
                      <li key={n.id} className="group flex items-start gap-2 rounded bg-muted/40 px-2 py-1.5 text-sm">
                        <span className="flex-1 min-w-0 whitespace-pre-wrap break-words">
                          <span className="font-medium">{n.exerciseName}:</span> {n.text}
                        </span>
                        {exerciseNotes.some(e => e.id === n.id) && (
                          <button
                            type="button"
                            onClick={() => void removeExerciseNote(n.id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                            title="Remove note"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <Textarea
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  rows={3}
                  placeholder="Your observations, cues, what to change next time…"
                  className="text-sm resize-none"
                />
                <div className="flex justify-end gap-2">
                  {onAddToAthleteNotes && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!remark.trim() && allExerciseNotes.length === 0}
                      onClick={async () => {
                        const when = format(parseISO(log.date + 'T12:00:00'), 'd MMM yyyy');
                        const text = remarksAsText({ remark, exerciseRemarks: allExerciseNotes });
                        await onAddToAthleteNotes(`${log.session_name ?? 'Session'} (${when}):\n${text}`);
                        toast({ title: 'Added to athlete notes' });
                      }}
                    >
                      Add to athlete notes
                    </Button>
                  )}
                  <Button size="sm" disabled={remarkSaving || remark.trim() === savedRemark} onClick={saveRemark}>
                    {remarkSaving ? 'Saving…' : 'Save remarks'}
                  </Button>
                </div>
              </div>
            )}

            {/* Exercise logs */}
            {log.sets_logged && log.sets_logged.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Session exercises</h3>
                <SessionExercises entries={log.sets_logged} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No set-by-set data was logged for this session.
              </p>
            )}

          </div>
        </ScrollArea>
      </SheetContent>

      <Dialog open={replyTarget !== null} onOpenChange={o => { if (!o) { setReplyTarget(null); setReplyText(''); } }}>
        {/* Above the sheet (z-300) — at the default z-index it opened behind the sheet's overlay */}
        <DialogContent className="sm:max-w-md z-[320]" overlayClassName="z-[310]">
          <DialogHeader>
            <DialogTitle>Reply in the chat</DialogTitle>
            <DialogDescription>
              {[replyTarget?.exerciseName, log.session_name, format(parseISO(log.date + 'T12:00:00'), 'd MMM yyyy')].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>
          {replyTarget && (
            <p className="border-l-2 border-muted-foreground/40 pl-2 text-sm italic text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              “{replyTarget.quote}”
            </p>
          )}
          <Textarea
            autoFocus
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            rows={4}
            placeholder="Your reply…"
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplyTarget(null); setReplyText(''); }}>Cancel</Button>
            <Button disabled={!replyText.trim() || replySending} onClick={sendReply}>
              {replySending ? 'Sending…' : 'Send reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
