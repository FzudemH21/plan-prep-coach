/**
 * Adherence card (athlete profile → Analysis tab): finished vs. planned sessions.
 * Numbers for the last 7 days, the last 28 days and the chosen period, plus a line chart of the
 * rolling 7-day and 28-day adherence. Counting rules: utils/adherence.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, subDays, subMonths, subWeeks } from 'date-fns';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
  adherenceByDay, adherenceTotal,
  type AdherenceLogRow, type AdherenceScheduleRow, type AdherenceTotal,
} from '@/utils/adherence';

type Period = '4w' | '3M' | '6M';
const PERIODS: Array<{ id: Period; label: string; long: string }> = [
  { id: '4w', label: '4w', long: 'last 4 weeks' },
  { id: '3M', label: '3M', long: 'last 3 months' },
  { id: '6M', label: '6M', long: 'last 6 months' },
];

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

function periodStart(period: Period, now: Date): Date {
  if (period === '4w') return subWeeks(now, 4);
  if (period === '3M') return subMonths(now, 3);
  return subMonths(now, 6);
}

function Share({ label, total }: { label: string; total: AdherenceTotal }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {total.pct === null
        ? <span className="text-muted-foreground">—</span>
        : (
          <span className="tabular-nums">
            <span className="font-medium">{total.pct}%</span>
            <span className="text-muted-foreground"> · {total.done}/{total.planned}</span>
          </span>
        )}
    </div>
  );
}

export function AdherencePanel({ connectionId }: { connectionId: string }) {
  const [period, setPeriod] = useState<Period>('3M');
  const [schedule, setSchedule] = useState<AdherenceScheduleRow[]>([]);
  const [logs, setLogs] = useState<AdherenceLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const todayYMD = ymd(new Date());
  const fromYMD = ymd(periodStart(period, new Date()));
  // The rolling 28 days at the period's first day need the 27 days before it
  const fetchFromYMD = ymd(subDays(parseISO(fromYMD), 27));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [scheduleRes, logsRes] = await Promise.all([
        supabase.from('athlete_schedule').select('date, sessions')
          .eq('athlete_connection_id', connectionId)
          .gte('date', fetchFromYMD).lte('date', todayYMD),
        supabase.from('athlete_session_logs').select('date, session_id, completed_at')
          .eq('athlete_connection_id', connectionId)
          .gte('date', fetchFromYMD).lte('date', todayYMD)
          .not('completed_at', 'is', null),
      ]);
      if (cancelled) return;
      setSchedule((scheduleRes.data ?? []) as AdherenceScheduleRow[]);
      setLogs((logsRes.data ?? []) as AdherenceLogRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [connectionId, fetchFromYMD, todayYMD]);

  const { byDay, chart } = useMemo(() => {
    const byDay = adherenceByDay(schedule, logs, todayYMD);
    // Running sums per day from fetchFrom → today, for the rolling windows
    const days: string[] = [];
    for (let d = parseISO(fetchFromYMD); ymd(d) <= todayYMD; d = addDays(d, 1)) days.push(ymd(d));
    const plannedSum: number[] = [];
    const doneSum: number[] = [];
    days.forEach((day, i) => {
      const a = byDay.get(day);
      plannedSum[i] = (plannedSum[i - 1] ?? 0) + (a?.planned ?? 0);
      doneSum[i] = (doneSum[i - 1] ?? 0) + (a?.done ?? 0);
    });
    const rolling = (i: number, size: number): number | null => {
      const j = i - size;
      const planned = plannedSum[i] - (j >= 0 ? plannedSum[j] : 0);
      const done = doneSum[i] - (j >= 0 ? doneSum[j] : 0);
      return planned > 0 ? Math.round((done / planned) * 100) : null;
    };
    // From the first planned session in the period on (a plan that started recently fills the chart)
    const firstPlanned = days.find(day => day >= fromYMD && byDay.has(day)) ?? fromYMD;
    const chart = days
      .map((day, i) => ({ day, label: format(parseISO(day), 'MMM d'), r7: rolling(i, 7), r28: rolling(i, 28) }))
      .filter(p => p.day >= firstPlanned);
    return { byDay, chart };
  }, [schedule, logs, todayYMD, fetchFromYMD, fromYMD]);

  const periodTotal = adherenceTotal(byDay, fromYMD, todayYMD);
  const last7 = adherenceTotal(byDay, ymd(subDays(new Date(), 6)), todayYMD);
  const last28 = adherenceTotal(byDay, ymd(subDays(new Date(), 27)), todayYMD);
  const periodLabel = PERIODS.find(p => p.id === period)!.long;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Adherence</CardTitle>
          <div className="flex items-center gap-1">
            {PERIODS.map(p => (
              <Button key={p.id} size="sm" variant={period === p.id ? 'default' : 'outline'}
                className="h-7 px-2 text-xs" onClick={() => setPeriod(p.id)}>{p.label}</Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[160px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : periodTotal.pct === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No planned sessions in the {periodLabel}.</p>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="shrink-0 space-y-3 lg:w-52">
              <div>
                <p className="text-3xl font-semibold tabular-nums">{periodTotal.pct}%</p>
                <p className="text-xs text-muted-foreground">
                  {periodTotal.done} of {periodTotal.planned} planned sessions done, {periodLabel}
                </p>
              </div>
              <div className="space-y-1.5 border-t border-border/60 pt-3">
                <Share label="Last 7 days" total={last7} />
                <Share label="Last 28 days" total={last28} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11 }} unit="%" width={44} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                    labelFormatter={(_label: string, payload) => {
                      const day = (payload?.[0]?.payload as { day?: string } | undefined)?.day;
                      return day ? format(parseISO(day), 'EEE, MMM d') : _label;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="r7" name="Rolling 7 days" type="monotone" dot={false}
                    stroke="hsl(var(--muted-foreground))" strokeOpacity={0.6} strokeWidth={1.5} isAnimationActive={false} />
                  <Line dataKey="r28" name="Rolling 28 days" type="monotone" dot={false}
                    stroke="hsl(var(--primary))" strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
