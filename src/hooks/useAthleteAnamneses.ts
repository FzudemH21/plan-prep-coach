import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type {
  AthleteAnamnesis, AnamnesisField, AnamnesisTemplateSnapshot, AnamnesisAttachment, AnamnesisConsent, AnamnesisProfileAnswers,
} from '@/types/anamnesis';

/** Days an anamnesis form link stays open */
export const FORM_LINK_DAYS = 14;

/** Unguessable link key (256 bits, URL-safe) */
function newFormToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The public form address for a token */
export function anamnesisFormUrl(token: string): string {
  return `${window.location.origin}/anamnesis/${token}`;
}

function linkExpiry(): string {
  return new Date(Date.now() + FORM_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

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
  attachments: AnamnesisAttachment[];
  // Form link columns (migration 20261002) — absent before it is run
  form_token?: string | null;
  form_status?: 'sent' | 'submitted' | null;
  form_expires_at?: string | null;
  form_submitted_at?: string | null;
  form_language?: string | null;
  consent?: AnamnesisConsent | null;
  athlete_profile_answers?: AnamnesisProfileAnswers | null;
  profile_applied_at?: string | null;
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
    attachments: row.attachments ?? [],
    formToken: row.form_token ?? null,
    formStatus: row.form_status ?? null,
    formExpiresAt: row.form_expires_at ?? null,
    formSubmittedAt: row.form_submitted_at ?? null,
    formLanguage: row.form_language ?? null,
    consent: row.consent ?? null,
    athleteProfileAnswers: row.athlete_profile_answers ?? null,
    profileAppliedAt: row.profile_applied_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAthleteAnamneses(athleteLocalId: string) {
  const { user } = useAuth();
  const [anamneses, setAnamneses] = useState<AthleteAnamnesis[]>([]);
  // Loading until the first fetch is done (when there is something to fetch) — lists show a spinner, not "nothing here"
  const [loading, setLoading] = useState(!!athleteLocalId);

  const fetchAnamneses = useCallback(async () => {
    if (!athleteLocalId) { setLoading(false); return; }
    if (!user) return;
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
            attachments: payload.attachments ?? [],
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
        if (updates.attachments !== undefined) dbUpdates.attachments = updates.attachments;

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

  /** New record waiting for the athlete: the template's athlete sections are filled in online */
  const sendFormLink = useCallback(
    async (templateId: string | null, templateSnapshot: AnamnesisTemplateSnapshot): Promise<AthleteAnamnesis> => {
      if (!user) throw new Error('Not signed in');
      const today = new Date();
      const conductedAt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('athlete_anamneses')
        .insert({
          coach_user_id: user.id,
          athlete_local_id: athleteLocalId,
          template_id: templateId,
          template_snapshot: templateSnapshot,
          conducted_at: conductedAt,
          form_token: newFormToken(),
          form_status: 'sent',
          form_expires_at: linkExpiry(),
        })
        .select()
        .single();
      if (error) {
        throw new Error(/form_token|form_status|column/i.test(error.message)
          ? 'The form link needs the latest Supabase migration (20261002_anamnesis_form_link.sql).'
          : error.message);
      }
      const created = fromDb(data as DbAnamnesis);
      setAnamneses((prev) => [created, ...prev]);
      return created;
    },
    [user, athleteLocalId],
  );

  /** Form link changes: renew (new key, 14 more days) or withdraw (the link stops working) */
  const updateFormLink = useCallback(async (id: string, action: 'renew' | 'withdraw'): Promise<boolean> => {
    const patch = action === 'renew'
      ? { form_token: newFormToken(), form_status: 'sent', form_expires_at: linkExpiry() }
      : { form_token: null, form_status: null, form_expires_at: null };
    const { data, error } = await supabase
      .from('athlete_anamneses')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[useAthleteAnamneses] form link error', error); return false; }
    const updated = fromDb(data as DbAnamnesis);
    setAnamneses((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return true;
  }, []);

  /** The athlete's "About you" answers were taken over into the profile */
  const markProfileApplied = useCallback(async (id: string): Promise<void> => {
    const now = new Date().toISOString();
    const { error } = await supabase.from('athlete_anamneses').update({ profile_applied_at: now }).eq('id', id);
    if (!error) setAnamneses((prev) => prev.map((a) => (a.id === id ? { ...a, profileAppliedAt: now } : a)));
  }, []);

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

  return {
    anamneses, loading, refetch: fetchAnamneses, createAnamnesis, updateAnamnesis, deleteAnamnesis,
    sendFormLink, updateFormLink, markProfileApplied,
  };
}
