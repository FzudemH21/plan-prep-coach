import { useMemo } from 'react';
import { useAthleteAnamneses } from '@/hooks/useAthleteAnamneses';
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

/**
 * Returns a formatted anamnesis context string for AI injection.
 * Returns '' when there is no athlete selected or no records.
 * Includes all filled fields from all sections (not just hardcoded IDs), the record's own
 * questions and the coach notes, so it works regardless of which template was used. Records
 * still waiting for the athlete are marked as drafts.
 */
export function useAnamnesisAIContext(athleteLocalId: string | null | undefined): string {
  const { anamneses } = useAthleteAnamneses(athleteLocalId ?? '');

  return useMemo(() => {
    if (!athleteLocalId || anamneses.length === 0) return '';
    const recent = anamneses.slice(0, 3);
    const blocks = recent.map((rec, i) => formatRecord(rec, i)).join('\n\n');
    return `## Athlete Anamnesis & Health History (most recent first)\n\n${blocks}`;
  }, [athleteLocalId, anamneses]);
}
