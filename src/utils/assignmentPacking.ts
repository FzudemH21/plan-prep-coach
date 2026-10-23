/**
 * assignmentPacking
 *
 * When only some microcycles of a program are assigned (e.g. weeks 2 and 4), they are placed
 * back to back: the first selected microcycle starts on the assignment's start date and each
 * following one starts the day after the previous one ends — no gaps for the weeks left out.
 *
 * buildPackedDateMap() maps every day of the selected microcycles (original program date) to its
 * packed date on the program's own timeline, anchored at the first selected day. Days of
 * unselected microcycles are not in the map. The assign flow then shifts the packed timeline to
 * the assignment's start date as before.
 */
import { addDays, format, parseISO } from 'date-fns';

interface DayWithMicrocycle {
  date?: string;
  microcycleId?: string;
}

/** null when nothing can be packed (no microcycle ids on the days, or nothing selected) */
export function buildPackedDateMap(
  trainingDays: DayWithMicrocycle[],
  selectedMicrocycleIds: string[],
): Map<string, string> | null {
  if (!selectedMicrocycleIds || selectedMicrocycleIds.length === 0) return null;
  const selected = new Set(selectedMicrocycleIds);
  const days = [...new Set(
    trainingDays
      .filter(td => td.date && td.microcycleId && selected.has(td.microcycleId))
      .map(td => td.date as string)
  )].sort();
  if (days.length === 0) return null;
  const anchor = parseISO(days[0]);
  const map = new Map<string, string>();
  days.forEach((date, i) => map.set(date, format(addDays(anchor, i), 'yyyy-MM-dd')));
  return map;
}

/** True when the map moves at least one day (i.e. the selection had gaps) */
export function packingMovesDays(map: Map<string, string> | null): boolean {
  if (!map) return false;
  for (const [from, to] of map) if (from !== to) return true;
  return false;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Program data with every date-keyed entry moved to its packed date; entries on days outside the
 * selected microcycles are dropped.
 */
export function remapProgramDates<P extends {
  exerciseDistribution?: Array<{ dayDate: string }> | null;
  sessionSections?: unknown;
  supersets?: unknown;
  dailyIntensityData?: Array<{ date: string }> | null;
  trainingDays?: Array<{ date: string; dayOfWeek?: number; dayName?: string }> | null;
  daySplitStates?: Record<string, number> | null;
}>(program: P, map: Map<string, string>): P {
  const moveKeys = <V,>(obj: Record<string, V> | null | undefined): Record<string, V> | null | undefined => {
    if (!obj || typeof obj !== 'object') return obj;
    const out: Record<string, V> = {};
    Object.entries(obj).forEach(([date, value]) => {
      const to = map.get(date);
      if (to) out[to] = value;
    });
    return out;
  };

  return {
    ...program,
    exerciseDistribution: program.exerciseDistribution
      ?.filter(ex => map.has(ex.dayDate))
      .map(ex => ({ ...ex, dayDate: map.get(ex.dayDate)! })),
    sessionSections: Array.isArray(program.sessionSections)
      ? (program.sessionSections as Array<{ dayDate: string }>)
          .filter(s => map.has(s.dayDate))
          .map(s => ({ ...s, dayDate: map.get(s.dayDate)! }))
      : program.sessionSections,
    supersets: moveKeys(program.supersets as Record<string, unknown> | null | undefined),
    dailyIntensityData: program.dailyIntensityData
      ?.filter(di => map.has(di.date))
      .map(di => ({ ...di, date: map.get(di.date)! })),
    trainingDays: program.trainingDays
      ?.filter(td => map.has(td.date))
      .map(td => {
        const date = map.get(td.date)!;
        const dow = parseISO(date).getDay();
        return { ...td, date, dayOfWeek: dow, dayName: DAY_NAMES[dow] };
      }),
    daySplitStates: moveKeys(program.daySplitStates),
  };
}

/**
 * The program keeps its weekdays: the chosen start date moves forward to the next day with the
 * weekday of the program's first day (a program planned from a Tuesday, assigned "from Monday",
 * starts on that Tuesday — its Tuesday / Thursday sessions stay on Tuesday / Thursday). Without a
 * known first day the chosen date stays.
 */
export function alignToProgramWeekday(chosen: Date, programFirstDay: string | null): Date {
  if (!programFirstDay) return chosen;
  const first = parseISO(programFirstDay);
  if (isNaN(first.getTime())) return chosen;
  const diff = (first.getDay() - chosen.getDay() + 7) % 7;
  return diff === 0 ? chosen : addDays(chosen, diff);
}

type AnchorProgram = {
  trainingDays?: Array<{ date?: string; mesocycleId?: string; microcycleId?: string }> | null;
  exerciseDistribution?: Array<{ dayDate?: string }> | null;
  dailyIntensityData?: Array<{ date?: string; mesocycleId?: string }> | null;
  duration?: { startDate?: string } | null;
};

const dayStr = (d: string | undefined): string | null => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null);
const earliest = (days: Array<string | null>): string | null =>
  days.filter((d): d is string => !!d).sort()[0] ?? null;

/**
 * "Day 1" of an assigned (already packed) program — the date the assignment puts on its start
 * date. ONE rule for the assign dialog (weekday alignment) and the calendar (the shift itself):
 * before, they disagreed — e.g. a program without stored training days was shifted from its first
 * SESSION (a Tuesday) while the dialog aligned to the plan start (a Monday), so the Tuesday
 * session still landed on the Monday. Order: training days of the selected mesocycles > first
 * exercise day > daily intensities of the selected mesocycles > plan start.
 */
export function anchorOfPackedProgram(program: AnchorProgram, selectedMesocycleIds: string[]): string | null {
  const metas = new Set(selectedMesocycleIds);
  const inSelection = <T extends { mesocycleId?: string }>(list: T[]): T[] => {
    const rel = metas.size > 0 ? list.filter(d => !d.mesocycleId || metas.has(d.mesocycleId)) : list;
    return rel.length > 0 ? rel : list;
  };
  const td = program.trainingDays ?? [];
  if (td.length > 0) {
    const a = earliest(inSelection(td).map(d => dayStr(d.date)));
    if (a) return a;
  }
  const ex = program.exerciseDistribution ?? [];
  if (ex.length > 0) {
    const a = earliest(ex.map(e => dayStr(e.dayDate)));
    if (a) return a;
  }
  const di = program.dailyIntensityData ?? [];
  if (di.length > 0) {
    const a = earliest(inSelection(di).map(d => dayStr(d.date)));
    if (a) return a;
  }
  return dayStr(program.duration?.startDate ?? undefined);
}

/** Same as anchorOfPackedProgram, for the program as stored (packs the selected microcycles first) */
export function assignmentAnchorDay(
  program: AnchorProgram,
  selectedMesocycleIds: string[],
  selectedMicrocycleIds: string[],
): string | null {
  const td = (program.trainingDays ?? []) as Array<{ date?: string; microcycleId?: string }>;
  const map = buildPackedDateMap(td, selectedMicrocycleIds);
  const packed = map ? remapProgramDates(program as Parameters<typeof remapProgramDates>[0], map) as AnchorProgram : program;
  return anchorOfPackedProgram(packed, selectedMesocycleIds);
}
