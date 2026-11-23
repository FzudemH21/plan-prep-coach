/**
 * Tests and events of a plan assigned to an athlete — the same on the desktop (athlete calendar) and
 * in the coach mobile app. They go into the athlete's tests & events (calendarEvents) when the plan
 * is assigned; before 2026-11-23 the coach mobile app didn't transfer them.
 */
import type { CalendarEvent } from '@/hooks/useCalendarEvents';
import { groupConsecutiveDates } from '@/hooks/useCalendarEvents';
import type { ReviewedEvent, ReviewedSubGoal } from '@/types/athlete';
import type { ParameterV2 } from '@/types/parametersV2';
import { measureRef, parseMeasureRef, testMeasureSpec } from '@/utils/parameterMeasures';
import type { SyncCalendarEvent } from '@/utils/athleteScheduleSync';

/**
 * The plan's tests (one per goal and date; per side for goals on both sides / the weaker side /
 * the LSI) and events (consecutive days become one event) that the athlete doesn't have yet.
 */
export function assignmentTestsEvents(
  assignment: { reviewedSubGoals?: ReviewedSubGoal[]; reviewedEvents?: ReviewedEvent[] },
  existingEvents: CalendarEvent[],
  parameters: ParameterV2[] | undefined,
  assignmentId: string | undefined,
): Array<Omit<CalendarEvent, 'id'>> {
  const existingKey = (type: string, title: string, date: string) => `${type}|${title}|${date}`;
  const existingSet = new Set(existingEvents.map(e => existingKey(e.type, e.title, e.date)));
  const toAdd: Array<Omit<CalendarEvent, 'id'>> = [];

  (assignment.reviewedSubGoals || []).forEach(sg => {
    // A goal per measure: the test is of that measure; per side: one test per side
    // (left / right — both sides, the weaker side and the LSI need both values)
    const param = sg.parameterLinkedId ? parameters?.find(p => p.id === sg.parameterLinkedId) : undefined;
    const sides: Array<'L' | 'R' | undefined> = !param?.perSide || !sg.side ? [undefined]
      : sg.side === 'L' || sg.side === 'R' ? [sg.side] : ['L', 'R'];
    const split = sides.length > 1;
    sg.scheduledDates.forEach(d => {
      const date = d.substring(0, 10);
      sides.forEach(side => {
        const title = split ? `${sg.testMethod.replace(/ · (Both sides|Weaker side|LSI)$/, '')} · ${side === 'L' ? 'Left' : 'Right'}` : sg.testMethod;
        if (existingSet.has(existingKey('test', title, date))) return;
        const target = sg.targetText ?? (sg.goalValue ? String(sg.goalValue) : undefined);
        toAdd.push({
          type: 'test',
          title,
          date,
          assignmentId,
          parameterId: sg.parameterLinkedId ? measureRef(sg.parameterLinkedId, sg.measureId, side) : undefined,
          // The LSI goal is not a target per side: it is the coach's calculation (coach-only
          // note); the athlete gets the goal's targets per side, if the coach set any
          targetValue: sg.side === 'lsi' ? (side ? sg.sideTargets?.[side] : undefined) : target,
          notes: sg.comments || undefined,
          ...(sg.side === 'lsi' && target ? { coachNote: `LSI goal ${target}` } : {}),
        });
      });
    });
  });
  // Consecutive days of an event become one event over several days
  (assignment.reviewedEvents || []).forEach(evt => {
    groupConsecutiveDates(evt.scheduledDates).forEach(([date, last]) => {
      if (existingSet.has(existingKey('event', evt.name, date))) return;
      toAdd.push({
        type: 'event',
        title: evt.name,
        date,
        ...(last !== date ? { endDate: last } : {}),
        assignmentId,
        notes: evt.comments || undefined,
      });
    });
  });
  return toAdd;
}

/** Tests with their unit, instructions, video and measure from the parameter database (athlete app) */
export function enrichEventsForSync(events: CalendarEvent[], parameters: ParameterV2[] | undefined): SyncCalendarEvent[] {
  return events.map(ev => {
    // A test of a measure / side has a reference "<id>::m:<measure>::s:L" — its parameter is the id
    const ref = ev.parameterId ? parseMeasureRef(ev.parameterId) : undefined;
    const param = ref ? parameters?.find(p => p.id === ref.parameterId) : undefined;
    const measure = param && ev.parameterId ? testMeasureSpec(param, ev.parameterId) : undefined;
    return {
      ...ev,
      unit: measure ? measure.unit : param?.unit,
      instructions: param?.testInstructions,
      videoUrl: param?.testVideoUrl,
      ...(measure ? { measure } : {}),
    };
  });
}
