import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { AthleteAnamnesis, AnamnesisField, AnamnesisTemplateSnapshot } from '@/types/anamnesis';

// ── DB row → TS type ──────────────────────────────────────────────────────────

interface DbAnamnesis {
  id: string;
  coach_user_id: string;
  athlete_local_id: string;
  template_id: string | null;
  template_snapshot: AnamnesisTemplateSnapshot;
  conducted_at: string;
  custom_questions: AnamnesisField[];
  field_values: Record<string, string>;
  custom_field_values: Record<string, string>;
  notes: string;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

function fromDb(row: DbAnamnesis): AthleteAnamnesis {
  return {
    id: row.id,
    coachUserId: row.coach_user_id,
    athleteLocalId: row.athlete_local_id,
    templateId: row.template_id,
    templateSnapshot: row.template_snapshot ?? { name: '', sections: [] },
    conductedAt: row.conducted_at,
    customQuestions: row.custom_questions ?? [],
    fieldValues: row.field_values ?? {},
    customFieldValues: row.custom_field_values ?? {},
    notes: row.notes ?? '',
    aiSummary: row.ai_summary ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAthleteAnamneses(athleteLocalId: string) {
  const { user } = useAuth();
  const [anamneses, setAnamneses] = useState<AthleteAnamnesis[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAnamneses = useCallback(async () => {
    if (!user || !athleteLocalId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('athlete_anamneses')
        .select('*')
        .eq('coach_user_id', user.id)
        .eq('athlete_local_id', athleteLocalId)
        .order('conducted_at', { ascending: false });

      if (error) throw error;
      setAnamneses((data as DbAnamnesis[]).map(fromDb));
    } catch (err) {
      console.error('[useAthleteAnamneses] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [user, athleteLocalId]);

  useEffect(() => {
    fetchAnamneses();
  }, [fetchAnamneses]);

  const createAnamnesis = useCallback(
    async (payload: Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'>): Promise<AthleteAnamnesis | null> => {
      if (!user) return null;
      try {
        const { data, error } = await supabase
          .from('athlete_anamneses')
          .insert({
            coach_user_id: user.id,
            athlete_local_id: payload.athleteLocalId,
            template_id: payload.templateId,
            template_snapshot: payload.templateSnapshot,
            conducted_at: payload.conductedAt,
            custom_questions: payload.customQuestions,
            field_values: payload.fieldValues,
            custom_field_values: payload.customFieldValues,
            notes: payload.notes,
            ai_summary: payload.aiSummary,
          })
          .select()
          .single();

        if (error) throw error;
        const created = fromDb(data as DbAnamnesis);
        setAnamneses((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        console.error('[useAthleteAnamneses] create error', err);
        return null;
      }
    },
    [user],
  );

  const updateAnamnesis = useCallback(
    async (id: string, updates: Partial<Omit<AthleteAnamnesis, 'id' | 'coachUserId' | 'athleteLocalId' | 'createdAt'>>): Promise<boolean> => {
      try {
        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (updates.templateId !== undefined) dbUpdates.template_id = updates.templateId;
        if (updates.templateSnapshot !== undefined) dbUpdates.template_snapshot = updates.templateSnapshot;
        if (updates.conductedAt !== undefined) dbUpdates.conducted_at = updates.conductedAt;
        if (updates.customQuestions !== undefined) dbUpdates.custom_questions = updates.customQuestions;
        if (updates.fieldValues !== undefined) dbUpdates.field_values = updates.fieldValues;
        if (updates.customFieldValues !== undefined) dbUpdates.custom_field_values = updates.customFieldValues;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.aiSummary !== undefined) dbUpdates.ai_summary = updates.aiSummary;

        const { data, error } = await supabase
          .from('athlete_anamneses')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        const updated = fromDb(data as DbAnamnesis);
        setAnamneses((prev) => prev.map((a) => (a.id === id ? updated : a)));
        return true;
      } catch (err) {
        console.error('[useAthleteAnamneses] update error', err);
        return false;
      }
    },
    [],
  );

  const deleteAnamnesis = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('athlete_anamneses').delete().eq('id', id);
      if (error) throw error;
      setAnamneses((prev) => prev.filter((a) => a.id !== id));
      return true;
    } catch (err) {
      console.error('[useAthleteAnamneses] delete error', err);
      return false;
    }
  }, []);

  return { anamneses, loading, createAnamnesis, updateAnamnesis, deleteAnamnesis };
}
