/**
 * useTemplates
 * Manages programming templates (periodization blueprints per training method).
 * Storage key: "programTemplates" — versioned, with migration fallback.
 */

const STORAGE_KEY = 'programTemplates';
const STORAGE_VERSION = '1.1';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TemplateColumn {
  id: string;
  /** Display label, e.g. "Microcycle 1" */
  label: string;
  /** When true the column renders sub-cells (A, B, …) per parameter */
  isSplit: boolean;
  /** Number of split halves (2–5). Only relevant when isSplit is true */
  splitCount: number;
  /** paramName → value  (A-half when split) */
  parameters: Record<string, string>;
  /** paramName → value  (B-half) */
  parametersB: Record<string, string>;
  /** paramName → value  (C-half) */
  parametersC: Record<string, string>;
  /** paramName → value  (D-half) */
  parametersD: Record<string, string>;
  /** paramName → value  (E-half) */
  parametersE: Record<string, string>;
}

export interface ProgramTemplate {
  id: string;
  name: string;
  /** "category|||subCategory" key from the toolbox */
  methodId: string;
  /** Human-readable method name shown in the UI */
  methodName: string;
  columns: TemplateColumn[];
  createdAt: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function migrateColumn(raw: Partial<TemplateColumn>): TemplateColumn {
  return {
    id: raw.id ?? generateId(),
    label: raw.label ?? '',
    isSplit: raw.isSplit ?? false,
    splitCount: raw.splitCount ?? 2,
    parameters: typeof raw.parameters === 'object' && raw.parameters !== null ? raw.parameters : {},
    parametersB: typeof raw.parametersB === 'object' && raw.parametersB !== null ? raw.parametersB : {},
    parametersC: typeof raw.parametersC === 'object' && raw.parametersC !== null ? raw.parametersC : {},
    parametersD: typeof raw.parametersD === 'object' && raw.parametersD !== null ? raw.parametersD : {},
    parametersE: typeof raw.parametersE === 'object' && raw.parametersE !== null ? raw.parametersE : {},
  };
}

function migrateTemplate(raw: unknown): ProgramTemplate {
  const t = raw as Partial<ProgramTemplate>;
  return {
    id: t.id ?? generateId(),
    name: t.name ?? 'Unnamed Template',
    methodId: t.methodId ?? '',
    methodName: t.methodName ?? '',
    columns: Array.isArray(t.columns) ? t.columns.map(migrateColumn) : [],
    createdAt: t.createdAt ?? new Date().toISOString(),
  };
}

function load(): ProgramTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Support both legacy plain array and versioned { version, templates }
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { templates?: unknown[] })?.templates ?? [];
    return list.map(migrateTemplate);
  } catch {
    return [];
  }
}

function persist(templates: ProgramTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, templates }));
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

import { useState, useCallback } from 'react';

export function useTemplates() {
  const [templates, setTemplates] = useState<ProgramTemplate[]>(load);

  const addTemplate = useCallback(
    (template: Omit<ProgramTemplate, 'id' | 'createdAt'>): ProgramTemplate => {
      const t: ProgramTemplate = {
        ...template,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      setTemplates(prev => {
        const next = [...prev, t];
        persist(next);
        return next;
      });
      return t;
    },
    [],
  );

  const updateTemplate = useCallback(
    (id: string, updates: Partial<Omit<ProgramTemplate, 'id' | 'createdAt'>>) => {
      setTemplates(prev => {
        const next = prev.map(t => (t.id === id ? { ...t, ...updates } : t));
        persist(next);
        return next;
      });
    },
    [],
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const next = prev.filter(t => t.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const getTemplatesForMethod = useCallback(
    (methodId: string) => templates.filter(t => t.methodId === methodId),
    [templates],
  );

  return { templates, addTemplate, updateTemplate, deleteTemplate, getTemplatesForMethod };
}
