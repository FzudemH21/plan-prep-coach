import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, AlertTriangle, Smile, Activity } from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
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
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { Athlete } from '@/types/athlete';

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
      <div className="relative" style={{ width: '100%' }}>
        <img src={imgSrc} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
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

function ZScoreChart({ checkins, stats }: { checkins: AthleteCheckin[]; stats: WellnessStats | null }) {
  const data = useMemo(() => {
    const sorted = [...checkins].reverse(); // oldest → newest
    return sorted.map(c => {
      const comp = wellnessComposite(c);
      const z    = (comp !== null && stats) ? zScore(comp, stats) : null;
      const d    = new Date(c.date + 'T12:00:00');
      return {
        date: c.date,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        z: z !== null ? parseFloat(z.toFixed(2)) : null,
        composite: comp !== null ? parseFloat(comp.toFixed(2)) : null,
      };
    });
  }, [checkins, stats]);

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
    active?: boolean; payload?: { value: number; payload: { composite: number | null; z: number | null } }[]; label?: string
  }) => {
    if (!active || !payload?.length) return null;
    const { composite, z } = payload[0].payload;
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
        <p className="font-semibold">{label}</p>
        {composite !== null && <p>Wellness: <span className="font-medium">{composite.toFixed(1)} / 5</span></p>}
        {z !== null && (
          <p className={cn('font-semibold', zColor(z))}>
            z = {z >= 0 ? '+' : ''}{z.toFixed(2)} — {zLabel(z)}
          </p>
        )}
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
        <ReferenceLine y={0}  stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" />
        <ReferenceLine y={1}  stroke="#16a34a" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
        <ReferenceLine y={-1} stroke="#f97316" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="z"
          stroke="#6366f1"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 5, fill: '#6366f1' }}
          connectNulls={false}
        />
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

// ── Main component ────────────────────────────────────────────────────────────

interface Props { athlete: Athlete }

export function AthleteMonitoringTab({ athlete }: Props) {
  const { getConnectionForAthlete } = useAthleteConnections();
  const connection = getConnectionForAthlete(athlete.id);
  const athleteId  = connection?.athleteLocalId ?? null;

  const { checkins, loading } = useAthleteCheckins(athleteId);
  const [wellnessExpanded, setWellnessExpanded] = useState(false);
  const [chartDays, setChartDays] = useState<7 | 14 | 28 | 90>(28);

  // Stats over full history
  const stats = useMemo(() => computeWellnessStats(checkins), [checkins]);

  // Latest check-in
  const latest = checkins[0] ?? null;
  const latestComposite = latest ? wellnessComposite(latest) : null;

  // Chart data (filtered to selected window)
  const chartCheckins = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - chartDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return checkins.filter(c => c.date >= cutoffStr);
  }, [checkins, chartDays]);

  // ── No app account ──
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
  if (!latest) {
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
      <div className="p-4 space-y-4 max-w-2xl">

        {/* ── Latest check-in card ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Latest Check-in</CardTitle>
              <div className="flex items-center gap-2">
                {latest.hasIllness && (
                  <Badge variant="outline" className="text-xs gap-1 border-orange-300 text-orange-700 bg-orange-50">
                    <AlertTriangle className="h-3 w-3" /> Illness
                  </Badge>
                )}
                {latest.hasPain && (
                  <Badge variant="outline" className="text-xs gap-1 border-red-300 text-red-700 bg-red-50">
                    <AlertTriangle className="h-3 w-3" /> Pain
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{checkinDateLabel(latest.date)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Wellness composite */}
            {latestComposite !== null && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Wellness
                </p>
                <CompositeScore
                  composite={latestComposite}
                  stats={stats}
                  expanded={wellnessExpanded}
                  onToggle={() => setWellnessExpanded(v => !v)}
                  checkin={latest}
                />
              </div>
            )}

            {/* Pain */}
            {latest.hasPain && latest.painAreas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Pain Areas
                </p>
                <div className="flex gap-4">
                  {/* Body map */}
                  <div className="w-48 shrink-0">
                    <BodyMapReadOnly painAreas={latest.painAreas} />
                  </div>
                  {/* List */}
                  <div className="flex-1 space-y-1.5 self-center">
                    {latest.painAreas.map((area, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: nrsSeverityStroke(area.severity) }}
                        />
                        <span className="text-sm flex-1">{area.areaLabel}</span>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {area.severity}/10
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Illness */}
            {latest.hasIllness && latest.illnessSymptoms.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Illness
                  {latest.illnessNrs !== null && (
                    <span className="ml-2 text-orange-600">· NRS {latest.illnessNrs}/10</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {latest.illnessSymptoms.map(id => (
                    <span
                      key={id}
                      className="text-xs px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 capitalize"
                    >
                      {id.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {latest.illnessSymptomOther && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800">
                      {latest.illnessSymptomOther}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Wellness z-score trend ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Wellness Trend</CardTitle>
              <div className="flex rounded-md border overflow-hidden text-xs">
                {([7, 14, 28, 90] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setChartDays(d)}
                    className={cn(
                      'px-2.5 py-1 transition-colors border-l first:border-l-0',
                      chartDays === d
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {stats && (
              <p className="text-xs text-muted-foreground">
                z-score vs. personal baseline (mean {stats.mean.toFixed(1)}, SD {stats.sd.toFixed(2)}, n={stats.n})
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ZScoreChart checkins={chartCheckins} stats={stats} />
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground justify-end">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> Above avg (+1 SD)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" /> Below avg (−1 SD)</span>
            </div>
          </CardContent>
        </Card>

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
                    <div key={c.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
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
