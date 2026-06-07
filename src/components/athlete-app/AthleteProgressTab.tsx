// Athlete-side Progress tab — body metrics, performance params, exercise history.
// Designed mobile-first (390px), follows AthleteAppLayout shell constraints.

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, TrendingUp, Activity, Dumbbell, ChevronRight, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useAthleteExerciseMetrics } from '@/hooks/useAthleteExerciseMetrics';
import { epley1RM, type ExerciseSession, type ExerciseEntry, type ParamTags } from '@/hooks/useExerciseMetrics';
import type { AthleteConnection } from '@/hooks/useAthleteApp';
import type { MetricsSnapshotItem } from '@/hooks/useAthleteConnections';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try { return format(parseISO(iso), 'MMM d, yyyy'); } catch { return iso; }
}

function fmtDateShort(iso: string): string {
  try { return format(parseISO(iso), 'MMM d'); } catch { return iso; }
}

function toChartData(item: MetricsSnapshotItem) {
  return [...item.values]
    .filter(v => !isNaN(parseFloat(v.value)))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map(v => ({ date: fmtDateShort(v.recordedAt), value: parseFloat(v.value) }));
}

function getLatest(item: MetricsSnapshotItem) {
  if (!item.values.length) return null;
  return [...item.values].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}

// ── Metric detail sheet (body metrics + performance params) ───────────────────

function MetricSheet({
  item,
  open,
  onClose,
}: {
  item: MetricsSnapshotItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!item) return null;
  const chartData = toChartData(item);
  const latest = getLatest(item);
  const sortedValues = [...item.values].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[80vh] sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 p-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0 text-left">
          <SheetTitle className="text-base">{item.name}</SheetTitle>
          {latest && (
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold tabular-nums">{latest.value}</span>
              {item.unit && <span className="text-muted-foreground text-sm">{item.unit}</span>}
              <span className="text-xs text-muted-foreground ml-1">as of {fmtDate(latest.recordedAt)}</span>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Chart */}
            {chartData.length >= 2 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="metGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                      formatter={(v: number) => [`${v}${item.unit ? ` ${item.unit}` : ''}`, item.name]}
                    />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#metGrad)" dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center border rounded-lg bg-muted/20">
                <p className="text-xs text-muted-foreground text-center px-4">
                  {chartData.length === 0
                    ? 'No measurements recorded yet'
                    : 'Add more measurements to see a trend chart'}
                </p>
              </div>
            )}

            {/* Value history */}
            {sortedValues.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">History</p>
                <div className="border rounded-lg divide-y">
                  {sortedValues.map((v, i) => (
                    <div key={i} className="px-3 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{fmtDate(v.recordedAt)}</span>
                      <span className="text-sm font-medium tabular-nums">
                        {v.value}{item.unit ? ` ${item.unit}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── Session row (inside exercise sheet) ───────────────────────────────────────

function SessionRow({
  session,
  tags,
  allParamNames,
}: {
  session: ExerciseSession;
  tags: ParamTags | null;
  allParamNames: string[];
}) {
  const [open, setOpen] = useState(false);

  // Only show columns with at least one value in THIS session
  const sessionParamNames = useMemo(() => {
    const seen = new Set<string>();
    for (const set of session.sets) {
      for (const [k, v] of Object.entries(set.values)) {
        if (v !== undefined && v !== null && v !== '') seen.add(k);
      }
    }
    return allParamNames.filter(p => seen.has(p));
  }, [session.sets, allParamNames]);

  // Best set index for trophy icon
  const bestSetIdx = useMemo(() => {
    if (!tags || session.e1rm === null) return -1;
    let best: { idx: number; e1rm: number } | null = null;
    session.sets.forEach((s, i) => {
      if (!s.completed) return;
      const w = parseFloat(s.values[tags.weightParam] ?? '');
      const r = parseFloat(s.values[tags.repsParam] ?? '');
      if (isNaN(w) || isNaN(r)) return;
      const rir = tags.rirParam ? parseFloat(s.values[tags.rirParam] ?? '0') : 0;
      const est = epley1RM(w, r, isNaN(rir) ? 0 : rir);
      if (!best || est > best.e1rm) best = { idx: i, e1rm: est };
    });
    return best?.idx ?? -1;
  }, [session, tags]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-3 bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">
            {format(parseISO(session.date + 'T12:00:00'), 'MMM d, yyyy')}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">{session.sessionName}</span>
        </div>
        {session.e1rm !== null && (
          <span className="text-xs font-bold text-primary tabular-nums shrink-0">
            e1RM {session.e1rm.toFixed(1)}
          </span>
        )}
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        sessionParamNames.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t bg-muted/10">
                  <th className="text-left px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase w-10">Set</th>
                  {sessionParamNames.map(p => (
                    <th key={p} className="text-left px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase">{p}</th>
                  ))}
                  {tags && session.e1rm !== null && (
                    <th className="text-left px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase">e1RM</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {session.sets.map((s, i) => {
                  const isBest = i === bestSetIdx;
                  const w = tags ? parseFloat(s.values[tags.weightParam] ?? '') : NaN;
                  const r = tags ? parseFloat(s.values[tags.repsParam] ?? '') : NaN;
                  const rir = tags?.rirParam ? parseFloat(s.values[tags.rirParam] ?? '0') : 0;
                  const setE1rm = (!isNaN(w) && !isNaN(r) && r > 0 && s.completed && tags)
                    ? epley1RM(w, r, isNaN(rir) ? 0 : rir)
                    : null;
                  return (
                    <tr key={i} className={cn(!s.completed && 'opacity-40', isBest && 'bg-primary/5')}>
                      <td className="px-3 py-2 text-xs text-muted-foreground font-medium">
                        {String(s.setNumber).padStart(2, '0')}
                      </td>
                      {sessionParamNames.map(p => (
                        <td key={p} className="px-3 py-2 tabular-nums text-sm">
                          {s.values[p] ?? <span className="text-muted-foreground/40">—</span>}
                        </td>
                      ))}
                      {tags && session.e1rm !== null && (
                        <td className={cn('px-3 py-2 tabular-nums text-sm', isBest && 'font-bold text-primary')}>
                          {setE1rm !== null ? (
                            <>{setE1rm.toFixed(1)}{isBest && <Trophy className="inline h-3 w-3 ml-1 text-amber-500" />}</>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-3 py-2 text-xs text-muted-foreground">No set data logged</div>
        )
      )}
    </div>
  );
}

// ── Exercise detail sheet ─────────────────────────────────────────────────────

function ExerciseSheet({
  open,
  onClose,
  exercise,
  sessions,
  tags,
}: {
  open: boolean;
  onClose: () => void;
  exercise: ExerciseEntry;
  sessions: ExerciseSession[];
  tags: ParamTags | null;
}) {
  const chartData = useMemo(() => {
    if (!tags) return [];
    return sessions
      .filter(s => s.e1rm !== null)
      .map(s => ({
        date: format(parseISO(s.date + 'T12:00:00'), 'MMM d'),
        value: parseFloat((s.e1rm as number).toFixed(1)),
      }));
  }, [sessions, tags]);

  const latestE1RM = sessions.filter(s => s.e1rm !== null).pop()?.e1rm ?? null;
  const weightUnit = tags?.weightParam ? (exercise.allParamUnits[tags.weightParam] ?? '') : '';

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[85vh] sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 p-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0 text-left">
          <SheetTitle className="text-base">{exercise.name}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} logged
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">

            {/* e1RM chart */}
            {tags && (
              <div className="space-y-1">
                {latestE1RM !== null && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tabular-nums">{latestE1RM.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">
                      {weightUnit ? `${weightUnit} ` : ''}est. 1RM
                    </span>
                  </div>
                )}
                {chartData.length >= 2 ? (
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="e1rmGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                          formatter={(v: number) => [`${v.toFixed(1)}${weightUnit ? ` ${weightUnit}` : ''}`, 'est. 1RM']}
                        />
                        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#e1rmGrad)" dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : chartData.length === 1 ? (
                  <div className="h-14 flex items-center justify-center border rounded-lg bg-muted/20">
                    <p className="text-xs text-muted-foreground text-center px-4">
                      Log more sessions with weight + reps to see the trend
                    </p>
                  </div>
                ) : (
                  <div className="h-14 flex items-center justify-center border rounded-lg bg-muted/20">
                    <p className="text-xs text-muted-foreground text-center px-4">
                      No sets with weight + reps logged yet
                    </p>
                  </div>
                )}
                {chartData.length >= 2 && (
                  <p className="text-[10px] text-muted-foreground text-right">
                    Epley: weight × (1 + (reps{tags.rirParam ? ' + RIR' : ''}) / 30)
                  </p>
                )}
              </div>
            )}

            {/* Session history */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Session History
              </p>
              {[...sessions].reverse().map((session, i) => (
                <SessionRow
                  key={`${session.logId}-${i}`}
                  session={session}
                  tags={tags}
                  allParamNames={exercise.allParamNames}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  connection: AthleteConnection;
}

export function AthleteProgressTab({ connection }: Props) {
  const snapshot = connection.profileData.metricsSnapshot ?? null;
  const { exercises, loading, paramTags, getExerciseHistory } = useAthleteExerciseMetrics(
    connection.id,
    connection.coachUserId,
  );

  const [selectedMetric, setSelectedMetric] = useState<MetricsSnapshotItem | null>(null);
  const [selectedExerciseName, setSelectedExerciseName] = useState<string | null>(null);

  const selectedExercise = exercises.find(e => e.name === selectedExerciseName) ?? null;
  const selectedHistory = selectedExerciseName ? getExerciseHistory(selectedExerciseName) : [];
  const selectedTags = selectedExerciseName ? (paramTags[selectedExerciseName] ?? null) : null;

  const hasBodyMetrics = (snapshot?.bodyMetrics.length ?? 0) > 0;
  const hasPerformance = (snapshot?.performanceParams.length ?? 0) > 0;
  const hasExercises = exercises.length > 0;
  const hasAnyData = hasBodyMetrics || hasPerformance || hasExercises || loading;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <TrendingUp className="h-7 w-7 text-primary" />
        </div>
        <p className="text-base font-semibold mb-1">No progress data yet</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Complete workouts and your coach will add metrics to your profile — your progress will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">

      {/* Body Metrics section */}
      {hasBodyMetrics && (
        <section>
          <div className="flex items-center gap-2 px-1 mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Body Metrics</h2>
          </div>
          <div className="space-y-px">
            {snapshot!.bodyMetrics.map((item, i) => {
              const latest = getLatest(item);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedMetric(item)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {latest ? (
                      <>
                        <p className="text-sm font-semibold tabular-nums">
                          {latest.value}{item.unit ? ` ${item.unit}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDateShort(latest.recordedAt)}</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No data</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Performance Parameters section */}
      {hasPerformance && (
        <section>
          <div className="flex items-center gap-2 px-1 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Performance</h2>
          </div>
          <div className="space-y-px">
            {snapshot!.performanceParams.map((item, i) => {
              const latest = getLatest(item);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedMetric(item)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.category && (
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {latest ? (
                      <>
                        <p className="text-sm font-semibold tabular-nums">
                          {latest.value}{item.unit ? ` ${item.unit}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDateShort(latest.recordedAt)}</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No data</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Exercise History section */}
      <section>
        <div className="flex items-center gap-2 px-1 mb-2">
          <Dumbbell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Exercise History</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : exercises.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-muted-foreground">
              No exercises logged yet. Complete your first workout to see history here.
            </p>
          </div>
        ) : (
          <div className="space-y-px">
            {exercises.map((ex, i) => {
              const hasTags = !!paramTags[ex.name];
              return (
                <button
                  key={i}
                  onClick={() => setSelectedExerciseName(ex.name)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ex.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ex.sessionCount} session{ex.sessionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {hasTags && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 shrink-0 dark:bg-amber-900/40 dark:text-amber-400">
                      e1RM
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(parseISO(ex.lastDate + 'T12:00:00'), 'MMM d')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Metric detail sheet */}
      <MetricSheet
        item={selectedMetric}
        open={!!selectedMetric}
        onClose={() => setSelectedMetric(null)}
      />

      {/* Exercise detail sheet */}
      {selectedExercise && (
        <ExerciseSheet
          open={!!selectedExerciseName}
          onClose={() => setSelectedExerciseName(null)}
          exercise={selectedExercise}
          sessions={selectedHistory}
          tags={selectedTags}
        />
      )}
    </div>
  );
}
