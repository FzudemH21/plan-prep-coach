import { parseISO } from 'date-fns';

/**
 * Safely parse any date string to a Date object suitable for display and comparison.
 *
 * Two formats coexist in this app:
 *   1. Bare date strings  (10 chars, "yyyy-MM-dd") — plan dates, training-day dates, test/event dates
 *   2. Full ISO timestamps (>10 chars, e.g. "2026-05-27T12:00:00.000Z") — recordedAt, createdAt
 *
 * Problem with `parseISO("yyyy-MM-dd")`: date-fns treats a bare date as UTC midnight.
 * In any UTC+ timezone (e.g. Europe/Berlin UTC+2) that midnight becomes the previous day
 * in local time, so `format(parseISO("2026-05-27"), "MMM d")` renders "May 26" instead of "May 27".
 *
 * Fix: for bare dates, append "T12:00:00" (local noon) before constructing the Date.
 * Noon is always safely within the target calendar day regardless of timezone offset (±12 h max).
 */
export function parseDateStr(dateStr: string): Date {
  if (dateStr.length === 10) {
    // Bare yyyy-MM-dd — use local noon to avoid UTC-midnight→previous-day display bug
    return new Date(dateStr + 'T12:00:00');
  }
  // Full ISO timestamp (includes time component) — parse directly
  return parseISO(dateStr);
}
