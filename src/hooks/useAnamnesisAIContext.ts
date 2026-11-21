import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { useAthleteAnamneses } from '@/hooks/useAthleteAnamneses';
import { eventEndDate, useCalendarEvents, type CalendarEvent } from '@/hooks/useCalendarEvents';
import { noteEntriesOf, type AnamnesisField, type AthleteAnamnesis } from '@/types/anamnesis';
import { contextFor, fieldState, formatAnswer } from '@/utils/anamnesisAnswers';

/** Readable answer; multi-line answers (lists, body map, schedule) indented below the label */
function answerLine(field: AnamnesisField, value: string | undefined): string | null {
  const text = formatAnswer(field, value);
  if (!text) return null;
  return text.includes('\n')
    ? `  **${field.label}:**\n${text.split('\n').map((l) => `    ${l}`).join('\n')}`
    : `  **${field.label}:** ${text}`;
}

function formatRecord(rec: AthleteAnamnesis, index: number): string {
  const date = rec.conductedAt.slice(0, 10);
  const templateName = rec.templateSnapshot?.name ?? 'Anamnesis';
  const lines: string[] = [`### Record ${index + 1} — ${date} (${templateName})`];

  // A form link the athlete has not submitted yet: its answers are an unfinished draft
  if (rec.formStatus === 'sent') {
    lines.push('_Status: online form sent to the athlete, NOT submitted yet — the athlete\'s answers below are an incomplete draft._');
  }

  // AI-generated summary first — most informative (its own headings one level down)
  if (rec.aiSummary?.trim()) {
    lines.push(`**AI Summary:**\n${rec.aiSummary.trim().replace(/^#{1,3} /gm, '#### ')}`);
  }

  // All sections and their filled fields — works for any template structure
  const ctx = contextFor(rec.templateSnapshot?.sections ?? [], rec.fieldValues, rec.athleteProfileAnswers?.sex);
  for (const section of rec.templateSnapshot?.sections ?? []) {
    const sectionLines: string[] = [];
    for (const field of section.fields) {
      // Answers of questions hidden by their "show only if" condition don't count
      if (fieldState(section, field, ctx) === 'notMet') continue;
      const line = answerLine(field, rec.fieldValues[field.id]);
      if (line) sectionLines.push(line);
    }
    if (sectionLines.length > 0) {
      lines.push(`**${section.title}:**`);
      lines.push(...sectionLines);
    }
  }

  // Questions added to this record only
  const customLines = rec.customQuestions
    .filter((f) => f.label.trim())
    .map((f) => answerLine(f, rec.customFieldValues[f.id]))
    .filter((l): l is string => !!l);
  if (customLines.length > 0) {
    lines.push('**Additional questions:**');
    lines.push(...customLines);
  }

  // Coach notes from the appointment — typed or dictated, with their time
  const notes = noteEntriesOf(rec);
  if (notes.length > 0) {
    lines.push('**Coach notes:**');
    for (const n of notes) {
      lines.push(`  - [${n.createdAt.slice(0, 10)}${n.source === 'dictated' ? ', dictated' : ''}] ${n.text}`);
    }
  }

  return lines.join('\n');
}

/** Where a calendar entry came from, in words */
function originOf(e: CalendarEvent): string {
  if (e.source?.kind === 'anamnesis') return 'entered by the athlete in the anamnesis form';
  if (e.assignmentId) return 'from an assigned plan';
  return 'added to the calendar';
}

/**
 * The athlete's calendar: tests and events already scheduled (from the anamnesis form, assigned
 * plans or added by hand) — so the AI doesn't offer to schedule them again. Recent and upcoming
 * entries (from 30 days ago), at most 40.
 */
function calendarSection(events: CalendarEvent[]): string {
  const from = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const shown = events
    .filter((e) => eventEndDate(e) >= from)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 40);
  if (shown.length === 0) return '';
  const lines = shown.map((e) => {
    const when = e.endDate && e.endDate > e.date ? `${e.date} → ${e.endDate}` : e.date;
    return `- ${when}: "${e.title}" (${e.type === 'test' ? 'test' : 'event'}, ${originOf(e)})`;
  });
  return `## Already in the athlete's calendar
These tests and events are ALREADY scheduled in the athlete's calendar (dates the athlete gave in the anamnesis form are added automatically). Never offer or suggest to schedule them, never add them with create_event / schedule_tests, and don't ask for their dates — refer to them as already in the calendar and use their dates when planning (peaking, tapering, retests around them).
${lines.join('\n')}`;
}

/**
 * Returns a formatted anamnesis context string for AI injection.
 * Returns '' when there is no athlete selected or nothing to tell. Also lists what is already in the
 * athlete's calendar (calendarSection).
 * Includes all filled fields from all sections (not just hardcoded IDs), the record's own
 * questions and the coach notes, so it works regardless of which template was used. Records
 * still waiting for the athlete are marked as drafts.
 */
export function useAnamnesisAIContext(athleteLocalId: string | null | undefined): string {
  const { anamneses } = useAthleteAnamneses(athleteLocalId ?? '');
  const { getEventsForAthlete } = useCalendarEvents();
  const calendar = athleteLocalId ? calendarSection(getEventsForAthlete(athleteLocalId)) : '';

  return useMemo(() => {
    if (!athleteLocalId) return '';
    const parts: string[] = [];
    if (anamneses.length > 0) {
      const recent = anamneses.slice(0, 3);
      const blocks = recent.map((rec, i) => formatRecord(rec, i)).join('\n\n');
      parts.push(`## Athlete Anamnesis & Health History (most recent first)\n\n${blocks}`);
    }
    if (calendar) parts.push(calendar);
    return parts.join('\n\n');
  }, [athleteLocalId, anamneses, calendar]);
}
