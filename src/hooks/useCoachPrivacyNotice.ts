/**
 * useCoachPrivacyNotice — the coach's privacy notice (DE + EN) shown in the anamnesis form link.
 *
 * The company name (Report Branding) and the contact email (Personal Information) come from the
 * coach profile — one place for them; the form reads them from there too (migration 20261004).
 * Copies are written with the notice as a fallback. Every change of the notice texts raises the
 * version; consents store the version the athlete agreed to.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCoachProfile } from '@/hooks/useCoachProfile';

export interface CoachPrivacyNotice {
  noticeDe: string;
  noticeEn: string;
  version: number;
  updatedAt: string | null;
}

const EMPTY: CoachPrivacyNotice = { noticeDe: '', noticeEn: '', version: 0, updatedAt: null };

export function useCoachPrivacyNotice() {
  const { user } = useAuth();
  const { profile } = useCoachProfile();
  const [notice, setNotice] = useState<CoachPrivacyNotice | null>(null);
  const [loading, setLoading] = useState(true);

  const companyName = profile?.branding?.businessName?.trim() ?? '';
  const contactEmail = profile?.contactEmail?.trim() ?? '';

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('coach_privacy_notices')
        .select('notice_de, notice_en, version, updated_at')
        .eq('coach_user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setNotice(data ? {
        noticeDe: data.notice_de as string,
        noticeEn: data.notice_en as string,
        version: data.version as number,
        updatedAt: data.updated_at as string,
      } : EMPTY);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const save = useCallback(async (texts: { noticeDe: string; noticeEn: string }): Promise<void> => {
    if (!user) throw new Error('Not signed in');
    const current = notice ?? EMPTY;
    const changed = texts.noticeDe !== current.noticeDe || texts.noticeEn !== current.noticeEn;
    const version = current.version === 0 ? 1 : changed ? current.version + 1 : current.version;
    const now = new Date().toISOString();
    const { error } = await supabase.from('coach_privacy_notices').upsert({
      coach_user_id: user.id,
      company_name: companyName,
      contact_email: contactEmail,
      notice_de: texts.noticeDe,
      notice_en: texts.noticeEn,
      version,
      updated_at: now,
    }, { onConflict: 'coach_user_id' });
    if (error) {
      throw new Error(/coach_privacy_notices/i.test(error.message)
        ? 'Saving needs the latest Supabase migration (20261002_anamnesis_form_link.sql).'
        : error.message);
    }
    setNotice({ ...texts, version, updatedAt: now });
  }, [user, notice, companyName, contactEmail]);

  return { notice, companyName, contactEmail, loading, save };
}

export type CoachPrivacyNoticeState = ReturnType<typeof useCoachPrivacyNotice>;

/** Ready for the form: company, contact email and both notice texts are there */
export function isPrivacyNoticeComplete(p: CoachPrivacyNoticeState): boolean {
  return !!p.companyName && !!p.contactEmail && !!p.notice?.noticeDe.trim() && !!p.notice?.noticeEn.trim();
}
