import { useMemo } from 'react';
import { startOfWeek, endOfWeek, addWeeks, eachDayOfInterval } from 'date-fns';

export type CalendarViewMode = '1week' | '2week' | '4week' | 'master';

/**
 * Shared hook for calendar grid date range calculation.
 * Used by both TrainingCalendarView and AthleteCalendarView.
 * Returns the date interval and a utility to group days into weeks.
 */
export function useCalendarGrid(currentDate: Date, viewMode: CalendarViewMode) {
  const { start, end } = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    if (viewMode === 'master') {
      return { start, end: start };
    }
    let end: Date;
    switch (viewMode) {
      case '1week':
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
        break;
      case '2week':
        end = endOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
        break;
      case '4week':
      default:
        end = endOfWeek(addWeeks(currentDate, 3), { weekStartsOn: 1 });
        break;
    }
    return { start, end };
  }, [currentDate, viewMode]);

  const dateRange = useMemo(() => {
    if (viewMode === 'master') return [];
    return eachDayOfInterval({ start, end });
  }, [start, end, viewMode]);

  return { start, end, dateRange };
}

/** Groups a flat array of days into weeks of 7 */
export function groupDaysIntoWeeks<T>(days: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    result.push(days.slice(i, i + 7));
  }
  return result;
}
