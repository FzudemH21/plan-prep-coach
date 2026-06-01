import React from 'react';
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
import { CheckCircle2, Clock, Activity, Flame, RefreshCw } from 'lucide-react';
import { getBorgLabel, isBorgLevel } from '@/utils/intensityScale';

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
  comment: string | null;
  sets_logged: SetLogEntry[] | null;
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
          <span className="text-sm font-medium">{entry.exerciseName}</span>
        </div>

        {/* Rounds completed */}
        <div className={`px-3 py-2 text-sm border-b ${skipped ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'}`}>
          {skipped
            ? `0 / ${entry.totalRounds} rounds — skipped`
            : `${entry.roundsCompleted} / ${entry.totalRounds} rounds completed`}
        </div>

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
              if (cex.enabledParams?.includes('Reps') && cex.reps) params.push(`${cex.reps} reps`);
              if (cex.enabledParams?.includes('Time') && cex.time) params.push(`${cex.time}s`);
              if (cex.enabledParams?.includes('Distance') && cex.distance) params.push(`${cex.distance}m`);
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
                {paramNames.map((p) => (
                  <th key={p} className="text-right px-3 py-1.5 font-medium">{p}</th>
                ))}
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

function SessionExercises({ entries }: { entries: SetLogEntry[] }) {
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
                  return <ExerciseLogCard key={gi} entry={group.entry} />;
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
                      <div key={mi}>
                        <ExerciseLogCard entry={member} />
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
}

export function CompletedSessionSheet({ log, open, onClose }: CompletedSessionSheetProps) {
  if (!log) return null;

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

            {/* Athlete comment */}
            {log.comment && (
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground font-medium mb-1">Athlete note</p>
                <p className="text-sm whitespace-pre-wrap leading-snug">{log.comment}</p>
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
    </Sheet>
  );
}
