import { format } from 'date-fns';

/** "1–14 Aug" / "28 Jul – 3 Aug" for an event over several days (athlete app entries carry
 *  startDate / endDate); null for a one-day event */
export function eventRangeLabel(ev: { startDate?: string; endDate?: string }): string | null {
  if (!ev.startDate || !ev.endDate || ev.endDate <= ev.startDate) return null;
  const a = new Date(`${ev.startDate}T12:00:00`);
  const b = new Date(`${ev.endDate}T12:00:00`);
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `${format(a, 'd')}–${format(b, 'd MMM')}`
    : `${format(a, 'd MMM')} – ${format(b, 'd MMM')}`;
}
