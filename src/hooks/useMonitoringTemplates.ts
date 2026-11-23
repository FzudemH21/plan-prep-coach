/**
 * useMonitoringTemplates — saved check-in setups ("Save as Template" / "Load Template" in an
 * athlete's monitoring setup), reusable across athletes.
 *
 * Stored in Supabase, one row per template (coach_records, store "monitoring_templates", since
 * 2026-11-23) and shared with the organization like the other libraries. Before, they lived only in
 * the browser that saved them (localStorage 'monitoring_templates_v1'): templates still left in a
 * browser are added to the library and removed from that browser once each is confirmed stored.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createRecordStore, useRecordStore } from '@/lib/recordStore';
import { joinFields, splitFields } from '@/lib/recordSplit';
import type { MonitoringBlock } from '@/types/athlete';

export interface MonitoringTemplate {
  id: string;
  name: string;
  blocks: MonitoringBlock[];
  createdAt: string;
}

interface MonitoringTemplatesData {
  version: '1';
  templates: MonitoringTemplate[];
}

const LEGACY_KEY = 'monitoring_templates_v1';
const DEFAULT_DATA: MonitoringTemplatesData = { version: '1', templates: [] };

function isTemplate(value: unknown): value is MonitoringTemplate {
  const t = value as Partial<MonitoringTemplate> | null;
  return !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.blocks);
}

function normalize(raw: unknown): MonitoringTemplatesData {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<MonitoringTemplatesData>;
  const list = Array.isArray(raw) ? raw : parsed.templates;
  return { version: '1', templates: Array.isArray(list) ? list.filter(isTemplate) : [] };
}

function readLegacy(): MonitoringTemplate[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? normalize(JSON.parse(raw)).templates : [];
  } catch {
    return [];
  }
}

const LISTS = { templates: 'm:' };

export const monitoringTemplatesStore = createRecordStore<MonitoringTemplatesData>({
  table: 'coach_records',
  store: 'monitoring_templates',
  area: 'libraries',
  sharedMayBeEmpty: true,
  label: 'monitoring templates',
  defaultValue: () => DEFAULT_DATA,
  migrate: normalize,
  split: data => splitFields(data, LISTS),
  join: records => normalize(joinFields(records, LISTS, DEFAULT_DATA)),
  guardedPrefix: id => id.startsWith('m:'),
  refuseEmptying: true,
  cacheKey: 'coach_records_monitoring_templates_sb_cache',
});

/** Only one instance moves this browser's old templates per page load */
let legacyMergeDone = false;

export function useMonitoringTemplates() {
  const { user } = useAuth();
  const [stored, save, isLoading] = useRecordStore(monitoringTemplatesStore);
  const data = normalize(stored);

  // Latest data, so two changes before the next render build on each other
  const latest = useRef<MonitoringTemplatesData>(data);
  const seen = useRef<MonitoringTemplatesData>(stored);
  if (stored !== seen.current) {
    seen.current = stored;
    latest.current = data;
  }

  const update = useCallback(async (updater: (prev: MonitoringTemplatesData) => MonitoringTemplatesData) => {
    const next = updater(latest.current);
    latest.current = next;
    await save(next);
  }, [save]);

  // Templates saved in this browser before they were stored in Supabase: add the missing ones
  useEffect(() => {
    if (isLoading || !user || legacyMergeDone) return;
    const legacy = readLegacy();
    if (legacy.length === 0) return;
    legacyMergeDone = true;
    (async () => {
      const ids = new Set(latest.current.templates.map(t => t.id));
      const missing = legacy.filter(t => !ids.has(t.id));
      if (missing.length > 0) await update(prev => ({ ...prev, templates: [...prev.templates, ...missing] }));
      // The browser copy goes only once every template of it is confirmed in Supabase
      const saved = monitoringTemplatesStore.savedIds();
      if (legacy.every(t => saved.has(`m:${t.id}`))) localStorage.removeItem(LEGACY_KEY);
      else legacyMergeDone = false; // try again on the next load
    })().catch(err => { legacyMergeDone = false; console.error('[monitoringTemplates] adding this browser\'s templates failed', err); });
  }, [isLoading, user, update]);

  const addTemplate = useCallback((name: string, blocks: MonitoringBlock[]) => update(prev => ({
    ...prev,
    templates: [...prev.templates, {
      id: `mt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      blocks,
      createdAt: new Date().toISOString(),
    }],
  })), [update]);

  const deleteTemplate = useCallback((id: string) => update(prev => ({
    ...prev,
    templates: prev.templates.filter(t => t.id !== id),
  })), [update]);

  return { templates: data.templates, isLoading, addTemplate, deleteTemplate };
}
