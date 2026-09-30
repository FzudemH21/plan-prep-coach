import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { AnamnesisTemplate, AnamnesisSection } from '@/types/anamnesis';
import { DEFAULT_ANAMNESIS_TEMPLATE } from '@/types/anamnesis';

// ── DB row → TS type ──────────────────────────────────────────────────────────

interface DbTemplate {
  id: string;
  coach_user_id: string;
  name: string;
  sections: AnamnesisSection[];
  created_at: string;
  updated_at: string;
}

function fromDb(row: DbTemplate): AnamnesisTemplate {
  return {
    id: row.id,
    coachUserId: row.coach_user_id,
    name: row.name,
    sections: row.sections ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Shared list ───────────────────────────────────────────────────────────────
// One list for every component that uses the hook (record form, send-link dialog, template
// editor …): an edit anywhere shows everywhere at once. Before, each component kept its own copy
// loaded on mount, so e.g. the send-link dialog built links from an outdated template.
let shared: AnamnesisTemplate[] = [];
const subscribers = new Set<(t: AnamnesisTemplate[]) => void>();
function publish(next: AnamnesisTemplate[]) {
  shared = next;
  subscribers.forEach((fn) => fn(next));
}
/** One fetch at a time — parallel mounts would otherwise each seed the default template */
let inflight: Promise<void> | null = null;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAnamnesisTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<AnamnesisTemplate[]>(shared);
  // Loading until the first fetch is done (when there is something to fetch) — lists show a spinner, not "nothing here"
  const [loading, setLoading] = useState(shared.length === 0);

  useEffect(() => {
    subscribers.add(setTemplates);
    setTemplates(shared);
    return () => { subscribers.delete(setTemplates); };
  }, []);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    if (inflight) { await inflight; setLoading(false); return; }
    setLoading(true);
    inflight = (async () => {
      try {
        const { data, error } = await supabase
          .from('anamnesis_templates')
          .select('*')
          .eq('coach_user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        const fetched = (data as DbTemplate[]).map(fromDb);
        if (fetched.length === 0) {
          // First-time use: seed the default template as a real editable record
          const { data: seeded } = await supabase
            .from('anamnesis_templates')
            .insert({
              coach_user_id: user.id,
              name: DEFAULT_ANAMNESIS_TEMPLATE.name,
              sections: DEFAULT_ANAMNESIS_TEMPLATE.sections,
            })
            .select()
            .single();
          publish(seeded ? [fromDb(seeded as DbTemplate)] : []);
        } else {
          publish(fetched);
        }
      } catch (err) {
        console.error('[useAnamnesisTemplates] fetch error', err);
      }
    })();
    try { await inflight; } finally { inflight = null; setLoading(false); }
  }, [user]);

  // Fresh from the database whenever a component using the list mounts (dialogs mount on open)
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(
    async (name: string, sections: AnamnesisSection[]): Promise<AnamnesisTemplate | null> => {
      if (!user) return null;
      try {
        const { data, error } = await supabase
          .from('anamnesis_templates')
          .insert({ coach_user_id: user.id, name, sections })
          .select()
          .single();

        if (error) throw error;
        const created = fromDb(data as DbTemplate);
        publish([...shared, created]);
        return created;
      } catch (err) {
        console.error('[useAnamnesisTemplates] create error', err);
        return null;
      }
    },
    [user],
  );

  const updateTemplate = useCallback(
    async (id: string, updates: { name?: string; sections?: AnamnesisSection[] }): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from('anamnesis_templates')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        const updated = fromDb(data as DbTemplate);
        publish(shared.map((t) => (t.id === id ? updated : t)));
        return true;
      } catch (err) {
        console.error('[useAnamnesisTemplates] update error', err);
        return false;
      }
    },
    [],
  );

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('anamnesis_templates').delete().eq('id', id);
      if (error) throw error;
      publish(shared.filter((t) => t.id !== id));
      return true;
    } catch (err) {
      console.error('[useAnamnesisTemplates] delete error', err);
      return false;
    }
  }, []);

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate };
}
