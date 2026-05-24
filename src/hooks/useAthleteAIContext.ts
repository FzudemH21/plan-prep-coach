/**
 * useAthleteAIContext
 *
 * Builds a plain-text context block for the AI assistant when used in the
 * athlete calendar. Covers:
 *   - Athlete profile & performance parameters
 *   - Active program assignments (mesocycle / microcycle structure)
 *   - Upcoming and past tests & events
 *   - Parameter database summary
 *   - Program library overview
 */

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Athlete, AthleteCalendarAssignment, AthletePerformanceParameter, getAthleteDisplayName } from '@/types/athlete';
import { TrainingProgram } from '@/hooks/useTrainingPrograms';
import { CalendarEvent } from '@/hooks/useCalendarEvents';
import { ParametersDatabaseV2 } from '@/types/parametersV2';

interface UseAthleteAIContextOptions {
  athlete: Athlete;
  performanceParameters: AthletePerformanceParameter[];
  assignments: AthleteCalendarAssignment[];
  calendarEvents: CalendarEvent[];
  programs: TrainingProgram[];
  parametersData: ParametersDatabaseV2 | null;
}

export function useAthleteAIContext({
  athlete,
  performanceParameters,
  assignments,
  calendarEvents,
  programs,
  parametersData,
}: UseAthleteAIContextOptions): string {
  return useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const sections: string[] = [];

    // ── Athlete Profile ───────────────────────────────────────────────────────
    const name = getAthleteDisplayName(athlete);
    const sports = [...(athlete.sports ?? []), ...(!athlete.sports && athlete.sport ? [athlete.sport] : [])];
    const profileParts: string[] = [];
    if (athlete.birthday) {
      const age = Math.floor(
        (Date.now() - new Date(athlete.birthday).getTime()) / (365.25 * 24 * 3600 * 1000)
      );
      if (!isNaN(age) && age > 0 && age < 100) profileParts.push(`Age: ${age}`);
    }
    if (sports.length > 0) profileParts.push(`Sport: ${sports.join(', ')}`);
    if (athlete.team) profileParts.push(`Team: ${athlete.team}`);
    if (athlete.sex) profileParts.push(`Sex: ${athlete.sex}`);

    let profileSection = `## Athlete: ${name}`;
    if (profileParts.length > 0) profileSection += `\n${profileParts.join(' | ')}`;

    const paramLines = performanceParameters
      .filter(pp => pp.values && pp.values.length > 0)
      .map(pp => {
        const sorted = [...pp.values].sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        );
        const latest = sorted[0];
        const unit = pp.unit ? ` ${pp.unit}` : '';
        return `  - ${pp.parameterName ?? pp.athleticismParameterId}: ${latest.value}${unit} (recorded ${format(new Date(latest.recordedAt + (latest.recordedAt.length === 10 ? 'T12:00:00' : '')), 'MMM d, yyyy')})`;
      });
    if (paramLines.length > 0) {
      profileSection += `\nPerformance Parameters:\n${paramLines.join('\n')}`;
    } else {
      profileSection += '\nPerformance Parameters: none recorded yet';
    }
    sections.push(profileSection);

    // ── Active Assignments ────────────────────────────────────────────────────
    if (assignments.length > 0) {
      const assignLines = assignments.map(a => {
        const start = format(new Date(a.startDate + (a.startDate.length === 10 ? 'T12:00:00' : '')), 'MMM d, yyyy');
        const end = format(new Date(a.endDate + (a.endDate.length === 10 ? 'T12:00:00' : '')), 'MMM d, yyyy');
        let line = `  Program: "${a.programName}" (${start} – ${end})`;
        const mesoLines = (a.assignedMesocycles ?? []).map(meso => {
          const ms = format(new Date(meso.startDate + (meso.startDate.length === 10 ? 'T12:00:00' : '')), 'MMM d');
          const me = format(new Date(meso.endDate + (meso.endDate.length === 10 ? 'T12:00:00' : '')), 'MMM d');
          const micros = (meso.microcycles ?? [])
            .map(mc => `${mc.name} (${mc.duration}d, ${mc.intensity})`)
            .join(', ');
          return `    - ${meso.name}: ${ms} – ${me}${micros ? ' | ' + micros : ''}`;
        });
        if (mesoLines.length > 0) line += `\n${mesoLines.join('\n')}`;
        return line;
      });
      sections.push(`## Active Training Assignments\n${assignLines.join('\n\n')}`);
    } else {
      sections.push('## Active Training Assignments\nNo programs currently assigned to this athlete.');
    }

    // ── Tests & Events ────────────────────────────────────────────────────────
    const formatEvent = (e: CalendarEvent) => {
      const tag = e.type === 'test' ? 'TEST' : 'EVENT';
      const target = e.targetValue ? ` (target: ${e.targetValue})` : '';
      const notes = e.notes ? ` — ${e.notes}` : '';
      return `  ${e.date}: [${tag}] ${e.title}${target}${notes}`;
    };
    const upcoming = calendarEvents
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20);
    const pastRecent = calendarEvents
      .filter(e => e.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    if (calendarEvents.length > 0) {
      let evtSection = '## Tests & Events';
      if (upcoming.length > 0) evtSection += `\nUpcoming (next 20):\n${upcoming.map(formatEvent).join('\n')}`;
      else evtSection += '\nUpcoming: none';
      if (pastRecent.length > 0) evtSection += `\nRecent past:\n${pastRecent.map(formatEvent).join('\n')}`;
      sections.push(evtSection);
    } else {
      sections.push('## Tests & Events\nNone scheduled.');
    }

    // ── Parameter Database ────────────────────────────────────────────────────
    const dbParams = parametersData?.parameters ?? [];
    if (dbParams.length > 0) {
      const dbLines = dbParams.map(p => {
        const meta: string[] = [];
        if (p.category) meta.push(p.category);
        if (p.unit) meta.push(p.unit);
        return `  - ${p.name}${meta.length > 0 ? ' [' + meta.join(', ') + ']' : ''}`;
      });
      sections.push(`## Parameter Database (${dbParams.length} parameters)\n${dbLines.join('\n')}`);
    } else {
      sections.push('## Parameter Database\nNo parameters configured yet.');
    }

    // ── Program Library ───────────────────────────────────────────────────────
    if (programs.length > 0) {
      const progLines = programs.map(p => {
        const weeks = p.duration?.weeks ? ` (${p.duration.weeks} weeks)` : '';
        const goal = p.primaryGoal ? ` | goal: ${p.primaryGoal}` : '';
        const athlete = p.athleteName ? ` | athlete: ${p.athleteName}` : '';
        return `  - "${p.name}"${weeks}${goal}${athlete}`;
      });
      sections.push(`## Program Library (${programs.length} programs)\n${progLines.join('\n')}`);
    } else {
      sections.push('## Program Library\nNo programs saved yet.');
    }

    sections.push(`## Today\n${today}`);

    return sections.join('\n\n');
  }, [athlete, performanceParameters, assignments, calendarEvents, programs, parametersData]);
}
