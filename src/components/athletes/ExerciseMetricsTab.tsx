import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Dumbbell, Search, Settings2, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useExerciseMetrics,
  epley1RM,
  type ExerciseSession,
  type ParamTags,
} from '@/hooks/useExerciseMetrics';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { Athlete } from '@/types/athlete';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatShortDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

// ── Tag config dialog ─────────────────────────────────────────────────────────

function TagDialog({
  open,
  exerciseName,
  paramNames,
  paramUnits,
  current,
  onSave,
  onClear,
  onClose,
}: {
  open: boolean;
  exerciseName: string;
  paramNames: string[];
  paramUnits: Record<string, string>;
  current: ParamTags | null;
  onSave: (tags: ParamTags) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const NONE = '__none__';
  const [weightParam, setWeightParam] = useState(current?.weightParam ?? '');
  const [repsParam,   setRepsParam]   = useState(current?.repsParam ?? '');
  const [rirParam,    setRirParam]    = useState(current?.rirParam ?? NONE);

  const label = (p: string) => paramUnits[p] ? `${p} (${paramUnits[p]})` : p;

  const canSave = weightParam && repsParam && weightParam !== repsParam;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Configure 1RM Estimation</DialogTitle>
          <DialogDescription>
            Tag which parameters represent weight and reps for <strong>{exerciseName}</strong>.
            Epley formula: weight × (1 + (reps + RIR) / 30)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Weight parameter <span className="text-destructive">*</span></label>
            <Select value={weightParam} onValueChange={setWeightParam}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {paramNames.map(p => (
                  <SelectItem key={p} value={p}>{label(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reps parameter <span className="text-destructive">*</span></label>
            <Select value={repsParam} onValueChange={setRepsParam}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {paramNames.filter(p => p !== weightParam).map(p => (
                  <SelectItem key={p} value={p}>{label(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              RIR parameter
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <Select value={rirParam} onValueChange={setRirParam}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {paramNames.filter(p => p !== weightParam && p !== repsParam).map(p => (
                  <SelectItem key={p} value={p}>{label(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              If tagged, effective reps = performed reps + RIR for a more accurate estimate.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {current && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive mr-auto"
              onClick={() => { onClear(); onClose(); }}>
              Remove tags
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onSave({ weightParam, repsParam, rirParam: (rirParam && rirParam !== NONE) ? rirParam : undefined });
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Set history row ───────────────────────────────────────────────────────────

function SessionHistoryBlock({
  session,
  paramNames,
  tags,
  defaultOpen,
}: {
  session: ExerciseSession;
  paramNames: string[];
  tags: ParamTags | null;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const bestSet = useMemo(() => {
    if (!tags || session.e1rm === null) return null;
    let best: { setIdx: number; e1rm: number } | null = null;
    session.sets.forEach((s, i) => {
      if (!s.completed) return;
      const w = parseFloat(s.values[tags.weightParam] ?? '');
      const r = parseFloat(s.values[tags.repsParam] ?? '');
      if (isNaN(w) || isNaN(r)) return;
      const rir = tags.rirParam ? parseFloat(s.values[tags.rirParam] ?? '0') : 0;
      const est = epley1RM(w, r, isNaN(rir) ? 0 : rir);
      if (!best || est > best.e1rm) best = { setIdx: i, e1rm: est };
    });
    return best;
  }, [session, tags]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Session header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold">{formatDate(session.date)}</span>
          <span className="ml-2 text-xs text-muted-foreground">{session.sessionName}</span>
        </div>
        {session.e1rm !== null && (
          <span className="text-sm font-bold text-primary tabular-nums shrink-0">
            e1RM {session.e1rm.toFixed(1)} {tags?.weightParam.match(/\(([^)]+)\)/)?.[1] ?? ''}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Sets table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-b bg-muted/10">
                <th className="text-left px-4 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-12">Set</th>
                {paramNames.map(p => (
                  <th key={p} className="text-left px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {p}
                  </th>
                ))}
                {tags && <th className="text-left px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">e1RM</th>}
                <th className="w-6" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {session.sets.map((s, i) => {
                const isBest = bestSet?.setIdx === i;
                const w = tags ? parseFloat(s.values[tags.weightParam] ?? '') : NaN;
                const r = tags ? parseFloat(s.values[tags.repsParam] ?? '') : NaN;
                const rir = tags?.rirParam ? parseFloat(s.values[tags.rirParam] ?? '0') : 0;
                const setE1rm = (!isNaN(w) && !isNaN(r) && r > 0 && s.completed && tags)
                  ? epley1RM(w, r, isNaN(rir) ? 0 : rir)
                  : null;

                return (
                  <tr
                    key={i}
                    className={cn(
                      'transition-colors',
                      !s.completed && 'opacity-40',
                      isBest && 'bg-primary/5'
                    )}
                  >
                    <td className="px-4 py-2 text-xs font-medium text-muted-foreground">
                      {String(s.setNumber).padStart(2, '0')}
                    </td>
                    {paramNames.map(p => (
                      <td key={p} className={cn(
                        'px-3 py-2 tabular-nums',
                        tags?.weightParam === p && s.completed && 'font-medium',
                      )}>
                        {s.values[p] ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                    ))}
                    {tags && (
                      <td className={cn('px-3 py-2 tabular-nums', isBest && 'font-bold text-primary')}>
                        {setE1rm !== null ? setE1rm.toFixed(1) : <span className="text-muted-foreground/40">—</span>}
                        {isBest && <Trophy className="inline h-3 w-3 ml-1 text-amber-500" />}
                      </td>
                    )}
                    <td />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────────────────

function ExerciseDetail({
  exerciseName,
  allParamNames,
  paramUnits,
  sessions,
  tags,
  onConfigureTags,
}: {
  exerciseName: string;
  allParamNames: string[];
  paramUnits: Record<string, string>;
  sessions: ExerciseSession[];
  tags: ParamTags | null;
  onConfigureTags: () => void;
}) {
  const [timeRange, setTimeRange] = useState<'all' | '3m' | '6m' | '1y'>('all');

  const filteredSessions = useMemo(() => {
    if (timeRange === 'all') return sessions;
    const days = { '3m': 90, '6m': 180, '1y': 365 }[timeRange];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return sessions.filter(s => s.date >= cutoffStr);
  }, [sessions, timeRange]);

  // Param names that actually appear in logged sets (not just planned)
  const activeParamNames = useMemo(() => {
    const seen = new Set<string>();
    for (const s of sessions) {
      for (const set of s.sets) {
        for (const k of Object.keys(set.values)) seen.add(k);
      }
    }
    return allParamNames.filter(p => seen.has(p));
  }, [sessions, allParamNames]);

  const chartData = useMemo(() => {
    if (!tags) return [];
    return filteredSessions
      .filter(s => s.e1rm !== null)
      .map(s => ({ label: formatShortDate(s.date), e1rm: parseFloat((s.e1rm as number).toFixed(1)) }));
  }, [filteredSessions, tags]);

  const latestE1RM = useMemo(() => {
    if (!tags) return null;
    const sessionsWithE1RM = [...sessions].filter(s => s.e1rm !== null);
    return sessionsWithE1RM.length ? sessionsWithE1RM[sessionsWithE1RM.length - 1].e1rm : null;
  }, [sessions, tags]);

  const weightUnit = tags?.weightParam ? (paramUnits[tags.weightParam] ?? '') : '';

  return (
    <ScrollArea className="flex-1">
      <div className="p-5 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{exerciseName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} logged
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tags ? (
              <Badge variant="secondary" className="text-xs gap-1">
                <Trophy className="h-3 w-3 text-amber-500" />
                e1RM active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                e1RM not configured
              </Badge>
            )}
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onConfigureTags}>
              <Settings2 className="h-3.5 w-3.5" />
              {tags ? 'Edit tags' : 'Configure 1RM'}
            </Button>
          </div>
        </div>

        {/* e1RM chart */}
        {tags && chartData.length >= 2 ? (
          <div className="space-y-2">
            {latestE1RM !== null && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums">{latestE1RM.toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">{weightUnit} est. 1RM</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              {(['all', '3m', '6m', '1y'] as const).map(r => (
                <Button
                  key={r}
                  variant={timeRange === r ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setTimeRange(r)}
                >
                  {r === 'all' ? 'All' : r.toUpperCase()}
                </Button>
              ))}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="e1rmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    label={weightUnit ? {
                      value: weightUnit,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 12,
                      style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
                    } : undefined}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    formatter={(v: number) => [`${v.toFixed(1)}${weightUnit ? ` ${weightUnit}` : ''}`, 'est. 1RM']}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="e1rm"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#e1rmGrad)"
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-right">
              Epley: weight × (1 + (reps{tags.rirParam ? ' + RIR' : ''}) / 30) · best set per session
            </p>
          </div>
        ) : tags && chartData.length < 2 ? (
          <div className="h-32 flex items-center justify-center border rounded-lg bg-muted/20">
            <p className="text-sm text-muted-foreground">
              {chartData.length === 0
                ? 'No completed sets with weight + reps logged yet.'
                : 'Log at least 2 sessions to see the chart.'}
            </p>
          </div>
        ) : !tags ? (
          <div className="border border-dashed rounded-lg p-5 text-center space-y-2">
            <Trophy className="h-7 w-7 mx-auto text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">
              Tag which parameters are weight and reps to unlock the estimated 1RM chart.
            </p>
            <Button size="sm" variant="outline" className="text-xs" onClick={onConfigureTags}>
              Configure 1RM estimation
            </Button>
          </div>
        ) : null}

        {/* Session history */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Session History</h4>
          {[...filteredSessions].reverse().map((session, i) => (
            <SessionHistoryBlock
              key={session.logId}
              session={session}
              paramNames={activeParamNames}
              tags={tags}
              defaultOpen={true}
            />
          ))}
        </div>

      </div>
    </ScrollArea>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { athlete: Athlete }

export function ExerciseMetricsTab({ athlete }: Props) {
  const { getConnectionForAthlete } = useAthleteConnections();
  const connectionId = getConnectionForAthlete(athlete.id)?.id ?? null;

  const { exercises, loading, paramTags, setParamTags, getExerciseHistory } = useExerciseMetrics(connectionId);

  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(e => e.name.toLowerCase().includes(q));
  }, [exercises, search]);

  const selectedExercise = exercises.find(e => e.name === selectedName) ?? null;
  const history = selectedName ? getExerciseHistory(selectedName) : [];
  const tags = selectedName ? (paramTags[selectedName] ?? null) : null;

  // ── Empty / loading states ─────────────────────────────────────────────────

  if (!connectionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
        <Dumbbell className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No athlete app account</p>
        <p className="text-xs opacity-70 text-center max-w-xs">
          Create an athlete app account in Settings to enable session logging.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading exercise data…
      </div>
    );
  }

  if (!loading && exercises.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-muted/50 p-5">
          <Dumbbell className="h-10 w-10 text-muted-foreground opacity-40" />
        </div>
        <div className="max-w-xs space-y-2">
          <h3 className="font-semibold text-base">No sessions logged yet</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Once the athlete completes workouts in the app, exercise data will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">

      {/* Left panel — exercise list */}
      <div className="w-72 shrink-0 border-r flex flex-col">
        <div className="p-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search exercises…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center px-3 py-1 border-b">
          <span className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Exercise</span>
          <span className="w-16 shrink-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-right">Sessions</span>
          <span className="w-16 shrink-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-right">Last</span>
        </div>

        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2.5">No matches.</p>
          ) : (
            filtered.map(ex => (
              <button
                key={ex.name}
                onClick={() => setSelectedName(ex.name)}
                className={cn(
                  'w-full text-left px-3 py-2 flex items-center gap-1 transition-colors',
                  selectedName === ex.name ? 'bg-primary/10' : 'hover:bg-muted/40'
                )}
              >
                <span className={cn(
                  'flex-1 min-w-0 text-sm font-medium truncate',
                  selectedName === ex.name && 'text-primary'
                )}>
                  {ex.name}
                </span>
                <span className="w-16 shrink-0 text-xs text-muted-foreground text-right tabular-nums">
                  {ex.sessionCount}
                </span>
                <span className="w-16 shrink-0 text-xs text-muted-foreground text-right">
                  {formatShortDate(ex.lastDate)}
                </span>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Right panel */}
      {!selectedExercise ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Dumbbell className="h-10 w-10 opacity-30" />
          <p className="text-sm">Select an exercise to view its history</p>
        </div>
      ) : (
        <ExerciseDetail
          exerciseName={selectedExercise.name}
          allParamNames={selectedExercise.allParamNames}
          paramUnits={selectedExercise.allParamUnits}
          sessions={history}
          tags={tags}
          onConfigureTags={() => setTagDialogOpen(true)}
        />
      )}

      {/* Tag config dialog */}
      {selectedName && (
        <TagDialog
          open={tagDialogOpen}
          exerciseName={selectedName}
          paramNames={selectedExercise?.allParamNames ?? []}
          paramUnits={selectedExercise?.allParamUnits ?? {}}
          current={tags}
          onSave={t => setParamTags(selectedName, t)}
          onClear={() => setParamTags(selectedName, null)}
          onClose={() => setTagDialogOpen(false)}
        />
      )}
    </div>
  );
}
