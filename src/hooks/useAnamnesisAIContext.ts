import { useMemo } from 'react';
import { useAthleteAnamneses } from '@/hooks/useAthleteAnamneses';
import type { AthleteAnamnesis } from '@/types/anamnesis';

function formatRecord(rec: AthleteAnamnesis, index: number): string {
  const date = rec.conductedAt.slice(0, 10);
  const templateName = rec.templateSnapshot?.name ?? 'Anamnesis';
  const lines: string[] = [`### Record ${index + 1} — ${date} (${templateName})`];

  // AI-generated summary first — most dense signal
  if (rec.aiSummary?.trim()) {
    lines.push(`**AI Summary:** ${rec.aiSummary.trim()}`);
  }

  // Pull key fields from all sections in the snapshot
  const keyFieldIds = [
    'f-complaint',
    'f-injury-history',
    'f-medications',
    'f-key-findings',
    'f-training-priorities',
    'f-contraindications',
  ];

  for (const section of rec.templateSnapshot?.sections ?? []) {
    for (const field of section.fields) {
      if (!keyFieldIds.includes(field.id)) continue;
      const val = rec.fieldValues[field.id]?.trim();
      if (val) lines.push(`**${field.label}:** ${val}`);
    }
  }

  // Free-form notes
  if (rec.notes?.trim()) {
    lines.push(`**Coach notes:** ${rec.notes.trim()}`);
  }

  return lines.join('\n');
}

/**
 * Returns a formatted anamnesis context string for AI injection.
 * Returns '' when there is no athlete selected or no records.
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
