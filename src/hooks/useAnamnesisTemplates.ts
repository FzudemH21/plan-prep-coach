import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { AnamnesisTemplate, AnamnesisSection, AnamnesisLang, AnamnesisTemplateTranslation, AnamnesisProfileSteps } from '@/types/anamnesis';

/** Main language + translation of name / intro (columns of migration 20261019) and the "About
 *  you" steps (column of 20261025_anamnesis_profile_steps) */
export interface TemplateLanguageInfo {
  language?: AnamnesisLang;
  translations?: Partial<Record<AnamnesisLang, AnamnesisTemplateTranslation>>;
  profileSteps?: AnamnesisProfileSteps;
}

/** The language columns, or nothing when unset — so saving works before the migration is run */
function languageColumns(info?: TemplateLanguageInfo): Record<string, unknown> {
  if (!info) return {};
  const out: Record<string, unknown> = {};
  if (info.language) out.language = info.language;
  if (info.translations && Object.keys(info.translations).length) out.translations = info.translations;
  if (info.profileSteps !== undefined) out.profile_steps = info.profileSteps;
  return out;
}

const missingLanguageColumn = (message?: string) => !!message && /(language|translations|profile_steps)/.test(message);
import { DEFAULT_ANAMNESIS_TEMPLATE } from '@/types/anamnesis';

// ── DB row → TS type ──────────────────────────────────────────────────────────

interface DbTemplate {
  id: string;
  coach_user_id: string;
  name: string;
  sections: AnamnesisSection[];
  intro_text?: string | null;
  language?: string | null;
  translations?: Partial<Record<AnamnesisLang, AnamnesisTemplateTranslation>> | null;
  profile_steps?: AnamnesisProfileSteps | null;
  created_at: string;
  updated_at: string;
}

function fromDb(row: DbTemplate): AnamnesisTemplate {
  return {
    id: row.id,
    coachUserId: row.coach_user_id,
    name: row.name,
    sections: row.sections ?? [],
    introText: row.intro_text ?? undefined,
    language: row.language === 'en' ? 'en' : row.language === 'de' ? 'de' : undefined,
    translations: row.translations ?? undefined,
    profileSteps: row.profile_steps ?? undefined,
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
    async (name: string, sections: AnamnesisSection[], introText?: string, languageInfo?: TemplateLanguageInfo): Promise<AnamnesisTemplate | null> => {
      if (!user) return null;
      try {
        // intro_text only when there is one (the column comes with migration 20261007)
        const base = { coach_user_id: user.id, name, sections, ...(introText?.trim() ? { intro_text: introText.trim() } : {}) };
        const insert = (row: Record<string, unknown>) => supabase.from('anamnesis_templates').insert(row).select().single();
        let { data, error } = await insert({ ...base, ...languageColumns(languageInfo) });
        if (error && missingLanguageColumn(error.message)) {
          // Language columns not there yet (migration 20261019) — the questions' translations are
          // kept in the sections; only the translated name / intro and the main language are left out
          console.warn('[useAnamnesisTemplates] language columns missing — saved without them');
          ({ data, error } = await insert(base));
        }

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
    async (id: string, updates: { name?: string; sections?: AnamnesisSection[]; introText?: string } & TemplateLanguageInfo): Promise<boolean> => {
      try {
        const { introText, language, translations, profileSteps, ...rest } = updates;
        const current = shared.find((t) => t.id === id);
        // intro_text only when it is set or changes (the column comes with migration 20261007)
        const introChange = introText !== undefined && (introText.trim() || current?.introText)
          ? { intro_text: introText.trim() || null }
          : {};
        const update = (row: Record<string, unknown>) => supabase
          .from('anamnesis_templates')
          .update(row)
          .eq('id', id)
          .select()
          .single();
        const base = { ...rest, ...introChange, updated_at: new Date().toISOString() };
        let { data, error } = await update({ ...base, ...languageColumns({ language, translations, profileSteps }) });
        if (error && missingLanguageColumn(error.message)) {
          console.warn('[useAnamnesisTemplates] language columns missing — saved without them');
          ({ data, error } = await update(base));
        }

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
