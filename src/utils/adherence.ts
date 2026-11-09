/**
 * Adherence: how many of the planned sessions the athlete finished.
 *
 * - A planned session counts as done when a finished log has the same date and session id. Finished
 *   logs without a matching id (older logs) fill the day's still-open planned sessions.
 * - Sessions done without a plan don't raise adherence (it can't go above 100%).
 * - A planned session from today on that isn't finished yet isn't missed yet: it only counts once
 *   it's done (or the day is over).
 */

export interface AdherenceScheduleRow {
  date: string;
  sessions: unknown[] | null;
}

export interface AdherenceLogRow {
  date: string;
  session_id: string | null;
  completed_at: string | null;
}

export interface DayAdherence {
  planned: number;
  done: number;
  /** Ids of the day's planned sessions that are done */
  doneIds: Set<string>;
}

/** A planned session's id (older sessions without one: date + position) */
export const plannedSessionId = (session: unknown, date: string, index: number): string => {
  const id = (session as { id?: unknown } | null)?.id;
  return typeof id === 'string' && id ? id : `${date}#${index}`;
};

/** Per day: planned and done sessions (yyyy-MM-dd → counts) */
export function adherenceByDay(
  schedule: AdherenceScheduleRow[],
  logs: AdherenceLogRow[],
  todayYMD: string,
): Map<string, DayAdherence> {
  const finishedByDate = new Map<string, AdherenceLogRow[]>();
  for (const log of logs) {
    if (!log.completed_at) continue;
    const list = finishedByDate.get(log.date) ?? [];
    list.push(log);
    finishedByDate.set(log.date, list);
  }

  const result = new Map<string, DayAdherence>();
  for (const row of schedule) {
    const sessions = Array.isArray(row.sessions) ? row.sessions : [];
    if (sessions.length === 0) continue;
    const ids = sessions.map((s, i) => plannedSessionId(s, row.date, i));
    const finished = finishedByDate.get(row.date) ?? [];
    const doneIds = new Set<string>();
    let unmatched = 0;
    for (const log of finished) {
      // The same session finished twice counts once
      if (log.session_id && ids.includes(log.session_id)) doneIds.add(log.session_id);
      else unmatched++;
    }
    // Logs without a matching id: the day's open sessions, in order
    for (const id of ids) {
      if (unmatched === 0) break;
      if (doneIds.has(id)) continue;
      doneIds.add(id);
      unmatched--;
    }
    const done = doneIds.size;
    const open = ids.length - done;
    const planned = row.date >= todayYMD ? done : done + open;
    if (planned === 0) continue;
    result.set(row.date, { planned, done, doneIds });
  }
  return result;
}

export interface AdherenceTotal {
  planned: number;
  done: number;
  /** 0–100, null when nothing was planned */
  pct: number | null;
}

/** Totals over the days from…to (inclusive) */
export function adherenceTotal(byDay: Map<string, DayAdherence>, from: string, to: string): AdherenceTotal {
  let planned = 0;
  let done = 0;
  byDay.forEach((d, date) => {
    if (date < from || date > to) return;
    planned += d.planned;
    done += d.done;
  });
  return { planned, done, pct: planned > 0 ? Math.round((done / planned) * 100) : null };
}
