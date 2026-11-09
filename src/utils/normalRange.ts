/**
 * An athlete's normal range for a number answered in the check-in (sleep minutes, ankle
 * circumference…): average ± 1 SD of the previous 28 days — not the day itself — from 7 values on.
 * Used by the desktop Monitoring tab and the coach phone app's Overview, so both show the same.
 */

export const BASELINE_DAYS = 28;
export const BASELINE_MIN_VALUES = 7;

export type TrendPoint = { date: string; value: number; mean?: number; band?: [number, number]; z?: number };

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** yyyy-MM-dd `days` days before `date` */
export const daysBefore = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - days);
  return ymd(d);
};

/** One value per day: the last one entered that day (series sorted by date) */
export function lastPerDay(series: Array<{ date: string; value: number }>): Array<{ date: string; value: number }> {
  const byDate = new Map<string, number>();
  for (const p of series) if (!isNaN(p.value)) byDate.set(p.date, p.value);
  return Array.from(byDate, ([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

/** The series from `fromDate` on, each day with its normal range (from the days before it) */
export function withNormalRange(series: Array<{ date: string; value: number }>, fromDate: string): TrendPoint[] {
  return series.filter(p => p.date >= fromDate).map(p => {
    const start = daysBefore(p.date, BASELINE_DAYS);
    const previous = series.filter(q => q.date >= start && q.date < p.date).map(q => q.value);
    if (previous.length < BASELINE_MIN_VALUES) return { ...p };
    const mean = previous.reduce((s, v) => s + v, 0) / previous.length;
    const sd = Math.sqrt(previous.reduce((s, v) => s + (v - mean) ** 2, 0) / (previous.length - 1));
    return { ...p, mean, band: [mean - sd, mean + sd], z: sd > 0 ? (p.value - mean) / sd : 0 };
  });
}

export const outsideRange = (p: TrendPoint) => !!p.band && (p.value < p.band[0] || p.value > p.band[1]);

/** 'above' / 'below' the normal range, or null (inside, or not enough values yet) */
export function rangeStatus(p: TrendPoint | undefined): 'above' | 'below' | null {
  if (!p?.band) return null;
  if (p.value > p.band[1]) return 'above';
  if (p.value < p.band[0]) return 'below';
  return null;
}
