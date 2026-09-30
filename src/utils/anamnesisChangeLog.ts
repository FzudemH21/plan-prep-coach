/**
 * Change history of an anamnesis (table anamnesis_change_log, migration 20261010) — who changed
 * what and when: answers edited in edit mode, notes added / edited / deleted, the AI summary.
 * Entries are only ever added (the table has no update/delete rights); the time is the server's.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  AnamnesisAttachment, AnamnesisChange, AnamnesisChangeLogEntry, AnamnesisField, AnamnesisTemplateSnapshot,
} from '@/types/anamnesis';

/** The parts of an anamnesis that edit mode changes */
export interface AnamnesisAnswersSnapshot {
  conductedAt: string;
  templateSnapshot: AnamnesisTemplateSnapshot;
  customQuestions: AnamnesisField[];
  fieldValues: Record<string, string>;
  customFieldValues: Record<string, string>;
  attachments: AnamnesisAttachment[];
}

const LOG_CHANGED_EVENT = 'anamnesis-change-log-updated';

function shown(field: AnamnesisField | undefined, value: string | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return '—';
  if (field?.fieldType === 'boolean') return v === 'true' ? 'Yes' : v === 'false' ? 'No' : v;
  return v;
}

/** What changed between two versions of the answers (empty when nothing did) */
export function diffAnamnesis(before: AnamnesisAnswersSnapshot, after: AnamnesisAnswersSnapshot): AnamnesisChange[] {
  const changes: AnamnesisChange[] = [];
  if (before.conductedAt !== after.conductedAt) changes.push({ what: 'Date of session', from: before.conductedAt, to: after.conductedAt });
  if (before.templateSnapshot.name !== after.templateSnapshot.name) {
    changes.push({ what: 'Template', from: before.templateSnapshot.name || '—', to: after.templateSnapshot.name || '—' });
  }

  // Template answers — every field of both versions (a template switch changes the fields)
  const fieldsBefore = new Map(before.templateSnapshot.sections.flatMap(s => s.fields.map(f => [f.id, { f, s: s.title }] as const)));
  const fieldsAfter = new Map(after.templateSnapshot.sections.flatMap(s => s.fields.map(f => [f.id, { f, s: s.title }] as const)));
  const ids = [...new Set([...fieldsAfter.keys(), ...fieldsBefore.keys()])];
  for (const id of ids) {
    const meta = fieldsAfter.get(id) ?? fieldsBefore.get(id)!;
    const from = shown(meta.f, before.fieldValues[id]);
    const to = shown(meta.f, after.fieldValues[id]);
    if (from !== to) changes.push({ what: `${meta.s} › ${meta.f.label}`, from, to });
  }

  // Which sections the athlete fills in through the form link
  for (const section of after.templateSnapshot.sections) {
    const old = before.templateSnapshot.sections.find(s => s.id === section.id);
    if (!old) continue;
    const a = old.athleteFills !== false;
    const b = section.athleteFills !== false;
    if (a !== b) changes.push({ what: `${section.title} › Filled in by athlete`, from: a ? 'Yes' : 'No', to: b ? 'Yes' : 'No' });
  }

  // Custom questions
  const customBefore = new Map(before.customQuestions.map(f => [f.id, f]));
  const customAfter = new Map(after.customQuestions.map(f => [f.id, f]));
  for (const [id, f] of customAfter) {
    const old = customBefore.get(id);
    if (!old) { changes.push({ what: 'Custom question added', from: '—', to: f.label || '(no label)' }); }
    else if (old.label !== f.label) changes.push({ what: 'Custom question renamed', from: old.label || '(no label)', to: f.label || '(no label)' });
    const from = shown(f, before.customFieldValues[id]);
    const to = shown(f, after.customFieldValues[id]);
    if (from !== to) changes.push({ what: `Custom › ${f.label || '(no label)'}`, from, to });
  }
  for (const [id, f] of customBefore) {
    if (!customAfter.has(id)) changes.push({ what: 'Custom question removed', from: `${f.label || '(no label)'}: ${shown(f, before.customFieldValues[id])}`, to: '—' });
  }

  // Attachments
  const pathsBefore = new Set(before.attachments.map(a => a.path));
  const pathsAfter = new Set(after.attachments.map(a => a.path));
  for (const a of after.attachments) if (!pathsBefore.has(a.path)) changes.push({ what: 'Attachment added', from: '—', to: a.name });
  for (const a of before.attachments) if (!pathsAfter.has(a.path)) changes.push({ what: 'Attachment removed', from: a.name, to: '—' });

  return changes;
}

/** Adds an entry to the history. Failures are logged, never block the save itself. */
export async function logAnamnesisChange(
  anamnesisId: string,
  changedByName: string,
  summary: string,
  changes: AnamnesisChange[] = [],
): Promise<void> {
  const { error } = await supabase.from('anamnesis_change_log').insert({
    anamnesis_id: anamnesisId,
    changed_by_name: changedByName || null,
    summary,
    changes,
  });
  if (error) {
    console.error('[anamnesisChangeLog] could not save the change history entry', error);
    return;
  }
  window.dispatchEvent(new CustomEvent(LOG_CHANGED_EVENT, { detail: anamnesisId }));
}

interface DbLogRow {
  id: string;
  anamnesis_id: string;
  changed_at: string;
  changed_by_name: string | null;
  summary: string;
  changes: AnamnesisChange[] | null;
}

/** The history of one anamnesis, newest first; refreshes when an entry is added */
export function useAnamnesisChangeLog(anamnesisId: string | null | undefined) {
  const [entries, setEntries] = useState<AnamnesisChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(!!anamnesisId);

  const load = useCallback(async () => {
    if (!anamnesisId) { setEntries([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('anamnesis_change_log')
      .select('id, anamnesis_id, changed_at, changed_by_name, summary, changes')
      .eq('anamnesis_id', anamnesisId)
      .order('changed_at', { ascending: false });
    if (error) console.error('[anamnesisChangeLog] load error', error);
    setEntries(((data ?? []) as DbLogRow[]).map(r => ({
      id: r.id,
      anamnesisId: r.anamnesis_id,
      changedAt: r.changed_at,
      changedByName: r.changed_by_name ?? '',
      summary: r.summary,
      changes: r.changes ?? [],
    })));
    setLoading(false);
  }, [anamnesisId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onLogged = (e: Event) => { if ((e as CustomEvent<string>).detail === anamnesisId) void load(); };
    window.addEventListener(LOG_CHANGED_EVENT, onLogged);
    return () => window.removeEventListener(LOG_CHANGED_EVENT, onLogged);
  }, [anamnesisId, load]);

  return { entries, loading };
}
