/**
 * useGlobalAIContext
 *
 * Builds a formatted plain-text block covering the three always-relevant
 * databases: Training Toolbox, Athlete Database, and Exercise Libraries.
 *
 * Returned string is injected verbatim into the WizardAIAssistant system
 * prompt via the `globalContext` prop so the AI has full awareness of the
 * coach's configured data on every step and page.
 */

import { useMemo } from 'react';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useAthletes } from '@/hooks/useAthletes';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import { getAthleteDisplayName } from '@/types/athlete';

export function useGlobalAIContext(): string {
  const { data: toolboxData } = useToolboxData();
  const { athletes } = useAthletes();
  const { libraries } = useCustomLibraries();

  return useMemo(() => {
    const sections: string[] = [];

    // ── Training Toolbox ─────────────────────────────────────────────────────
    const methodMap = new Map<string, string[]>();
    for (const entry of toolboxData?.entries ?? []) {
      const methodId = entry.subCategory
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      if (!methodMap.has(methodId)) methodMap.set(methodId, []);
      if (entry.parameterName) methodMap.get(methodId)!.push(
        `${entry.parameterName} (${entry.parameterType}${entry.options?.length ? ': ' + entry.options.join('/') : ''})`
      );
    }
    if (methodMap.size > 0) {
      const methodLines = Array.from(methodMap.entries()).map(([method, params]) =>
        `- ${method}${params.length ? '\n    Parameters: ' + params.join(', ') : ''}`
      );
      sections.push(`## Training Toolbox (${methodMap.size} methods)\n${methodLines.join('\n')}`);
    } else {
      sections.push('## Training Toolbox\nNo methods configured yet.');
    }

    // ── Athlete Database ─────────────────────────────────────────────────────
    const activeAthletes = athletes.filter(a => !a.isArchived);
    if (activeAthletes.length > 0) {
      const athleteLines = activeAthletes.map(a => {
        const name = getAthleteDisplayName(a);
        const sports = [...(a.sports ?? []), ...(!a.sports && a.sport ? [a.sport] : [])];
        const parts: string[] = [];
        if (sports.length > 0) parts.push(`sports: ${sports.join(', ')}`);
        if (a.team) parts.push(`team: ${a.team}`);
        if (a.sex) parts.push(`sex: ${a.sex}`);
        if (a.birthday) {
          const age = Math.floor((Date.now() - new Date(a.birthday).getTime()) / (365.25 * 24 * 3600 * 1000));
          if (!isNaN(age) && age > 0 && age < 100) parts.push(`age: ${age}`);
        }
        return `- ${name}${parts.length > 0 ? ' | ' + parts.join(' | ') : ''}`;
      });
      sections.push(`## Athlete Database (${activeAthletes.length} active athletes)\n${athleteLines.join('\n')}`);
    } else {
      sections.push('## Athlete Database\nNo athletes added yet.');
    }

    // ── Exercise Libraries ───────────────────────────────────────────────────
    if (libraries.length > 0) {
      const libSections = libraries.map(lib => {
        const firstColId = lib.columns[0]?.id ?? 'exercise';
        const categoryCol = lib.columns.find(c =>
          c.name.toLowerCase().includes('categor') && !c.role
        );
        const exerciseLines = lib.exercises.map(ex => {
          const name = ex.data[firstColId] || 'Unnamed';
          const category = categoryCol ? (ex.data[categoryCol.id] ?? '') : '';
          return `  - ${name}${category ? ` [${category}]` : ''} | exerciseId: ${ex.id} | libraryId: ${lib.id}`;
        });
        return `Library: "${lib.name}" (${lib.exercises.length} exercises)\n${exerciseLines.length > 0 ? exerciseLines.join('\n') : '  (no exercises yet)'}`;
      });
      sections.push(`## Exercise Libraries\n${libSections.join('\n\n')}`);
    } else {
      sections.push('## Exercise Libraries\nNo exercise libraries created yet.');
    }

    return sections.join('\n\n');
  }, [toolboxData, athletes, libraries]);
}
