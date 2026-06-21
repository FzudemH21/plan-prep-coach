import { useState, useMemo, useEffect } from 'react';
import { format, isWithinInterval } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertTriangle, Smile, Activity, CalendarDays, CalendarIcon, X, MessageSquare, CheckCircle, Download } from 'lucide-react';
import { exportMonitoringXLSX, type CustomBlockExport } from '@/utils/xlsxExport';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis,
  Tooltip, ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts';
import {
  FRONT_REGIONS, BACK_REGIONS,
  nrsSeverityColor, nrsSeverityStroke,
  svgRegionKey,
} from '@/lib/bodyMapData';
import {
  useAthleteCheckins,
  computeWellnessStats,
  wellnessComposite,
  zScore,
  type AthleteCheckin,
  type WellnessStats,
} from '@/hooks/useAthleteCheckins';
import { useAthleteConnections, type AthleteConnection } from '@/hooks/useAthleteConnections';
import { Athlete, MonitoringBlock, DEFAULT_MONITORING_CONFIG } from '@/types/athlete';
import { supabase } from '@/lib/supabase';

// ── Constants ──────────────────────────────────────────────────────────────────

const WELLNESS_LABELS: Record<string, string> = {
  fatigue:  'Energy',
  sleep:    'Sleep',
  soreness: 'Soreness',
  stress:   'Stress',
  mood:     'Mood',
};

const WELLNESS_ANCHORS: Record<string, [string, string, string, string, string]> = {
  fatigue:  ['Always tired', 'More tired than normal', 'Normal', 'Fresh', 'Very fresh'],
  sleep:    ['Insomnia', 'Restless sleep', 'Difficulty falling asleep', 'Good', 'Very restful'],
  soreness: ['Very sore', 'Increased soreness', 'Normal', 'Feeling good', 'Feeling great'],
  stress:   ['Highly stressed', 'Feeling stressed', 'Normal', 'Relaxed', 'Very relaxed'],
  mood:     ['Highly annoyed', 'Snappy with others', 'Less interested', 'Generally good', 'Very positive'],
};

const WELLNESS_KEYS = ['fatigue', 'sleep', 'soreness', 'stress', 'mood'] as const;
type WellnessKey = typeof WELLNESS_KEYS[number];

// ── Date helpers ───────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A real checkin, or a placeholder for a day the athlete simply didn't log. */
type DisplayCheckin = AthleteCheckin & { isMissing?: boolean };

// ── Z-score helpers ───────────────────────────────────────────────────────────

function zColor(z: number): string {
  if (z < -1.5) return 'text-red-600';
  if (z < -0.5) return 'text-orange-500';
  if (z >  0.5) return 'text-green-600';
  return 'text-slate-500';
}

function zBadgeVariant(z: number): string {
  if (z < -1.5) return 'bg-red-100 text-red-700 border-red-200';
  if (z < -0.5) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (z >  0.5) return 'bg-green-100 text-green-700 border-green-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function zLabel(z: number): string {
  if (z < -2)   return 'Well below average';
  if (z < -1)   return 'Below average';
  if (z < -0.5) return 'Slightly below average';
  if (z >  2)   return 'Well above average';
  if (z >  1)   return 'Above average';
  if (z >  0.5) return 'Slightly above average';
  return 'Average';
}

// ── Wellness dot bar ──────────────────────────────────────────────────────────

const SCORE_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-400',
  3: 'bg-amber-400',
  4: 'bg-green-400',
  5: 'bg-green-600',
};

function ScoreDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={cn(
          'w-2.5 h-2.5 rounded-full',
          i < value ? SCORE_COLORS[value] ?? 'bg-primary' : 'bg-muted'
        )} />
      ))}
    </div>
  );
}

// ── Composite score display ───────────────────────────────────────────────────

function CompositeScore({
  composite,
  stats,
  expanded,
  onToggle,
  checkin,
}: {
  composite: number;
  stats: WellnessStats | null;
  expanded: boolean;
  onToggle: () => void;
  checkin: AthleteCheckin;
}) {
  const z   = stats ? zScore(composite, stats) : null;
  const pct = ((composite - 1) / 4) * 100;

  return (
    <div className="space-y-3">
      {/* Main score row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 text-left hover:bg-muted/40 rounded-lg p-1 -m-1 transition-colors"
      >
        {/* Big number */}
        <div className="shrink-0 text-center">
          <p className="text-4xl font-bold tabular-nums leading-none">
            {composite.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">/ 5</p>
        </div>

        {/* Bar + z-score */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: composite >= 4 ? '#16a34a' : composite >= 3 ? '#ca8a04' : '#dc2626',
              }}
            />
          </div>
          {z !== null && (
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-semibold tabular-nums', zColor(z))}>
                z = {z >= 0 ? '+' : ''}{z.toFixed(2)}
              </span>
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded border font-medium',
                zBadgeVariant(z)
              )}>
                {zLabel(z)}
              </span>
            </div>
          )}
          {z === null && stats === null && (
            <p className="text-xs text-muted-foreground">Fewer than 5 check-ins — z-score not yet available</p>
          )}
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded individual items */}
      {expanded && (
        <div className="border rounded-lg divide-y bg-muted/20">
          {WELLNESS_KEYS.map((key) => {
            const val = checkin[`wellness${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof AthleteCheckin] as number | null;
            if (val === null) return null;
            return (
              <div key={key} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-16 text-xs font-medium text-muted-foreground shrink-0">
                  {WELLNESS_LABELS[key]}
                </span>
                <ScoreDots value={val} />
                <span className="text-xs font-semibold w-4 shrink-0">{val}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {WELLNESS_ANCHORS[key][val - 1]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Read-only body map ────────────────────────────────────────────────────────

const FRONT_IMG = '/bodymap-front.png';
const BACK_IMG  = '/bodymap-back.png';

interface PainDotInfo { cx: number; cy: number; view: 'front' | 'back'; nrs: number; label: string }

function buildPainDots(painAreas: AthleteCheckin['painAreas']): PainDotInfo[] {
  const dots: PainDotInfo[] = [];
  for (const area of painAreas) {
    const key = area.regionKey ?? String(area.areaId);
    // Find first matching region in front, then back
    for (const r of FRONT_REGIONS) {
      if (svgRegionKey(r) === key) {
        dots.push({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, view: 'front', nrs: area.severity, label: area.areaLabel });
        break;
      }
    }
    for (const r of BACK_REGIONS) {
      if (svgRegionKey(r) === key) {
        dots.push({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, view: 'back', nrs: area.severity, label: area.areaLabel });
        break;
      }
    }
  }
  return dots;
}

function BodyMapReadOnly({ painAreas }: { painAreas: AthleteCheckin['painAreas'] }) {
  const dots = buildPainDots(painAreas);
  const frontDots = dots.filter(d => d.view === 'front');
  const backDots  = dots.filter(d => d.view === 'back');

  function MapView({
    imgSrc, viewBox, viewDots,
  }: { imgSrc: string; viewBox: string; viewDots: PainDotInfo[] }) {
    return (
      <div className="relative" style={{ width: '100%', height: '340px' }}>
        <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
        >
          {viewDots.map((d, i) => (
            <g key={i}>
              <circle cx={d.cx} cy={d.cy} r={7}
                fill={nrsSeverityColor(d.nrs)}
                stroke={nrsSeverityStroke(d.nrs)}
                strokeWidth={1.5}
              />
              <text x={d.cx} y={d.cy + 4} textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">
                {d.nrs}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <p className="text-[10px] text-muted-foreground text-center mb-1 font-medium uppercase tracking-wide">Front</p>
        <MapView imgSrc={FRONT_IMG} viewBox="0 0 193 306" viewDots={frontDots} />
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-muted-foreground text-center mb-1 font-medium uppercase tracking-wide">Back</p>
        <MapView imgSrc={BACK_IMG} viewBox="0 0 211 317" viewDots={backDots} />
      </div>
    </div>
  );
}

// ── Wellness trend chart ──────────────────────────────────────────────────────

// ── Calendar range picker ─────────────────────────────────────────────────────

type CalendarPhase = 'start' | 'end';

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
      onChange(draft.from, date);
      setOpen(false);
      setPhase('start');
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
        <Button variant="outline" size="sm" className="gap-2 h-7 text-xs font-normal">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
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
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Trend helpers ─────────────────────────────────────────────────────────────

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null; // need full window before computing
    const slice = values.slice(i - window + 1, i + 1).filter((v): v is number => v !== null);
    if (slice.length < window) return null; // skip if any nulls in the window
    return parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2));
  });
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function ZScoreChart({ checkins, stats, maWindow = 7 }: {
  checkins: AthleteCheckin[];
  stats: WellnessStats | null;
  maWindow?: number;
}) {
  const data = useMemo(() => {
    const sorted = [...checkins].reverse(); // oldest → newest
    const zValues = sorted.map(c => {
      const comp = wellnessComposite(c);
      return (comp !== null && stats) ? zScore(comp, stats) : null;
    });
    const maValues = movingAverage(zValues, maWindow);

    return sorted.map((c, i) => {
      const comp = wellnessComposite(c);
      const d = new Date(c.date + 'T12:00:00');
      return {
        date: c.date,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        z:    zValues[i] !== null ? parseFloat((zValues[i] as number).toFixed(2)) : null,
        ma:   maValues[i],
        composite: comp !== null ? parseFloat(comp.toFixed(2)) : null,
      };
    });
  }, [checkins, stats, maWindow]);

  if (data.length < 2) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        Not enough data yet — chart appears after 2+ check-ins.
      </p>
    );
  }

  // Custom dot colored by zone
  const CustomDot = (props: { cx?: number; cy?: number; payload?: { z: number | null } }) => {
    const { cx, cy, payload } = props;
    if (!payload || payload.z === null || cx === undefined || cy === undefined) return null;
    const z = payload.z;
    const color = z < -1.5 ? '#dc2626' : z < -0.5 ? '#f97316' : z > 0.5 ? '#16a34a' : '#94a3b8';
    return <circle cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1} />;
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { dataKey: string; value: number; payload: { composite: number | null; z: number | null; ma: number | null } }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
        <p className="font-semibold">{label}</p>
        {p.composite !== null && <p>Wellness: <span className="font-medium">{p.composite.toFixed(1)} / 5</span></p>}
        {p.z !== null && (
          <p className={cn('font-semibold', zColor(p.z))}>
            z = {p.z >= 0 ? '+' : ''}{p.z.toFixed(2)} — {zLabel(p.z)}
          </p>
        )}
        {p.ma !== null && <p className="text-slate-400">{maWindow}d MA: {p.ma >= 0 ? '+' : ''}{p.ma.toFixed(2)}</p>}
      </div>
    );
  };

  // How many date ticks to show
  const tickEvery = data.length <= 14 ? 1 : data.length <= 28 ? 3 : 7;
  const ticks = data
    .filter((_, i) => i % tickEvery === 0 || i === data.length - 1)
    .map(d => d.date);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={v => {
            const d = new Date(v + 'T12:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[-3, 3]}
          ticks={[-2, -1, 0, 1, 2]}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceArea y1={-1} y2={1} fill="#6366f1" fillOpacity={0.06} />
        <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" />
        <Tooltip content={<CustomTooltip />} />
        {/* Raw z-scores */}
        <Line type="monotone" dataKey="z" stroke="#6366f1" strokeWidth={1.5}
          dot={<CustomDot />} activeDot={{ r: 5, fill: '#6366f1' }} connectNulls={false} opacity={0.5} />
        {/* Moving average — only renders once enough data points exist */}
        {data.length >= maWindow && (
          <Line type="monotone" dataKey="ma" stroke="#6366f1" strokeWidth={2.5}
            dot={false} activeDot={false} connectNulls={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Date label helper ─────────────────────────────────────────────────────────

function checkinDateLabel(date: string): string {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date === today)     return 'Today';
  if (date === yesterday) return 'Yesterday';
  const d    = new Date(date + 'T12:00:00');
  const diff = Math.round((Date.now() - d.getTime()) / 86400000);
  return `${diff} days ago`;
}

// ── Custom metric card ────────────────────────────────────────────────────────

type BlockWithConfig = MonitoringBlock & { config: NonNullable<MonitoringBlock['config']> };

function CustomMetricCard({
  block,
  connectionId,
}: {
  block: BlockWithConfig;
  connectionId: string;
}) {
  const cfg = block.config;
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [rangeKey, setRangeKey] = useState<7 | 14 | 28 | 90>(28);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingData(true);
      const from = new Date();
      from.setDate(from.getDate() - rangeKey);
      const { data: rows, error } = await supabase
        .from('athlete_test_results')
        .select('value, recorded_at')
        .eq('athlete_connection_id', connectionId)
        .eq('parameter_id', cfg.parameterId)
        .gte('recorded_at', from.toISOString())
        .order('recorded_at', { ascending: true });

      if (cancelled) return;
      if (!error && rows) {
        // Group by date, keep last value per day
        const byDate = new Map<string, number>();
        for (const r of rows) {
          const date = (r.recorded_at as string).slice(0, 10);
          const val = parseFloat(r.value as string);
          if (!isNaN(val)) byDate.set(date, val);
        }
        setData(
          Array.from(byDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, value]) => ({ date, value }))
        );
      }
      setLoadingData(false);
    }
    load();
    return () => { cancelled = true; };
  }, [connectionId, cfg.parameterId, rangeKey]);

  const currentEntry = data.length > 0 ? data[data.length - 1] : null;
  const unit = cfg.parameterUnit ?? '';
  const isScale = cfg.inputType === 'scale';
  const yMin = isScale ? (cfg.scaleMin ?? 0) : undefined;
  const yMax = isScale ? (cfg.scaleMax ?? 10) : undefined;

  const MetricTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
        <p className="font-semibold">
          {label ? new Date(label + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
        </p>
        <p>
          {cfg.parameterName}:{' '}
          <span className="font-medium">{payload[0].value}{unit ? ` ${unit}` : ''}</span>
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{cfg.parameterName}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {isScale
                ? `Scale · ${cfg.scaleMin ?? 0}–${cfg.scaleMax ?? 10}`
                : unit ? `Unit: ${unit}` : 'Numeric'}
            </p>
          </div>
          <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
            {([7, 14, 28, 90] as const).map(d => (
              <button
                key={d}
                onClick={() => setRangeKey(d)}
                className={cn(
                  'px-2.5 py-1 transition-colors border-l first:border-l-0',
                  rangeKey === d
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingData ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No data yet.</p>
        ) : (
          <div className="flex items-start gap-6">
            {/* Current value */}
            <div className="shrink-0 text-center min-w-[4rem]">
              <p className="text-4xl font-bold tabular-nums">{currentEntry!.value}</p>
              {unit && <p className="text-xs text-muted-foreground mt-0.5">{unit}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(currentEntry!.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            {/* Trend chart */}
            <div className="flex-1 min-w-0">
              {data.length < 2 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  Chart appears after 2+ entries.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={v => {
                        const d = new Date(v + 'T12:00:00');
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={
                        yMin !== undefined && yMax !== undefined
                          ? [yMin, yMax]
                          : ['auto', 'auto']
                      }
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<MetricTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#6366f1', stroke: 'white', strokeWidth: 1 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { athlete: Athlete; connectionsLoading?: boolean; connection?: AthleteConnection }

export function AthleteMonitoringTab({ athlete, connectionsLoading = false, connection }: Props) {
  const athleteId  = connection?.id ?? null;

  const { checkins, loading } = useAthleteCheckins(athleteId);
  const [wellnessExpanded, setWellnessExpanded] = useState(false);
  const [rangeFrom, setRangeFrom] = useState<Date | null>(null);
  const [rangeTo,   setRangeTo]   = useState<Date | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0); // 0 = latest, displayCheckins is newest-first

  // Continuous day-by-day list (newest-first), padding gaps with a placeholder so the
  // date navigator surfaces skipped days instead of silently jumping over them.
  const displayCheckins = useMemo((): DisplayCheckin[] => {
    if (checkins.length === 0) return [];
    const byDate = new Map(checkins.map(c => [c.date, c]));
    const oldest = new Date(checkins[checkins.length - 1].date + 'T12:00:00'); // checkins is newest-first
    const result: DisplayCheckin[] = [];
    for (
      let cursor = new Date(toLocalDateStr(new Date()) + 'T12:00:00');
      cursor.getTime() >= oldest.getTime();
      cursor = new Date(cursor.getTime() - 86_400_000)
    ) {
      const dateStr = toLocalDateStr(cursor);
      result.push(byDate.get(dateStr) ?? {
        id: `missing-${dateStr}`,
        date: dateStr,
        wellnessFatigue: null, wellnessSleep: null, wellnessSoreness: null,
        wellnessStress: null, wellnessMood: null,
        hasPain: false, painAreas: [],
        hasIllness: false, illnessSymptoms: [], illnessSymptomOther: '', illnessNrs: null,
        notes: null, createdAt: '',
        isMissing: true,
      });
    }
    return result;
  }, [checkins]);

  // Stats over full history
  const stats = useMemo(() => computeWellnessStats(checkins), [checkins]);

  // Enabled custom metric blocks (from coach-configured monitoring config)
  const enabledCustomBlocks = useMemo((): BlockWithConfig[] => {
    const config = connection?.profileData?.monitoringConfig ?? DEFAULT_MONITORING_CONFIG;
    return (config.blocks ?? []).filter(
      (b): b is BlockWithConfig => b.type === 'custom_metric' && b.enabled && !!b.config
    );
  }, [connection]);

  // Selected check-in (navigable)
  const selected = displayCheckins[selectedIdx] ?? displayCheckins[0] ?? null;
  const selectedComposite = selected ? wellnessComposite(selected) : null;

  // Keep selectedIdx in bounds when checkins reload
  const safeIdx = Math.min(selectedIdx, Math.max(0, displayCheckins.length - 1));

  function goNewer() { setSelectedIdx(i => Math.max(0, i - 1)); }
  function goOlder() { setSelectedIdx(i => Math.min(displayCheckins.length - 1, i + 1)); }

  // ── Export ──
  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    if (!athleteId) return;
    setExporting(true);
    try {
      // 1. All check-ins (no date cap)
      const { data } = await supabase
        .from('athlete_daily_checkins')
        .select('*')
        .eq('athlete_connection_id', athleteId)
        .order('date', { ascending: false });
      const allCheckins = (data ?? []).map((r: Record<string, unknown>) => ({
        id:                  r.id as string,
        date:                r.date as string,
        wellnessFatigue:     (r.wellness_fatigue  as number) ?? null,
        wellnessSleep:       (r.wellness_sleep    as number) ?? null,
        wellnessSoreness:    (r.wellness_soreness as number) ?? null,
        wellnessStress:      (r.wellness_stress   as number) ?? null,
        wellnessMood:        (r.wellness_mood     as number) ?? null,
        hasPain:             (r.has_pain  as boolean) ?? false,
        painAreas:           (r.pain_areas  as import('@/hooks/useAthleteCheckins').CheckinPainArea[]) ?? [],
        hasIllness:          (r.has_illness as boolean) ?? false,
        illnessSymptoms:     (r.illness_symptoms  as string[]) ?? [],
        illnessSymptomOther: (r.illness_symptom_other as string) ?? '',
        illnessNrs:          (r.illness_nrs as number) ?? null,
        notes:               (r.notes as string | null) ?? null,
        createdAt:           r.created_at as string,
      }));

      // 2. Fetch all custom metric block data (full history, no date cap)
      const customBlocks: CustomBlockExport[] = [];
      for (const block of enabledCustomBlocks) {
        const cfg = block.config;
        const { data: rows } = await supabase
          .from('athlete_test_results')
          .select('value, recorded_at')
          .eq('athlete_connection_id', athleteId)
          .eq('parameter_id', cfg.parameterId)
          .order('recorded_at', { ascending: true });
        customBlocks.push({
          name: cfg.parameterName,
          unit: cfg.parameterUnit ?? null,
          rows: (rows ?? []).map((r: { value: string; recorded_at: string }) => ({
            date:  (r.recorded_at as string).slice(0, 10),
            value: String(r.value),
          })),
        });
      }

      exportMonitoringXLSX(
        allCheckins,
        [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || 'Athlete',
        customBlocks,
      );
    } finally {
      setExporting(false);
    }
  }

  function formatCheckinDate(date: string): string {
    const today     = toLocalDateStr(new Date());
    const yesterday = toLocalDateStr(new Date(Date.now() - 86400000));
    if (date === today)     return 'Today';
    if (date === yesterday) return 'Yesterday';
    return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Chart data (filtered to selected window)
  const chartCheckins = useMemo(() => {
    if (!rangeFrom || !rangeTo) return checkins; // no filter = all data
    const fromStr = toLocalDateStr(rangeFrom);
    const toStr   = toLocalDateStr(rangeTo);
    return checkins.filter(c => c.date >= fromStr && c.date <= toStr);
  }, [checkins, rangeFrom, rangeTo]);

  const chartDaysSpan = rangeFrom && rangeTo
    ? Math.round((rangeTo.getTime() - rangeFrom.getTime()) / 86400000) + 1
    : null;

  // ── Loading / no app account ──
  if (connectionsLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20 text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-8 w-8 animate-pulse opacity-40" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  if (!connection) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
        <Activity className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No app account</p>
        <p className="text-xs opacity-70 text-center max-w-xs">
          Create an athlete app account in Settings to enable daily check-ins.
        </p>
      </div>
    );
  }

  // ── Not enabled ──
  if (!connection.monitoringEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
        <Activity className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">Daily monitoring is disabled</p>
        <p className="text-xs opacity-70 text-center max-w-xs">
          Enable it in Settings → Daily Monitoring.
        </p>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // ── No data yet ──
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
        <Smile className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No check-ins yet</p>
        <p className="text-xs opacity-70 text-center max-w-xs">
          {athlete.firstName} hasn't completed a daily check-in yet.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">

        {/* ── Export button ── */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5 text-xs h-8">
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting…' : 'Export XLSX'}
          </Button>
        </div>

        {/* ── 2×2 grid: [Wellness score | Illness] / [Wellness chart | Pain] ── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto' }}>

          {/* [0,0] Wellness score */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Wellness</CardTitle>
                {/* Date navigator */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={goOlder}
                    disabled={safeIdx === displayCheckins.length - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted transition-colors text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatCheckinDate(selected.date)}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="end">
                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {displayCheckins.map((c, i) => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedIdx(i)}
                            className={cn(
                              'w-full flex items-center justify-between gap-2 text-left text-xs px-2 py-1.5 rounded transition-colors',
                              i === safeIdx
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted text-muted-foreground'
                            )}
                          >
                            <span>{formatCheckinDate(c.date)}</span>
                            {c.isMissing && (
                              <span className={i === safeIdx ? 'text-primary-foreground/60' : 'text-muted-foreground/50'}>–</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button
                    onClick={goNewer}
                    disabled={safeIdx === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  {selected.isMissing ? (
                    <div className="flex items-center gap-3">
                      <p className="text-4xl font-bold tabular-nums leading-none text-muted-foreground/40">–</p>
                      <p className="text-sm text-muted-foreground">No check-in logged this day.</p>
                    </div>
                  ) : selectedComposite !== null ? (
                    <CompositeScore
                      composite={selectedComposite}
                      stats={stats}
                      expanded={wellnessExpanded}
                      onToggle={() => setWellnessExpanded(v => !v)}
                      checkin={selected}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No wellness data.</p>
                  )}
                </div>
                {selected.notes && (
                  <div className="shrink-0 w-36 border-l pl-3 flex items-start gap-1.5">
                    <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground italic leading-snug">{selected.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* [0,1] Illness */}
          {selected.isMissing ? (
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground">Illness</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4">
                <p className="text-2xl font-bold text-muted-foreground/40">–</p>
                <p className="text-xs text-muted-foreground">No check-in logged</p>
              </CardContent>
            </Card>
          ) : selected.hasIllness ? (
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Illness
                  {selected.illnessNrs !== null && (
                    <span className="text-sm font-normal text-orange-600 ml-1">· {selected.illnessNrs}/10</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {selected.illnessSymptoms.length > 0 || selected.illnessSymptomOther ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.illnessSymptoms.map(id => (
                      <span key={id}
                        className="text-xs px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 capitalize">
                        {id.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {selected.illnessSymptomOther && (
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800">
                        {selected.illnessSymptomOther}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Illness reported, no symptoms specified.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Illness
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
                <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-green-700">No illness reported</p>
                <p className="text-xs text-muted-foreground text-center">Athlete is feeling well &amp; healthy</p>
              </CardContent>
            </Card>
          )}

          {/* [1,0] Wellness trend chart */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base shrink-0">Wellness Trend</CardTitle>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* Quick range buttons */}
                  <div className="flex rounded-md border overflow-hidden text-xs">
                    {([7, 14, 28, 90] as const).map(d => {
                      const to   = new Date();
                      const from = new Date();
                      from.setDate(from.getDate() - d + 1);
                      const active = rangeFrom && rangeTo &&
                        rangeTo.toDateString() === to.toDateString() &&
                        chartDaysSpan === d;
                      return (
                        <button
                          key={d}
                          onClick={() => { setRangeFrom(from); setRangeTo(to); }}
                          className={cn(
                            'px-2.5 py-1 transition-colors border-l first:border-l-0',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {d}d
                        </button>
                      );
                    })}
                  </div>
                  {/* Custom range picker */}
                  <CalendarRangePicker
                    from={rangeFrom}
                    to={rangeTo}
                    onChange={(f, t) => { setRangeFrom(f); setRangeTo(t); }}
                    onClear={() => { setRangeFrom(null); setRangeTo(null); }}
                  />
                </div>
              </div>
              {stats && (
                <p className="text-xs text-muted-foreground">
                  z-score vs. personal baseline (mean {stats.mean.toFixed(1)}, SD {stats.sd.toFixed(2)}, n={stats.n})
                </p>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 min-h-0">
                <ZScoreChart
                  checkins={chartCheckins}
                  stats={stats}
                  maWindow={chartDaysSpan !== null && chartDaysSpan <= 7 ? 3 : 7}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                Shaded band = ±1 SD (normal range)
              </p>
            </CardContent>
          </Card>

          {/* [1,1] Pain — body map always visible */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {!selected.isMissing && (
                  selected.hasPain
                    ? <AlertTriangle className="h-4 w-4 text-red-500" />
                    : <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                Pain
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {selected.isMissing ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                  <p className="text-2xl font-bold text-muted-foreground/40">–</p>
                  <p className="text-xs text-muted-foreground">No check-in logged</p>
                </div>
              ) : (
                <>
                  {/* Status banner */}
                  {!selected.hasPain && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <p className="text-xs font-medium text-green-700">No pain reported — body is feeling great!</p>
                    </div>
                  )}
                  {/* Body map — always shown; dots appear only when pain is reported */}
                  <BodyMapReadOnly painAreas={selected.hasPain ? selected.painAreas : []} />
                  {/* Pain area list */}
                  {selected.hasPain && selected.painAreas.length > 0 && (
                    <div className="space-y-1.5">
                      {selected.painAreas.map((area, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: nrsSeverityStroke(area.severity) }} />
                          <span className="text-sm flex-1 truncate">{area.areaLabel}</span>
                          <span className="text-sm font-semibold tabular-nums shrink-0"
                            style={{ color: nrsSeverityStroke(area.severity) }}>
                            {area.severity}/10
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selected.hasPain && selected.painAreas.length === 0 && (
                    <p className="text-sm text-muted-foreground">Pain reported, no areas specified.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── Custom metric cards ── */}
        {enabledCustomBlocks.map(block => (
          <CustomMetricCard key={block.id} block={block} connectionId={athleteId!} />
        ))}

        {/* ── Recent history ── */}
        {checkins.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {checkins.slice(0, 14).map(c => {
                  const comp = wellnessComposite(c);
                  const z    = (comp !== null && stats) ? zScore(comp, stats) : null;
                  return (
                    <div key={c.id} className="py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">
                          {new Date(c.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {comp !== null && (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <ScoreDots value={Math.round(comp)} />
                            <span className="text-xs font-medium tabular-nums">{comp.toFixed(1)}</span>
                            {z !== null && (
                              <span className={cn('text-xs font-medium tabular-nums', zColor(z))}>
                                {z >= 0 ? '+' : ''}{z.toFixed(1)}σ
                              </span>
                            )}
                          </div>
                        )}
                        {comp === null && <div className="flex-1" />}
                        <div className="flex gap-1.5 shrink-0">
                          {c.hasPain && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-medium">
                              Pain
                            </span>
                          )}
                          {c.hasIllness && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-medium">
                              Ill
                            </span>
                          )}
                        </div>
                      </div>
                      {c.notes && (
                        <div className="flex gap-3 mt-0.5">
                          <span className="w-20 shrink-0" />
                          <p className="text-xs text-muted-foreground italic leading-snug flex-1">"{c.notes}"</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </ScrollArea>
  );
}
