import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  addWeeks, addMonths, addYears,
  subWeeks, subMonths,
  getISOWeek,
  parseISO,
  isWithinInterval,
  eachDayOfInterval,
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, X, Plus, Trash2 } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
} from 'recharts';
import type { AthletePerformanceParameter } from '@/types/athlete';
import type { ParameterV2 } from '@/types/parametersV2';

// ── Constants ─────────────────────────────────────────────────────────────────

const SERIES_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionLog {
  id: string;
  date: string;
  session_id: string | null;
  session_name: string | null;
  borg_rating: number | null;
  duration_seconds: number | null;
  completed_at: string | null;
  sets_logged: unknown;
}

interface ScheduleSessionExercise {
  name?: string;
  methodKey?: string;
  order?: number;
}

interface ScheduleSession {
  id?: string;
  name?: string;
  intensity?: string;
  exercises?: ScheduleSessionExercise[];
}

interface ScheduleRow {
  date: string;
  sessions: ScheduleSession[] | null;
  intensity: string | null;
}

interface DateRange {
  from: string;
  to: string;
}

type Preset = '1W' | '4W' | '3M' | 'Custom';
type Granularity = 'day' | 'week' | 'month' | 'year';
type CalendarPhase = 'start' | 'end';
type AggregationMode = 'sum' | 'mean' | 'max';

interface TrainingSeries {
  id: string;
  type: 'training';
  methodId: string;
  methodLabel: string;
  paramName: string;
  aggregation: AggregationMode;
  color: string;
}

interface PerformanceSeries {
  id: string;
  type: 'performance';
  athleticismParameterId: string;
  paramName: string;
  unit?: string;
  color: string;
}

type ChartSeries = TrainingSeries | PerformanceSeries;

// ── Overview (small-multiples) types ──────────────────────────────────────────

interface OverviewMethodPanel {
  id: string;
  methodId: string;
  methodLabel: string;
  paramName: string;
  aggregation: AggregationMode;
  unit?: string;
  color: string;
}

interface OverviewPerfSeries {
  id: string;
  athleticismParameterId: string;
  paramName: string;
  unit?: string;
  color: string;
}

// Raw exercise entry shape inside sets_logged JSONB
interface ExerciseLogEntry {
  exerciseName?: string;
  methodId?: string;
  isCircuit?: boolean;
  plannedParams?: Record<string, string>;
  sets?: Array<{
    setNumber: number;
    values: Record<string, string>;
    completed: boolean;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Strip ::category suffix from split-method keys for display. */
function stripMethodSuffix(methodId: string): string {
  return methodId.includes('::') ? methodId.split('::')[0] : methodId;
}

function intensityToNumber(intensity: string | null | undefined): number | null {
  if (!intensity) return null;
  const n = parseFloat(intensity);
  return isNaN(n) ? null : n;
}

function computeSRPE(log: SessionLog): number {
  if (!log.borg_rating || !log.duration_seconds) return 0;
  return log.borg_rating * Math.round(log.duration_seconds / 60);
}

function computePlannedSRPE(log: SessionLog, plannedIntensity: string | null): number | null {
  if (!log.duration_seconds || !plannedIntensity) return null;
  const n = intensityToNumber(plannedIntensity);
  if (n === null) return null;
  return Math.round(n * Math.round(log.duration_seconds / 60));
}

function bucketsInRange(from: string, to: string, granularity: Granularity): Date[] {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const buckets: Date[] = [];

  if (granularity === 'day') return eachDayOfInterval({ start: fromDate, end: toDate });

  if (granularity === 'week') {
    let cur = startOfWeek(fromDate, { weekStartsOn: 1 });
    while (cur <= toDate) { buckets.push(cur); cur = addWeeks(cur, 1); }
    return buckets;
  }

  if (granularity === 'month') {
    let cur = startOfMonth(fromDate);
    while (cur <= toDate) { buckets.push(cur); cur = addMonths(cur, 1); }
    return buckets;
  }

  let cur = startOfYear(fromDate);
  while (cur <= toDate) { buckets.push(cur); cur = addYears(cur, 1); }
  return buckets;
}

function bucketEnd(bucketStart: Date, granularity: Granularity): Date {
  if (granularity === 'day')   return bucketStart;
  if (granularity === 'week')  return endOfWeek(bucketStart, { weekStartsOn: 1 });
  if (granularity === 'month') return endOfMonth(bucketStart);
  return endOfYear(bucketStart);
}

function bucketLabel(bucketStart: Date, granularity: Granularity): string {
  if (granularity === 'day')   return format(bucketStart, 'MMM d');
  if (granularity === 'week')  return `W${getISOWeek(bucketStart)}`;
  if (granularity === 'month') return format(bucketStart, 'MMM yyyy');
  return format(bucketStart, 'yyyy');
}

function bucketTooltipLabel(bucketStart: Date, granularity: Granularity): string {
  if (granularity === 'day')   return format(bucketStart, 'EEEE, MMM d');
  if (granularity === 'week')  return `Week of ${format(bucketStart, 'MMM d')}`;
  if (granularity === 'month') return format(bucketStart, 'MMMM yyyy');
  return format(bucketStart, 'yyyy');
}

function parseExerciseEntries(setsLogged: unknown): ExerciseLogEntry[] {
  if (!Array.isArray(setsLogged)) return [];
  return setsLogged as ExerciseLogEntry[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground py-4 text-center">{label}</p>
  );
}

// ── Calendar range picker ─────────────────────────────────────────────────────

interface CalendarRangePickerProps {
  from: Date | null;
  to: Date | null;
  onChange: (from: Date, to: Date) => void;
  onClear: () => void;
}

function CalendarRangePicker({ from, to, onChange, onClear }: CalendarRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<CalendarPhase>('start');
  const [draft, setDraft] = useState<{ from: Date | null; to: Date | null }>({ from, to });

  const handleOpenChange = (o: boolean) => {
    if (o) { setDraft({ from, to }); setPhase('start'); }
    setOpen(o);
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    if (phase === 'start' || !draft.from) {
      setDraft({ from: date, to: date });
      setPhase('end');
      return;
    }
    if (date >= draft.from) {
      const newFrom = draft.from;
      const newTo = date;
      setDraft({ from: newFrom, to: newTo });
      setPhase('start');
      onChange(newFrom, newTo);
      setOpen(false);
    } else {
      setDraft({ from: date, to: date });
      setPhase('end');
    }
  };

  const triggerLabel = from && to
    ? `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`
    : 'Select date range…';

  const isDraft = (d: Date) => {
    if (!draft.from) return false;
    if (!draft.to) return d.getTime() === draft.from.getTime();
    return isWithinInterval(d, { start: draft.from, end: draft.to });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-sm font-normal">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1">
            {phase === 'start' ? 'Click to set start date' : 'Click to set end date'}
          </p>
          <Calendar
            mode="single"
            selected={draft.from ?? undefined}
            onSelect={handleSelect}
            modifiers={{
              start:  (d) => !!draft.from && d.getTime() === draft.from.getTime(),
              end:    (d) => !!draft.to   && d.getTime() === draft.to.getTime(),
              middle: (d) => {
                if (!draft.from || !draft.to) return false;
                return d > draft.from && d < draft.to;
              },
              inRange: isDraft,
            }}
            modifiersStyles={{
              start:  { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 'bold', borderRadius: '4px' },
              end:    { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 'bold', borderRadius: '4px' },
              middle: { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' },
            }}
            className="rounded-md pointer-events-auto"
          />
          {(from || to) && (
            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => { onClear(); setOpen(false); }}>
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Series label helper ───────────────────────────────────────────────────────

function seriesLabel(s: ChartSeries): string {
  if (s.type === 'performance') return s.paramName + (s.unit ? ` (${s.unit})` : '');
  const agg = s.aggregation === 'sum' ? 'Σ' : s.aggregation === 'mean' ? 'Ø' : 'max';
  return `${stripMethodSuffix(s.methodLabel)} — ${s.paramName} [${agg}]`;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null; color: string; name: string }>;
  label?: string;
  bucketLabelMap: Map<string, string>;
  seriesMap: Map<string, ChartSeries>;
}

function CustomTooltip({ active, payload, label, bucketLabelMap, seriesMap }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-md border bg-background shadow-md text-xs p-2 space-y-1 min-w-[160px]">
      <p className="font-medium text-foreground pb-1 border-b">{bucketLabelMap.get(label) ?? label}</p>
      {payload.map((p) => {
        if (p.value == null) return null;
        const s = seriesMap.get(p.dataKey);
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground truncate flex-1">{s ? seriesLabel(s) : p.name}</span>
            <span className="font-medium ml-2">
              {typeof p.value === 'number' ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(1)) : p.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Overview sub-components ───────────────────────────────────────────────────

interface MiniMethodPanelProps {
  panel: OverviewMethodPanel;
  data: Array<{ label: string; value: number | null }>;
  bucketLabelMap: Map<string, string>;
  showXAxis: boolean;
  onRemove: () => void;
}

function MiniMethodPanel({ panel, data, bucketLabelMap, showXAxis, onRemove }: MiniMethodPanelProps) {
  const paramLabel = panel.unit ? `${panel.paramName} (${panel.unit})` : panel.paramName;
  const aggLabel = panel.aggregation === 'sum' ? 'Σ' : panel.aggregation === 'mean' ? 'Ø' : 'max';
  return (
    <div className="relative group border-b last:border-b-0">
      {/* Row label */}
      <div className="absolute left-10 top-1 z-10 flex items-center gap-1.5 pointer-events-none">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: panel.color }} />
        <span className="text-[10px] font-semibold text-foreground/80 leading-none truncate max-w-[180px]">
          {stripMethodSuffix(panel.methodLabel)}
        </span>
        <span className="text-[9px] text-muted-foreground/70 leading-none">
          {paramLabel} · {aggLabel}
        </span>
      </div>
      <button
        onClick={onRemove}
        className="absolute right-1 top-1 z-10 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded"
      >
        <X className="h-3 w-3" />
      </button>
      <ResponsiveContainer width="100%" height={showXAxis ? 72 : 60}>
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: showXAxis ? 2 : 0 }}>
          {showXAxis && (
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
          )}
          <YAxis
            tick={{ fontSize: 9 }}
            width={38}
            tickCount={3}
            tickFormatter={(v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number) => [
              Number.isInteger(v) ? v : v.toFixed(1),
              `${paramLabel} [${aggLabel}]`,
            ]}
            labelFormatter={(l: string) => bucketLabelMap.get(l) ?? l}
            contentStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="value" fill={panel.color} radius={[2, 2, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface OverviewPerfPanelProps {
  series: OverviewPerfSeries[];
  data: Array<Record<string, number | null | string>>;
  bucketLabelMap: Map<string, string>;
  onRemoveSeries: (id: string) => void;
}

function OverviewPerfPanel({ series, data, bucketLabelMap, onRemoveSeries }: OverviewPerfPanelProps) {
  return (
    <div className="relative pt-1">
      {/* Labels row */}
      <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Outcomes
        </span>
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1 text-[10px]" style={{ color: s.color }}>
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            {s.paramName}{s.unit ? ` (${s.unit})` : ''}
            <button
              onClick={() => onRemoveSeries(s.id)}
              className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 9 }}
            width={38}
            tickCount={3}
            tickFormatter={(v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number, _name: string, entry: { dataKey?: string }) => {
              const s = series.find((x) => x.id === entry.dataKey);
              return [Number.isInteger(v) ? v : v.toFixed(1), s ? `${s.paramName}${s.unit ? ` (${s.unit})` : ''}` : ''];
            }}
            labelFormatter={(l: string) => bucketLabelMap.get(l) ?? l}
            contentStyle={{ fontSize: 11 }}
          />
          {series.map((s) => (
            <Line
              key={s.id}
              dataKey={s.id}
              stroke={s.color}
              strokeWidth={2}
              dot={{ fill: s.color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              type="monotone"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface AthleteAnalysisTabProps {
  athleteId: string;
  connectionId: string;
  performanceParameters?: AthletePerformanceParameter[];
  parametersV2?: ParameterV2[];
}

export function AthleteAnalysisTab({
  athleteId,
  connectionId: connectionIdProp,
  performanceParameters = [],
  parametersV2 = [],
}: AthleteAnalysisTabProps) {
  const { getConnectionForAthlete } = useAthleteConnections();
  const resolvedConnectionId = connectionIdProp || getConnectionForAthlete(athleteId)?.id || null;

  // ── Controls ───────────────────────────────────────────────────────────────
  const today = new Date();
  const todayYMD = toYMD(today);

  const [preset, setPreset] = useState<Preset>('4W');
  const [customFrom, setCustomFrom] = useState<Date | null>(subWeeks(today, 4));
  const [customTo,   setCustomTo]   = useState<Date | null>(today);
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [showPlannedLoad, setShowPlannedLoad] = useState(false);

  const activeRange = useCallback((): DateRange => {
    const now = new Date();
    if (preset === '1W') return { from: toYMD(subWeeks(now, 1)), to: todayYMD };
    if (preset === '4W') return { from: toYMD(subWeeks(now, 4)), to: todayYMD };
    if (preset === '3M') return { from: toYMD(subMonths(now, 3)), to: todayYMD };
    return {
      from: customFrom ? toYMD(customFrom) : toYMD(subWeeks(now, 4)),
      to:   customTo   ? toYMD(customTo)   : todayYMD,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo]);

  // ── Query state ────────────────────────────────────────────────────────────
  const [logs,     setLogs]     = useState<SessionLog[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!resolvedConnectionId) return;
    const range = activeRange();
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      const [logsResult, scheduleResult] = await Promise.all([
        supabase
          .from('athlete_session_logs')
          .select('id, date, session_id, session_name, borg_rating, duration_seconds, completed_at, sets_logged')
          .eq('athlete_connection_id', resolvedConnectionId)
          .gte('date', range.from)
          .lte('date', range.to),
        supabase
          .from('athlete_schedule')
          .select('date, sessions, intensity')
          .eq('athlete_connection_id', resolvedConnectionId)
          .gte('date', range.from)
          .lte('date', range.to),
      ]);
      if (!cancelled) {
        setLogs((logsResult.data ?? []) as SessionLog[]);
        setSchedule((scheduleResult.data ?? []) as ScheduleRow[]);
        setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [resolvedConnectionId, activeRange]);

  // ── Derived — completed sessions only ─────────────────────────────────────
  const completedLogs = logs.filter((l) => l.completed_at !== null);

  const range = activeRange();
  const buckets = bucketsInRange(range.from, range.to, granularity);
  const bucketLabelMap = new Map<string, string>(
    buckets.map((b) => [bucketLabel(b, granularity), bucketTooltipLabel(b, granularity)])
  );

  const scheduleByDate = new Map<string, ScheduleRow>(schedule.map((r) => [r.date, r]));

  function getPlannedIntensity(log: SessionLog): string | null {
    const schedRow = scheduleByDate.get(log.date);
    if (!schedRow) return null;
    if (schedRow.sessions && log.session_id) {
      const match = schedRow.sessions.find((s) => s.id === log.session_id);
      if (match?.intensity) return match.intensity;
    }
    return schedRow.intensity;
  }

  const loadData = buckets.map((bucketStart) => {
    const end = bucketEnd(bucketStart, granularity);
    const inBucket = completedLogs.filter((l) =>
      isWithinInterval(parseISO(l.date), { start: bucketStart, end })
    );
    const au_actual  = inBucket.reduce((s, l) => s + computeSRPE(l), 0);
    const au_planned = inBucket.reduce((s, l) => {
      const p = computePlannedSRPE(l, getPlannedIntensity(l));
      return s + (p ?? 0);
    }, 0);
    return { label: bucketLabel(bucketStart, granularity), au_actual, au_planned };
  });

  const plannedCount   = schedule.reduce((s, r) => s + (r.sessions?.length ?? 0), 0);
  const completedCount = completedLogs.length;
  const adherencePct   = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;
  const isEmpty = completedLogs.length === 0 && schedule.length === 0;

  // ── Training Stimulus — series state ─────────────────────────────────────
  const [stimulusSeries, setStimulusSeries] = useState<ChartSeries[]>(() => {
    try {
      const saved = localStorage.getItem(`stimulus_series_${athleteId}`);
      return saved ? (JSON.parse(saved) as ChartSeries[]) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(`stimulus_series_${athleteId}`, JSON.stringify(stimulusSeries));
  }, [stimulusSeries, athleteId]);

  // ── Series picker state ───────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [pickerType, setPickerType]       = useState<'training' | 'performance'>('training');
  const [pickerMethod, setPickerMethod]   = useState('');
  const [pickerParam, setPickerParam]     = useState('');
  const [pickerAgg, setPickerAgg]         = useState<AggregationMode>('sum');
  const [pickerPerfId, setPickerPerfId]   = useState('');

  // ── Fallback: (date, sessionIdx, exerciseName) → methodKey from schedule ──
  // Used for historical logs that predate the methodId field in sets_logged.
  const scheduleMethodLookup = useMemo(() => {
    // key: `${date}|${sessionIdx}|${exerciseName}` → methodKey
    const map = new Map<string, string>();
    for (const row of schedule) {
      if (!row.sessions) continue;
      row.sessions.forEach((sess, idx) => {
        for (const ex of sess.exercises ?? []) {
          if (!ex.name || !ex.methodKey) continue;
          map.set(`${row.date}|${idx}|${ex.name}`, ex.methodKey);
        }
      });
    }
    return map;
  }, [schedule]);

  /** Resolve methodId for a log entry, falling back to schedule lookup. */
  function resolveMethodId(
    entry: ExerciseLogEntry,
    logDate: string,
    sessionIdx: number,
  ): string | undefined {
    if (entry.methodId) return entry.methodId;
    const name = entry.exerciseName;
    if (!name) return undefined;
    return scheduleMethodLookup.get(`${logDate}|${sessionIdx}|${name}`);
  }

  // ── Discover available method/param combos from loaded logs ───────────────
  const discoveredTrainingParams = useMemo(() => {
    // methodId → Set<paramName>
    const map = new Map<string, Set<string>>();
    for (const log of logs) {
      if (!log.completed_at) continue;
      // Infer session index from session_id suffix (format: assignmentId-date-idx)
      const sessionIdx = log.session_id
        ? parseInt(log.session_id.split('-').pop() ?? '0', 10) || 0
        : 0;
      const entries = parseExerciseEntries(log.sets_logged);
      for (const entry of entries) {
        if (entry.isCircuit) continue;
        const methodId = resolveMethodId(entry, log.date, sessionIdx);
        if (!methodId) continue;
        if (!map.has(methodId)) map.set(methodId, new Set());
        for (const set of entry.sets ?? []) {
          if (!set.completed) continue;
          for (const paramName of Object.keys(set.values)) {
            map.get(methodId)!.add(paramName);
          }
        }
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, scheduleMethodLookup]);

  // ── Compute stimulus chart data ───────────────────────────────────────────
  const stimulusChartData = useMemo(() => {
    if (stimulusSeries.length === 0) return [];

    return buckets.map((bucketStart) => {
      const end = bucketEnd(bucketStart, granularity);
      const inBucket = completedLogs.filter((l) =>
        isWithinInterval(parseISO(l.date), { start: bucketStart, end })
      );

      const point: Record<string, number | null | string> = {
        label: bucketLabel(bucketStart, granularity),
      };

      for (const series of stimulusSeries) {
        if (series.type === 'training') {
          const allValues: number[] = [];
          for (const log of inBucket) {
            const sessionIdx = log.session_id
              ? parseInt(log.session_id.split('-').pop() ?? '0', 10) || 0
              : 0;
            const entries = parseExerciseEntries(log.sets_logged);
            for (const entry of entries) {
              if (entry.isCircuit) continue;
              const methodId = resolveMethodId(entry, log.date, sessionIdx);
              if (methodId !== series.methodId) continue;
              for (const set of entry.sets ?? []) {
                if (!set.completed) continue;
                const raw = set.values[series.paramName];
                if (raw === undefined) continue;
                const num = parseFloat(raw);
                if (!isNaN(num)) allValues.push(num);
              }
            }
          }
          if (allValues.length === 0) {
            point[series.id] = null;
          } else if (series.aggregation === 'sum') {
            point[series.id] = allValues.reduce((a, b) => a + b, 0);
          } else if (series.aggregation === 'mean') {
            point[series.id] = Math.round((allValues.reduce((a, b) => a + b, 0) / allValues.length) * 10) / 10;
          } else {
            point[series.id] = Math.max(...allValues);
          }
        } else {
          // Performance parameter — most recent value recorded up to bucket end
          const perfParam = performanceParameters.find(
            (p) => p.athleticismParameterId === series.athleticismParameterId
          );
          if (!perfParam) { point[series.id] = null; continue; }
          const endYMD = toYMD(end);
          const before = perfParam.values.filter((v) => v.recordedAt <= endYMD);
          if (before.length === 0) { point[series.id] = null; continue; }
          const latest = [...before].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
          const num = parseFloat(latest.value);
          point[series.id] = isNaN(num) ? null : num;
        }
      }

      return point;
    });
  }, [buckets, completedLogs, stimulusSeries, granularity, performanceParameters, logs]);

  const seriesMap = useMemo(
    () => new Map(stimulusSeries.map((s) => [s.id, s])),
    [stimulusSeries]
  );

  const hasPerformanceSeries = stimulusSeries.some((s) => s.type === 'performance');

  // ── Overview (small-multiples) state ─────────────────────────────────────

  const [overviewPanels, setOverviewPanels] = useState<OverviewMethodPanel[]>(() => {
    try { return JSON.parse(localStorage.getItem(`ov_panels_${athleteId}`) ?? '[]'); } catch { return []; }
  });
  const [overviewPerf, setOverviewPerf] = useState<OverviewPerfSeries[]>(() => {
    try { return JSON.parse(localStorage.getItem(`ov_perf_${athleteId}`) ?? '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(`ov_panels_${athleteId}`, JSON.stringify(overviewPanels)); }, [overviewPanels, athleteId]);
  useEffect(() => { localStorage.setItem(`ov_perf_${athleteId}`, JSON.stringify(overviewPerf)); }, [overviewPerf, athleteId]);

  // Overview picker state
  const [ovPickerOpen, setOvPickerOpen]     = useState(false);
  const [ovPickerMode, setOvPickerMode]     = useState<'method' | 'performance'>('method');
  const [ovPickerMethod, setOvPickerMethod] = useState('');
  const [ovPickerParam, setOvPickerParam]   = useState('');
  const [ovPickerAgg, setOvPickerAgg]       = useState<AggregationMode>('sum');
  const [ovPickerPerfId, setOvPickerPerfId] = useState('');

  /** Resolve first known unit for (methodId, paramName) from loaded logs' plannedParams */
  function resolveParamUnit(methodId: string, paramName: string): string | undefined {
    for (const log of completedLogs) {
      const entries = parseExerciseEntries(log.sets_logged);
      for (const entry of entries) {
        if (entry.methodId !== methodId) continue;
        const unit = entry.plannedParams?.[`${paramName}_unit`];
        if (unit) return unit;
      }
    }
    return undefined;
  }

  // Overview panel chart data: panelId → [{label, value}]
  const overviewPanelData = useMemo(() => {
    const result = new Map<string, Array<{ label: string; value: number | null }>>();
    for (const panel of overviewPanels) {
      const points = buckets.map((bucketStart) => {
        const end = bucketEnd(bucketStart, granularity);
        const inBucket = completedLogs.filter((l) =>
          isWithinInterval(parseISO(l.date), { start: bucketStart, end })
        );
        const allValues: number[] = [];
        for (const log of inBucket) {
          const sessionIdx = log.session_id
            ? parseInt(log.session_id.split('-').pop() ?? '0', 10) || 0 : 0;
          const entries = parseExerciseEntries(log.sets_logged);
          for (const entry of entries) {
            if (entry.isCircuit) continue;
            const methodId = resolveMethodId(entry, log.date, sessionIdx);
            if (methodId !== panel.methodId) continue;
            for (const set of entry.sets ?? []) {
              if (!set.completed) continue;
              const raw = set.values[panel.paramName];
              if (raw === undefined) continue;
              const num = parseFloat(raw);
              if (!isNaN(num)) allValues.push(num);
            }
          }
        }
        let value: number | null = null;
        if (allValues.length > 0) {
          if (panel.aggregation === 'sum') value = allValues.reduce((a, b) => a + b, 0);
          else if (panel.aggregation === 'mean') value = Math.round((allValues.reduce((a, b) => a + b, 0) / allValues.length) * 10) / 10;
          else value = Math.max(...allValues);
        }
        return { label: bucketLabel(bucketStart, granularity), value };
      });
      result.set(panel.id, points);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewPanels, buckets, completedLogs, granularity, logs, scheduleMethodLookup]);

  // Overview performance data: [{label, [seriesId]: value}]
  const overviewPerfData = useMemo(() => {
    if (overviewPerf.length === 0) return [];
    return buckets.map((bucketStart) => {
      const end = bucketEnd(bucketStart, granularity);
      const point: Record<string, number | null | string> = { label: bucketLabel(bucketStart, granularity) };
      for (const s of overviewPerf) {
        const perfParam = performanceParameters.find((p) => p.athleticismParameterId === s.athleticismParameterId);
        if (!perfParam) { point[s.id] = null; continue; }
        const endYMD = toYMD(end);
        const before = perfParam.values.filter((v) => v.recordedAt <= endYMD);
        if (before.length === 0) { point[s.id] = null; continue; }
        const latest = [...before].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
        const num = parseFloat(latest.value);
        point[s.id] = isNaN(num) ? null : num;
      }
      return point;
    });
  }, [overviewPerf, buckets, granularity, performanceParameters]);

  function addOverviewPanel() {
    if (!ovPickerMethod || !ovPickerParam) return;
    if (overviewPanels.some((p) => p.methodId === ovPickerMethod && p.paramName === ovPickerParam && p.aggregation === ovPickerAgg)) return;
    const usedColors = new Set([...overviewPanels.map((p) => p.color), ...overviewPerf.map((s) => s.color)]);
    const color = SERIES_COLORS.find((c) => !usedColors.has(c)) ?? SERIES_COLORS[overviewPanels.length % SERIES_COLORS.length];
    const unit = resolveParamUnit(ovPickerMethod, ovPickerParam);
    setOverviewPanels((prev) => [...prev, {
      id: `ov_${Date.now()}`,
      methodId: ovPickerMethod,
      methodLabel: ovPickerMethod,
      paramName: ovPickerParam,
      aggregation: ovPickerAgg,
      unit,
      color,
    }]);
    setOvPickerOpen(false);
  }

  function addOverviewPerf() {
    if (!ovPickerPerfId) return;
    if (overviewPerf.some((s) => s.athleticismParameterId === ovPickerPerfId)) return;
    const usedColors = new Set([...overviewPanels.map((p) => p.color), ...overviewPerf.map((s) => s.color)]);
    const color = SERIES_COLORS.find((c) => !usedColors.has(c)) ?? SERIES_COLORS[overviewPerf.length % SERIES_COLORS.length];
    const def = parametersV2.find((p) => p.id === ovPickerPerfId);
    setOverviewPerf((prev) => [...prev, {
      id: `ov_p_${Date.now()}`,
      athleticismParameterId: ovPickerPerfId,
      paramName: def?.name ?? ovPickerPerfId,
      unit: def?.unit,
      color,
    }]);
    setOvPickerOpen(false);
  }

  const ovPickerParams = ovPickerMethod
    ? Array.from(discoveredTrainingParams.get(ovPickerMethod) ?? []).sort()
    : [];

  const canAddOverview = ovPickerMode === 'method'
    ? !!ovPickerMethod && !!ovPickerParam
    : !!ovPickerPerfId;

  // ── Series picker helpers ─────────────────────────────────────────────────

  function openPicker() {
    setPickerType('training');
    setPickerMethod('');
    setPickerParam('');
    setPickerAgg('sum');
    setPickerPerfId('');
    setPickerOpen(true);
  }

  const pickerMethodParams = pickerMethod
    ? Array.from(discoveredTrainingParams.get(pickerMethod) ?? []).sort()
    : [];

  function addSeries() {
    const usedColors = new Set(stimulusSeries.map((s) => s.color));
    const color = SERIES_COLORS.find((c) => !usedColors.has(c)) ?? SERIES_COLORS[stimulusSeries.length % SERIES_COLORS.length];

    if (pickerType === 'training') {
      if (!pickerMethod || !pickerParam) return;
      // Prevent duplicate
      if (stimulusSeries.some(
        (s) => s.type === 'training' && s.methodId === pickerMethod && s.paramName === pickerParam && s.aggregation === pickerAgg
      )) return;
      const newSeries: TrainingSeries = {
        id: `tr_${Date.now()}`,
        type: 'training',
        methodId: pickerMethod,
        methodLabel: pickerMethod,
        paramName: pickerParam,
        aggregation: pickerAgg,
        color,
      };
      setStimulusSeries((prev) => [...prev, newSeries]);
    } else {
      if (!pickerPerfId) return;
      if (stimulusSeries.some((s) => s.type === 'performance' && s.athleticismParameterId === pickerPerfId)) return;
      const paramDef = parametersV2.find((p) => p.id === pickerPerfId);
      const newSeries: PerformanceSeries = {
        id: `perf_${Date.now()}`,
        type: 'performance',
        athleticismParameterId: pickerPerfId,
        paramName: paramDef?.name ?? pickerPerfId,
        unit: paramDef?.unit,
        color,
      };
      setStimulusSeries((prev) => [...prev, newSeries]);
    }
    setPickerOpen(false);
  }

  function removeSeries(id: string) {
    setStimulusSeries((prev) => prev.filter((s) => s.id !== id));
  }

  const canAddSeries = pickerType === 'training'
    ? !!pickerMethod && !!pickerParam
    : !!pickerPerfId;

  const availablePerfParams = performanceParameters
    .map((pp) => {
      const def = parametersV2.find((p) => p.id === pp.athleticismParameterId);
      return { id: pp.athleticismParameterId, name: def?.name ?? pp.athleticismParameterId, unit: def?.unit };
    })
    .filter((p) => p.name);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-1 pr-4">

        {/* ── Controls row ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {(['1W', '4W', '3M'] as Preset[]).map((p) => (
              <Button key={p} size="sm" variant={preset === p ? 'default' : 'outline'} onClick={() => setPreset(p)}>
                {p}
              </Button>
            ))}
            <Button size="sm" variant={preset === 'Custom' ? 'default' : 'outline'} onClick={() => setPreset('Custom')}>
              Custom
            </Button>
          </div>

          {preset === 'Custom' && (
            <CalendarRangePicker
              from={customFrom}
              to={customTo}
              onChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
              onClear={() => { setCustomFrom(subWeeks(today, 4)); setCustomTo(today); }}
            />
          )}

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground mr-1">View by</span>
            {(['day', 'week', 'month', 'year'] as Granularity[]).map((g) => (
              <Button
                key={g} size="sm"
                variant={granularity === g ? 'secondary' : 'ghost'}
                className="h-7 px-2 text-xs capitalize"
                onClick={() => setGranularity(g)}
              >
                {g}
              </Button>
            ))}
          </div>
        </div>

        {!resolvedConnectionId && (
          <p className="text-sm text-muted-foreground">
            No athlete app connection found. Analysis data is only available once an app account is created.
          </p>
        )}

        {resolvedConnectionId && loading && <LoadingState />}

        {resolvedConnectionId && !loading && isEmpty && (
          <EmptyState label="No completed session data for this period." />
        )}

        {resolvedConnectionId && !loading && !isEmpty && (
          <>
            {/* ── Panel 1 — Internal Load ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base capitalize">
                    Internal Load — sRPE per {granularity}
                  </CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      id="show-planned-load"
                      checked={showPlannedLoad}
                      onCheckedChange={setShowPlannedLoad}
                    />
                    <Label htmlFor="show-planned-load" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                      Show planned
                    </Label>
                  </div>
                </div>
                {showPlannedLoad && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Planned = planned intensity × actual session duration — same denominator as actual sRPE.
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {loadData.every((b) => b.au_actual === 0) ? (
                  <EmptyState label="No completed sessions with RPE ratings in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={loadData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval={granularity === 'day' && buckets.length > 14 ? Math.ceil(buckets.length / 14) - 1 : 0}
                      />
                      <YAxis tick={{ fontSize: 12 }} unit=" AU" width={60} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} AU`,
                          name === 'au_actual' ? 'Actual sRPE' : 'Planned sRPE',
                        ]}
                        labelFormatter={(label: string) => bucketLabelMap.get(label) ?? label}
                      />
                      {showPlannedLoad && (
                        <Legend
                          formatter={(value) => value === 'au_actual' ? 'Actual sRPE' : 'Planned sRPE'}
                          wrapperStyle={{ fontSize: 12 }}
                        />
                      )}
                      <Bar dataKey="au_actual" name="au_actual" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      {showPlannedLoad && (
                        <Bar dataKey="au_planned" name="au_planned" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[3, 3, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* ── Panel 2 — Adherence ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Adherence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">{completedCount} / {plannedCount}</span>
                    <span className="text-muted-foreground"> sessions completed</span>
                    {plannedCount > 0 && <span className="font-medium ml-2">{adherencePct}%</span>}
                  </p>
                  {plannedCount > 0 && <Progress value={adherencePct} className="h-2" />}
                </div>
              </CardContent>
            </Card>

            {/* ── Panel 3 — Stimulus Overview (small multiples) ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Stimulus Overview</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      One panel per method — shared time axis — with performance outcomes below.
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs px-2"
                      onClick={() => { setOvPickerMode('method'); setOvPickerMethod(''); setOvPickerParam(''); setOvPickerAgg('sum'); setOvPickerOpen(true); }}>
                      <Plus className="h-3 w-3" /> Method
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs px-2"
                      onClick={() => { setOvPickerMode('performance'); setOvPickerPerfId(''); setOvPickerOpen(true); }}>
                      <Plus className="h-3 w-3" /> Outcome
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                {overviewPanels.length === 0 && overviewPerf.length === 0 ? (
                  <EmptyState label='Add method panels and performance outcomes to build the overview.' />
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    {overviewPanels.map((panel, idx) => (
                      <MiniMethodPanel
                        key={panel.id}
                        panel={panel}
                        data={overviewPanelData.get(panel.id) ?? []}
                        bucketLabelMap={bucketLabelMap}
                        showXAxis={idx === overviewPanels.length - 1 && overviewPerf.length === 0}
                        onRemove={() => setOverviewPanels((prev) => prev.filter((p) => p.id !== panel.id))}
                      />
                    ))}
                    {overviewPerf.length > 0 && (
                      <div className="border-t">
                        <OverviewPerfPanel
                          series={overviewPerf}
                          data={overviewPerfData}
                          bucketLabelMap={bucketLabelMap}
                          onRemoveSeries={(id) => setOverviewPerf((prev) => prev.filter((s) => s.id !== id))}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Panel 4 — Training Stimulus (focused single chart) ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Training Stimulus</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Overlay training parameters (by method) and performance markers in one chart.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={openPicker}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Series
                  </Button>
                </div>

                {/* Active series chips */}
                {stimulusSeries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {stimulusSeries.map((s) => (
                      <Badge
                        key={s.id}
                        variant="outline"
                        className="gap-1.5 pl-2 pr-1 py-0.5 text-xs font-normal"
                        style={{ borderColor: s.color, color: s.color }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: s.color }}
                        />
                        {seriesLabel(s)}
                        <button
                          onClick={() => removeSeries(s.id)}
                          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>

              <CardContent>
                {stimulusSeries.length === 0 ? (
                  <EmptyState label='Click "Add Series" to plot training parameters or performance markers.' />
                ) : stimulusChartData.every((d) =>
                    stimulusSeries.every((s) => d[s.id] == null)
                  ) ? (
                  <EmptyState label="No data found for the selected series in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={stimulusChartData} margin={{ top: 4, right: hasPerformanceSeries ? 48 : 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval={granularity === 'day' && buckets.length > 14 ? Math.ceil(buckets.length / 14) - 1 : 0}
                      />
                      {/* Left axis — training params */}
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11 }}
                        width={48}
                        tickFormatter={(v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1)}
                      />
                      {/* Right axis — performance params (only if any) */}
                      {hasPerformanceSeries && (
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 11 }}
                          width={48}
                          tickFormatter={(v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1)}
                        />
                      )}
                      <Tooltip
                        content={
                          <CustomTooltip
                            bucketLabelMap={bucketLabelMap}
                            seriesMap={seriesMap}
                          />
                        }
                      />
                      <Legend
                        formatter={(_value, entry) => {
                          const s = seriesMap.get(entry.dataKey as string);
                          return s ? seriesLabel(s) : entry.dataKey;
                        }}
                        wrapperStyle={{ fontSize: 11 }}
                      />
                      {stimulusSeries.map((s) =>
                        s.type === 'training' ? (
                          <Bar
                            key={s.id}
                            dataKey={s.id}
                            yAxisId="left"
                            fill={s.color}
                            radius={[3, 3, 0, 0]}
                            maxBarSize={40}
                            name={s.id}
                          />
                        ) : (
                          <Line
                            key={s.id}
                            dataKey={s.id}
                            yAxisId="right"
                            stroke={s.color}
                            strokeWidth={2}
                            dot={{ fill: s.color, r: 4, strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                            connectNulls={false}
                            type="monotone"
                            name={s.id}
                          />
                        )
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Overview picker dialog ── */}
      <Dialog open={ovPickerOpen} onOpenChange={(o) => !o && setOvPickerOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {ovPickerMode === 'method' ? 'Add Method Panel' : 'Add Performance Outcome'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {ovPickerMode === 'method' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  {discoveredTrainingParams.size === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">
                      No logged sessions with method data found in this period.
                    </p>
                  ) : (
                    <Select value={ovPickerMethod} onValueChange={(v) => { setOvPickerMethod(v); setOvPickerParam(''); }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select method…" /></SelectTrigger>
                      <SelectContent>
                        {Array.from(discoveredTrainingParams.keys()).sort().map((m) => (
                          <SelectItem key={m} value={m}>
                            {stripMethodSuffix(m)}
                            {m.includes('::') && <span className="text-muted-foreground ml-1 text-xs">({m.split('::')[1]})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {ovPickerMethod && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Parameter to display</Label>
                    <Select value={ovPickerParam} onValueChange={setOvPickerParam}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select parameter…" /></SelectTrigger>
                      <SelectContent>
                        {ovPickerParams.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {ovPickerParam && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Aggregation per {granularity}</Label>
                    <div className="flex gap-2">
                      {(['sum', 'mean', 'max'] as AggregationMode[]).map((a) => (
                        <Button key={a} size="sm" variant={ovPickerAgg === a ? 'default' : 'outline'}
                          className="flex-1 capitalize" onClick={() => setOvPickerAgg(a)}>
                          {a === 'sum' ? 'Sum Σ' : a === 'mean' ? 'Mean Ø' : 'Max'}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {ovPickerMode === 'performance' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Performance Parameter</Label>
                {availablePerfParams.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    No performance parameters tracked for this athlete yet.
                  </p>
                ) : (
                  <Select value={ovPickerPerfId} onValueChange={setOvPickerPerfId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select parameter…" /></SelectTrigger>
                    <SelectContent>
                      {availablePerfParams.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOvPickerOpen(false)}>Cancel</Button>
            <Button
              onClick={ovPickerMode === 'method' ? addOverviewPanel : addOverviewPerf}
              disabled={!canAddOverview}
            >
              {ovPickerMode === 'method' ? 'Add Panel' : 'Add Outcome'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Series picker dialog ── */}
      <Dialog open={pickerOpen} onOpenChange={(o) => !o && setPickerOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Series</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Type toggle */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={pickerType === 'training' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => { setPickerType('training'); setPickerPerfId(''); }}
              >
                Training Parameter
              </Button>
              <Button
                size="sm"
                variant={pickerType === 'performance' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => { setPickerType('performance'); setPickerMethod(''); setPickerParam(''); }}
              >
                Performance Marker
              </Button>
            </div>

            {pickerType === 'training' && (
              <>
                {/* Method */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  {discoveredTrainingParams.size === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">
                      No logged sessions with method data found in this period.
                    </p>
                  ) : (
                    <Select
                      value={pickerMethod}
                      onValueChange={(v) => { setPickerMethod(v); setPickerParam(''); }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select method…" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(discoveredTrainingParams.keys()).sort().map((m) => (
                          <SelectItem key={m} value={m}>
                            {stripMethodSuffix(m)}
                            {m.includes('::') && (
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({m.split('::')[1]})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Parameter */}
                {pickerMethod && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Parameter</Label>
                    <Select value={pickerParam} onValueChange={setPickerParam}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select parameter…" />
                      </SelectTrigger>
                      <SelectContent>
                        {pickerMethodParams.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Aggregation */}
                {pickerParam && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Aggregation per {granularity}</Label>
                    <div className="flex gap-2">
                      {(['sum', 'mean', 'max'] as AggregationMode[]).map((a) => (
                        <Button
                          key={a}
                          size="sm"
                          variant={pickerAgg === a ? 'default' : 'outline'}
                          className="flex-1 capitalize"
                          onClick={() => setPickerAgg(a)}
                        >
                          {a === 'sum' ? 'Sum Σ' : a === 'mean' ? 'Mean Ø' : 'Max'}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pickerAgg === 'sum'
                        ? `Total ${pickerParam} across all sets & exercises for this method per ${granularity}.`
                        : pickerAgg === 'mean'
                        ? `Average ${pickerParam} per set for this method per ${granularity}.`
                        : `Highest ${pickerParam} value recorded in a single set per ${granularity}.`}
                    </p>
                  </div>
                )}
              </>
            )}

            {pickerType === 'performance' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Performance Parameter</Label>
                {availablePerfParams.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    No performance parameters tracked for this athlete yet.
                  </p>
                ) : (
                  <Select value={pickerPerfId} onValueChange={setPickerPerfId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select parameter…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePerfParams.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.unit ? ` (${p.unit})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Shows the most recent recorded value per {granularity} — plotted on the right Y-axis.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={addSeries} disabled={!canAddSeries}>Add Series</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
