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
import { CalendarIcon, X, Plus, Download } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { exportAnalysisXLSX, type RawSessionLogForExport } from '@/utils/xlsxExport';
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

// ── AI Analysis system prompt ─────────────────────────────────────────────────

// ── Series colours ────────────────────────────────────────────────────────────

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
  comment: string | null;
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

type Preset = '7d' | '28d' | '3M' | 'custom';
type Granularity = 'day' | 'week' | 'month' | 'year';
type CalendarPhase = 'start' | 'end';
type AggregationMode = 'sum' | 'mean' | 'max' | 'none';

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

/** Format a number for display: strips trailing zeros but keeps up to 2 decimal places. */
function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  // toFixed(2) then drop trailing zeros: 10.7 → "10.7", 10.70 → "10.7", 10.00 → "10"
  return parseFloat(v.toFixed(2)).toString();
}

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
  return (
    <div className="group border-b last:border-b-0">
      {/* Label row — own div so chart gets full height */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-0.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: panel.color }} />
        <span className="text-[11px] font-semibold text-foreground/80 leading-none truncate flex-1">
          {stripMethodSuffix(panel.methodLabel)}
          <span className="text-[10px] font-normal text-muted-foreground/70 ml-1.5">
            {paramLabel}
          </span>
        </span>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-0.5 rounded shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <ResponsiveContainer width="100%" height={showXAxis ? 120 : 100}>
        <ComposedChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: showXAxis ? 4 : 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.11)" />
          {showXAxis && (
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
          )}
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={38}
            tickCount={4}
            domain={['auto', 'auto']}
            tickFormatter={fmtNum}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number) => [fmtNum(v), paramLabel]}
            labelFormatter={(l: string) => bucketLabelMap.get(l) ?? l}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Line
            dataKey="value"
            stroke={panel.color}
            strokeWidth={2}
            dot={{ fill: panel.color, r: 3.5, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls={true}
            type="monotone"
          />
        </ComposedChart>
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
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.11)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 9 }}
            width={38}
            tickCount={4}
            domain={['auto', 'auto']}
            tickFormatter={fmtNum}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number, _name: string, entry: { dataKey?: string }) => {
              const s = series.find((x) => x.id === entry.dataKey);
              return [fmtNum(v), s ? `${s.paramName}${s.unit ? ` (${s.unit})` : ''}` : ''];
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
              dot={{ fill: s.color, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls={true}
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
  athleteName?: string;
  performanceParameters?: AthletePerformanceParameter[];
  parametersV2?: ParameterV2[];
}

export function AthleteAnalysisTab({
  athleteId,
  connectionId: connectionIdProp,
  athleteName = 'Athlete',
  performanceParameters = [],
  parametersV2 = [],
}: AthleteAnalysisTabProps) {
  const { getConnectionForAthlete } = useAthleteConnections();
  const resolvedConnectionId = connectionIdProp || getConnectionForAthlete(athleteId)?.id || null;

  // ── Self-reported test results (from athlete app → Supabase) ──────────────
  // Keyed by athleticismParameterId → ParameterValue[], mirroring AthletePerformanceTab.
  const [selfReportedMap, setSelfReportedMap] = useState<Map<string, import('@/types/athlete').ParameterValue[]>>(new Map());
  useEffect(() => {
    if (!resolvedConnectionId) return;
    supabase
      .from('athlete_test_results')
      .select('id, parameter_id, value, recorded_at, note')
      .eq('athlete_connection_id', resolvedConnectionId)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, import('@/types/athlete').ParameterValue[]>();
        for (const row of data as Array<{ id: string; parameter_id: string; value: string; recorded_at: string; note: string | null }>) {
          const existing = map.get(row.parameter_id) ?? [];
          existing.push({ id: row.id, value: row.value, recordedAt: row.recorded_at, selfReported: true, note: row.note ?? undefined });
          map.set(row.parameter_id, existing);
        }
        setSelfReportedMap(map);
      });
  }, [resolvedConnectionId]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const today = new Date();
  const todayYMD = toYMD(today);

  // Internal Load section controls
  const [loadPreset, setLoadPreset] = useState<Preset>('28d');
  const [loadCustomFrom, setLoadCustomFrom] = useState<Date | null>(subWeeks(today, 4));
  const [loadCustomTo,   setLoadCustomTo]   = useState<Date | null>(today);
  const [loadGranularity, setLoadGranularity] = useState<Granularity>('day');
  const [showPlannedLoad, setShowPlannedLoad] = useState(false);

  // Stimulus & Performance section controls (independent)
  const [ovPreset, setOvPreset] = useState<Preset>('28d');
  const [ovCustomFrom, setOvCustomFrom] = useState<Date | null>(subWeeks(today, 4));
  const [ovCustomTo,   setOvCustomTo]   = useState<Date | null>(today);
  const [ovGranularity, setOvGranularity] = useState<Granularity>('day');

  const loadRange = useCallback((): DateRange => {
    const now = new Date();
    if (loadPreset === '7d')  return { from: toYMD(subWeeks(now, 1)),  to: todayYMD };
    if (loadPreset === '28d') return { from: toYMD(subWeeks(now, 4)),  to: todayYMD };
    if (loadPreset === '3M')  return { from: toYMD(subMonths(now, 3)), to: todayYMD };
    return {
      from: loadCustomFrom ? toYMD(loadCustomFrom) : toYMD(subWeeks(now, 4)),
      to:   loadCustomTo   ? toYMD(loadCustomTo)   : todayYMD,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPreset, loadCustomFrom, loadCustomTo]);

  const ovRange = useCallback((): DateRange => {
    const now = new Date();
    if (ovPreset === '7d')  return { from: toYMD(subWeeks(now, 1)),  to: todayYMD };
    if (ovPreset === '28d') return { from: toYMD(subWeeks(now, 4)),  to: todayYMD };
    if (ovPreset === '3M')  return { from: toYMD(subMonths(now, 3)), to: todayYMD };
    return {
      from: ovCustomFrom ? toYMD(ovCustomFrom) : toYMD(subWeeks(now, 4)),
      to:   ovCustomTo   ? toYMD(ovCustomTo)   : todayYMD,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ovPreset, ovCustomFrom, ovCustomTo]);

  // ── Query state — Load section ─────────────────────────────────────────────
  const [loadLogs,    setLoadLogs]    = useState<SessionLog[]>([]);
  const [schedule,    setSchedule]    = useState<ScheduleRow[]>([]);
  const [loadLoading, setLoadLoading] = useState(false);

  useEffect(() => {
    if (!resolvedConnectionId) return;
    const r = loadRange();
    let cancelled = false;
    async function fetchLoad() {
      setLoadLoading(true);
      const [logsResult, scheduleResult] = await Promise.all([
        supabase
          .from('athlete_session_logs')
          .select('id, date, session_id, session_name, borg_rating, duration_seconds, completed_at, comment, sets_logged')
          .eq('athlete_connection_id', resolvedConnectionId)
          .gte('date', r.from).lte('date', r.to),
        supabase
          .from('athlete_schedule')
          .select('date, sessions, intensity')
          .eq('athlete_connection_id', resolvedConnectionId)
          .gte('date', r.from).lte('date', r.to),
      ]);
      if (!cancelled) {
        setLoadLogs((logsResult.data ?? []) as SessionLog[]);
        setSchedule((scheduleResult.data ?? []) as ScheduleRow[]);
        setLoadLoading(false);
      }
    }
    fetchLoad();
    return () => { cancelled = true; };
  }, [resolvedConnectionId, loadRange]);

  // ── Query state — Stimulus section ────────────────────────────────────────
  const [ovLogs,    setOvLogs]    = useState<SessionLog[]>([]);
  const [ovLoading, setOvLoading] = useState(false);

  useEffect(() => {
    if (!resolvedConnectionId) return;
    const r = ovRange();
    let cancelled = false;
    async function fetchOv() {
      setOvLoading(true);
      const { data } = await supabase
        .from('athlete_session_logs')
        .select('id, date, session_id, session_name, borg_rating, duration_seconds, completed_at, comment, sets_logged')
        .eq('athlete_connection_id', resolvedConnectionId)
        .gte('date', r.from).lte('date', r.to);
      if (!cancelled) {
        setOvLogs((data ?? []) as SessionLog[]);
        setOvLoading(false);
      }
    }
    fetchOv();
    return () => { cancelled = true; };
  }, [resolvedConnectionId, ovRange]);

  // ── Derived — Load section ─────────────────────────────────────────────────
  const completedLoadLogs = loadLogs.filter((l) => l.completed_at !== null);

  const lRange = loadRange();
  const loadBuckets = bucketsInRange(lRange.from, lRange.to, loadGranularity);
  const loadBucketLabelMap = new Map<string, string>(
    loadBuckets.map((b) => [bucketLabel(b, loadGranularity), bucketTooltipLabel(b, loadGranularity)])
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

  const loadData = loadBuckets.map((bucketStart) => {
    const end = bucketEnd(bucketStart, loadGranularity);
    const inBucket = completedLoadLogs.filter((l) =>
      isWithinInterval(parseISO(l.date), { start: bucketStart, end })
    );
    const au_actual  = inBucket.reduce((s, l) => s + computeSRPE(l), 0);
    const au_planned = inBucket.reduce((s, l) => {
      const p = computePlannedSRPE(l, getPlannedIntensity(l));
      return s + (p ?? 0);
    }, 0);
    return { label: bucketLabel(bucketStart, loadGranularity), au_actual, au_planned };
  });

  // 14-day (daily) or 2-bucket (weekly) moving average of actual sRPE load
  const maWindow = loadGranularity === 'day' ? 14 : 2;
  const loadDataWithMA = loadData.map((point, i) => {
    const start = Math.max(0, i - maWindow + 1);
    const slice = loadData.slice(start, i + 1);
    const ma = Math.round(slice.reduce((s, d) => s + d.au_actual, 0) / slice.length);
    return { ...point, ma };
  });

  const plannedCount   = schedule.reduce((s, r) => s + (r.sessions?.length ?? 0), 0);
  const completedCount = completedLoadLogs.length;
  const adherencePct   = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;
  const loadIsEmpty = completedLoadLogs.length === 0 && schedule.length === 0;

  // ── Derived — Stimulus section ────────────────────────────────────────────
  const completedOvLogs = ovLogs.filter((l) => l.completed_at !== null);

  const oRange = ovRange();
  const ovBuckets = bucketsInRange(oRange.from, oRange.to, ovGranularity);
  const ovBucketLabelMap = new Map<string, string>(
    ovBuckets.map((b) => [bucketLabel(b, ovGranularity), bucketTooltipLabel(b, ovGranularity)])
  );

  // ── Schedule method lookup (fallback for older logs) ──────────────────────
  // Uses the load-section schedule as a hint; good enough for method-key resolution.
  const scheduleMethodLookup = useMemo(() => {
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

  function resolveMethodId(entry: ExerciseLogEntry, logDate: string, sessionIdx: number): string | undefined {
    if (entry.methodId) return entry.methodId;
    const name = entry.exerciseName;
    if (!name) return undefined;
    return scheduleMethodLookup.get(`${logDate}|${sessionIdx}|${name}`);
  }

  // ── Discover available method/param combos (uses ov range logs) ──────────
  const discoveredTrainingParams = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const log of ovLogs) {
      if (!log.completed_at) continue;
      const sessionIdx = log.session_id
        ? parseInt(log.session_id.split('-').pop() ?? '0', 10) || 0 : 0;
      const entries = parseExerciseEntries(log.sets_logged);
      for (const entry of entries) {
        if (entry.isCircuit) continue;
        const methodId = resolveMethodId(entry, log.date, sessionIdx);
        if (!methodId) continue;
        if (!map.has(methodId)) map.set(methodId, new Set());
        const completedSets = (entry.sets ?? []).filter(s => s.completed);
        // "Sets" is a synthetic parameter — count of completed sets per bucket
        if (completedSets.length > 0) map.get(methodId)!.add('Sets');
        for (const set of completedSets) {
          for (const paramName of Object.keys(set.values)) {
            map.get(methodId)!.add(paramName);
          }
        }
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ovLogs, scheduleMethodLookup]);

  // ── Stimulus & Performance state ──────────────────────────────────────────
  const [overviewPanels, setOverviewPanels] = useState<OverviewMethodPanel[]>(() => {
    try { return JSON.parse(localStorage.getItem(`ov_panels_${athleteId}`) ?? '[]'); } catch { return []; }
  });
  const [overviewPerf, setOverviewPerf] = useState<OverviewPerfSeries[]>(() => {
    try { return JSON.parse(localStorage.getItem(`ov_perf_${athleteId}`) ?? '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(`ov_panels_${athleteId}`, JSON.stringify(overviewPanels)); }, [overviewPanels, athleteId]);
  useEffect(() => { localStorage.setItem(`ov_perf_${athleteId}`, JSON.stringify(overviewPerf)); }, [overviewPerf, athleteId]);

  const [ovPickerOpen, setOvPickerOpen]     = useState(false);
  const [ovPickerMode, setOvPickerMode]     = useState<'method' | 'performance'>('method');
  const [ovPickerMethod, setOvPickerMethod] = useState('');
  const [ovPickerParam, setOvPickerParam]   = useState('');
  const [ovPickerPerfId, setOvPickerPerfId] = useState('');

  function resolveParamUnit(methodId: string, paramName: string): string | undefined {
    for (const log of completedOvLogs) {
      const entries = parseExerciseEntries(log.sets_logged);
      for (const entry of entries) {
        if (entry.methodId !== methodId) continue;
        const unit = entry.plannedParams?.[`${paramName}_unit`];
        if (unit) return unit;
      }
    }
    return undefined;
  }

  // Panel chart data (uses ov range)
  const overviewPanelData = useMemo(() => {
    const result = new Map<string, Array<{ label: string; value: number | null }>>();
    for (const panel of overviewPanels) {
      const points = ovBuckets.map((bucketStart) => {
        const end = bucketEnd(bucketStart, ovGranularity);
        const inBucket = completedOvLogs.filter((l) =>
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
            if (panel.paramName === 'Sets') {
              const n = (entry.sets ?? []).filter(s => s.completed).length;
              if (n > 0) allValues.push(n);
            } else {
              for (const set of entry.sets ?? []) {
                if (!set.completed) continue;
                const raw = set.values[panel.paramName];
                if (raw === undefined) continue;
                const num = parseFloat(raw.replace(',', '.'));
                if (!isNaN(num)) allValues.push(num);
              }
            }
          }
        }
        let value: number | null = null;
        if (allValues.length > 0)
          value = allValues.reduce((a, b) => a + b, 0);
        return { label: bucketLabel(bucketStart, ovGranularity), value };
      });
      result.set(panel.id, points);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewPanels, ovBuckets, completedOvLogs, ovGranularity, ovLogs, scheduleMethodLookup]);

  // Performance outcome data — dot only where a test was recorded within the bucket
  const overviewPerfData = useMemo(() => {
    if (overviewPerf.length === 0) return [];
    return ovBuckets.map((bucketStart) => {
      const end = bucketEnd(bucketStart, ovGranularity);
      const point: Record<string, number | null | string> = { label: bucketLabel(bucketStart, ovGranularity) };
      for (const s of overviewPerf) {
        const perfParam = performanceParameters.find((p) => p.athleticismParameterId === s.athleticismParameterId);
        // Merge coach-entered values with self-reported values from athlete app
        const coachValues = perfParam?.values ?? [];
        const srValues = selfReportedMap.get(s.athleticismParameterId) ?? [];
        const coachIds = new Set(coachValues.map((v) => v.id));
        const allValues = [...coachValues, ...srValues.filter((v) => !coachIds.has(v.id))];
        if (allValues.length === 0) { point[s.id] = null; continue; }
        const startYMD = toYMD(bucketStart);
        const endYMD   = toYMD(end);
        // Slice to 10 chars so ISO datetimes ("2024-05-15T…") compare correctly against plain dates
        const inBucket = allValues.filter(
          (v) => v.recordedAt.slice(0, 10) >= startYMD && v.recordedAt.slice(0, 10) <= endYMD
        );
        if (inBucket.length === 0) { point[s.id] = null; continue; }
        const latest = [...inBucket].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
        // Normalize comma decimal separator (e.g. "10,7" → "10.7") before parsing
        const num = parseFloat(latest.value.replace(',', '.'));
        point[s.id] = isNaN(num) ? null : num;
      }
      return point;
    });
  }, [overviewPerf, ovBuckets, ovGranularity, performanceParameters, selfReportedMap]);

  function addOverviewPanel() {
    if (!ovPickerMethod || !ovPickerParam) return;
    if (overviewPanels.some((p) => p.methodId === ovPickerMethod && p.paramName === ovPickerParam)) return;
    const usedColors = new Set([...overviewPanels.map((p) => p.color), ...overviewPerf.map((s) => s.color)]);
    const color = SERIES_COLORS.find((c) => !usedColors.has(c)) ?? SERIES_COLORS[overviewPanels.length % SERIES_COLORS.length];
    const unit = resolveParamUnit(ovPickerMethod, ovPickerParam);
    setOverviewPanels((prev) => [...prev, {
      id: `ov_${Date.now()}`,
      methodId: ovPickerMethod,
      methodLabel: ovPickerMethod,
      paramName: ovPickerParam,
      aggregation: 'sum' as AggregationMode,
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

        {!resolvedConnectionId && (
          <p className="text-sm text-muted-foreground">
            No athlete app connection found. Analysis data is only available once an app account is created.
          </p>
        )}

        {resolvedConnectionId && (
          <>
            {/* ── Export button ── */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                title="Export internal load to XLSX"
                onClick={() => exportAnalysisXLSX(loadLogs as RawSessionLogForExport[], athleteName)}
              >
                <Download className="h-3.5 w-3.5" />
                Export XLSX
              </Button>
            </div>

            {/* ── Internal Load ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base capitalize">
                      Internal Load — sRPE per {loadGranularity}
                    </CardTitle>
                    {showPlannedLoad && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Planned = planned intensity × actual session duration — same denominator as actual sRPE.
                      </p>
                    )}
                  </div>
                  {/* Load controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {(['day', 'week', 'month'] as Granularity[]).map((g) => (
                        <Button key={g} size="sm"
                          variant={loadGranularity === g ? 'secondary' : 'ghost'}
                          className="h-7 px-2 text-xs capitalize"
                          onClick={() => setLoadGranularity(g)}>{g}</Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      {(['7d', '28d', '3M'] as Preset[]).map((p) => (
                        <Button key={p} size="sm"
                          variant={loadPreset === p ? 'default' : 'outline'}
                          className="h-7 px-2 text-xs"
                          onClick={() => setLoadPreset(p)}>
                          {p === '7d' ? '7d' : p === '28d' ? '28d' : '3M'}
                        </Button>
                      ))}
                      <CalendarRangePicker
                        from={loadPreset === 'custom' ? loadCustomFrom : null}
                        to={loadPreset === 'custom' ? loadCustomTo : null}
                        onChange={(f, t) => { setLoadCustomFrom(f); setLoadCustomTo(t); setLoadPreset('custom'); }}
                        onClear={() => { setLoadPreset('28d'); setLoadCustomFrom(subWeeks(today, 4)); setLoadCustomTo(today); }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="show-planned-load" checked={showPlannedLoad} onCheckedChange={setShowPlannedLoad} />
                      <Label htmlFor="show-planned-load" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">Planned</Label>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadLoading ? <LoadingState /> : loadIsEmpty || loadData.every((b) => b.au_actual === 0) ? (
                  <EmptyState label="No completed sessions with RPE ratings in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={loadDataWithMA} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval={loadGranularity === 'day' && loadBuckets.length > 14 ? Math.ceil(loadBuckets.length / 14) - 1 : 0}
                      />
                      <YAxis tick={{ fontSize: 12 }} unit=" AU" width={60} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${Math.round(value)} AU`,
                          name === 'au_actual' ? 'Actual sRPE'
                            : name === 'au_planned' ? 'Planned sRPE'
                            : `${maWindow}-day MA`,
                        ]}
                        labelFormatter={(label: string) => loadBucketLabelMap.get(label) ?? label}
                      />
                      {showPlannedLoad && (
                        <Legend
                          formatter={(value) =>
                            value === 'au_actual' ? 'Actual sRPE'
                            : value === 'au_planned' ? 'Planned sRPE'
                            : `${maWindow}-day MA`
                          }
                          wrapperStyle={{ fontSize: 12 }}
                        />
                      )}
                      <Bar dataKey="au_actual" name="au_actual" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      {showPlannedLoad && (
                        <Bar dataKey="au_planned" name="au_planned" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[3, 3, 0, 0]} />
                      )}
                      <Line
                        dataKey="ma"
                        name="ma"
                        type="linear"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        strokeOpacity={0.55}
                        dot={false}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* ── Adherence ── */}
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

            {/* ── Stimulus & Performance ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Stimulus &amp; Performance</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      One line per training parameter — performance outcomes below on a shared time axis.
                    </p>
                  </div>
                  {/* Ov controls + add buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {(['day', 'week', 'month'] as Granularity[]).map((g) => (
                        <Button key={g} size="sm"
                          variant={ovGranularity === g ? 'secondary' : 'ghost'}
                          className="h-7 px-2 text-xs capitalize"
                          onClick={() => setOvGranularity(g)}>{g}</Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      {(['7d', '28d', '3M'] as Preset[]).map((p) => (
                        <Button key={p} size="sm"
                          variant={ovPreset === p ? 'default' : 'outline'}
                          className="h-7 px-2 text-xs"
                          onClick={() => setOvPreset(p)}>
                          {p === '7d' ? '7d' : p === '28d' ? '28d' : '3M'}
                        </Button>
                      ))}
                      <CalendarRangePicker
                        from={ovPreset === 'custom' ? ovCustomFrom : null}
                        to={ovPreset === 'custom' ? ovCustomTo : null}
                        onChange={(f, t) => { setOvCustomFrom(f); setOvCustomTo(t); setOvPreset('custom'); }}
                        onClear={() => { setOvPreset('28d'); setOvCustomFrom(subWeeks(today, 4)); setOvCustomTo(today); }}
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs px-2"
                        onClick={() => { setOvPickerMode('method'); setOvPickerMethod(''); setOvPickerParam(''); setOvPickerOpen(true); }}>
                        <Plus className="h-3 w-3" /> Method
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs px-2"
                        onClick={() => { setOvPickerMode('performance'); setOvPickerPerfId(''); setOvPickerOpen(true); }}>
                        <Plus className="h-3 w-3" /> Outcome
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                {ovLoading ? <LoadingState /> : overviewPanels.length === 0 && overviewPerf.length === 0 ? (
                  <EmptyState label="Add training method parameters and performance outcomes to build the view." />
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    {overviewPanels.map((panel, idx) => (
                      <MiniMethodPanel
                        key={panel.id}
                        panel={panel}
                        data={overviewPanelData.get(panel.id) ?? []}
                        bucketLabelMap={ovBucketLabelMap}
                        showXAxis={idx === overviewPanels.length - 1 && overviewPerf.length === 0}
                        onRemove={() => setOverviewPanels((prev) => prev.filter((p) => p.id !== panel.id))}
                      />
                    ))}
                    {overviewPerf.length > 0 && (
                      <div className="border-t">
                        <OverviewPerfPanel
                          series={overviewPerf}
                          data={overviewPerfData}
                          bucketLabelMap={ovBucketLabelMap}
                          onRemoveSeries={(id) => setOverviewPerf((prev) => prev.filter((s) => s.id !== id))}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </>
        )}
      </div>

      {/* ── Picker dialog ── */}
      <Dialog open={ovPickerOpen} onOpenChange={(o) => !o && setOvPickerOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {ovPickerMode === 'method' ? 'Add Training Method Panel' : 'Add Performance Outcome'}
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
    </ScrollArea>
  );
}
