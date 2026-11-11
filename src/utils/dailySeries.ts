/**
 * Daily chart series with every day in it: a day without an entry gets a blank point,
 * so a chart shows a gap there instead of drawing the days before and after side by side.
 */

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The yyyy-MM-dd day after `date` */
export const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return ymd(d);
};

/** `points` (sorted by date) with a `blank(date)` for each missing day between the first and the last */
export function fillMissingDays<T extends { date: string }, B>(points: T[], blank: (date: string) => B): Array<T | B> {
  const out: Array<T | B> = [];
  let prev: string | null = null;
  for (const p of points) {
    if (prev !== null) {
      // Bounded: never more than ~10 years of days, even with a bad date
      for (let d = nextDay(prev), n = 0; d < p.date && n < 3700; d = nextDay(d), n++) out.push(blank(d));
    }
    out.push(p);
    if (prev === null || p.date > prev) prev = p.date;
  }
  return out;
}
