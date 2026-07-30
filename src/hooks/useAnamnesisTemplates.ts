import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { AnamnesisTemplate, AnamnesisSection } from '@/types/anamnesis';

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

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAnamnesisTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<AnamnesisTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('anamnesis_templates')
        .select('*')
        .eq('coach_user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTemplates((data as DbTemplate[]).map(fromDb));
    } catch (err) {
      console.error('[useAnamnesisTemplates] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

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
        setTemplates((prev) => [...prev, created]);
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
        setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
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
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      return true;
    } catch (err) {
      console.error('[useAnamnesisTemplates] delete error', err);
      return false;
    }
  }, []);

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate };
}
