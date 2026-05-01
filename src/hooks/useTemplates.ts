/**
 * useTemplates
 * Manages programming templates (periodization blueprints per training method).
 * Backed by Supabase table: program_templates
 * Legacy localStorage key: "programTemplates"
 */

import { useState, useCallback } from 'react';
import { useSupabaseStore } from './useSupabaseStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateColumn {
  id: string;
  label: string;
  isSplit: boolean;
  splitCount: number;
  parameters: Record<string, string>;
  parametersB: Record<string, string>;
  parametersC: Record<string, string>;
  parametersD: Record<string, string>;
  parametersE: Record<string, string>;
}

export interface ProgramTemplate {
  id: string;
  name: string;
  methodId: string;
  methodName: string;
  columns: TemplateColumn[];
  createdAt: string;
}

interface TemplatesStore {
  version: string;
  templates: ProgramTemplate[];
}

const STORE_VERSION = '1.1';
const DEFAULT_STORE: TemplatesStore = { version: STORE_VERSION, templates: [] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function migrateLegacy(raw: unknown): TemplatesStore {
  // Support both legacy plain array and versioned { version, templates }
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : ((raw as { templates?: unknown[] })?.templates ?? []);
  return { version: STORE_VERSION, templates: list.map(migrateTemplate) };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTemplates() {
  const [store, setStore, isLoading] = useSupabaseStore<TemplatesStore>({
    tableName: 'program_templates',
    legacyKey: 'programTemplates',
    defaultValue: DEFAULT_STORE,
    migrate: migrateLegacy,
  });

  const templates = store.templates;

  const addTemplate = useCallback(
    async (template: Omit<ProgramTemplate, 'id' | 'createdAt'>): Promise<ProgramTemplate> => {
      const t: ProgramTemplate = {
        ...template,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      await setStore({ version: STORE_VERSION, templates: [...templates, t] });
      return t;
    },
    [templates, setStore],
  );

  const updateTemplate = useCallback(
    async (id: string, updates: Partial<Omit<ProgramTemplate, 'id' | 'createdAt'>>) => {
      await setStore({
        version: STORE_VERSION,
        templates: templates.map(t => (t.id === id ? { ...t, ...updates } : t)),
      });
    },
    [templates, setStore],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      await setStore({ version: STORE_VERSION, templates: templates.filter(t => t.id !== id) });
    },
    [templates, setStore],
  );

  const getTemplatesForMethod = useCallback(
    (methodId: string) => templates.filter(t => t.methodId === methodId),
    [templates],
  );

  return { templates, isLoading, addTemplate, updateTemplate, deleteTemplate, getTemplatesForMethod };
}
