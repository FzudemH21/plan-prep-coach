/**
 * useCoachPrivacyNotice — the coach's privacy notice (DE + EN) shown in the anamnesis form link,
 * with the company name and contact used in the consent texts. Every change of the notice texts
 * raises the version; consents store the version the athlete agreed to.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface CoachPrivacyNotice {
  companyName: string;
  contactEmail: string;
  noticeDe: string;
  noticeEn: string;
  version: number;
  updatedAt: string | null;
}

const EMPTY: CoachPrivacyNotice = { companyName: '', contactEmail: '', noticeDe: '', noticeEn: '', version: 0, updatedAt: null };

/** Ready for the form: company, contact and both notice texts are there */
export function isPrivacyNoticeComplete(n: CoachPrivacyNotice | null): boolean {
  return !!n && !!n.companyName.trim() && !!n.contactEmail.trim() && !!n.noticeDe.trim() && !!n.noticeEn.trim();
}

export function useCoachPrivacyNotice() {
  const { user } = useAuth();
  const [notice, setNotice] = useState<CoachPrivacyNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('coach_privacy_notices')
        .select('company_name, contact_email, notice_de, notice_en, version, updated_at')
        .eq('coach_user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (err) setError(err.message);
      setNotice(data ? {
        companyName: data.company_name as string,
        contactEmail: data.contact_email as string,
        noticeDe: data.notice_de as string,
        noticeEn: data.notice_en as string,
        version: data.version as number,
        updatedAt: data.updated_at as string,
      } : EMPTY);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const save = useCallback(async (next: Omit<CoachPrivacyNotice, 'version' | 'updatedAt'>): Promise<void> => {
    if (!user) throw new Error('Not signed in');
    const current = notice ?? EMPTY;
    const textChanged = next.noticeDe !== current.noticeDe || next.noticeEn !== current.noticeEn
      || next.companyName !== current.companyName || next.contactEmail !== current.contactEmail;
    const version = current.version === 0 ? 1 : textChanged ? current.version + 1 : current.version;
    const now = new Date().toISOString();
    const { error: err } = await supabase.from('coach_privacy_notices').upsert({
      coach_user_id: user.id,
      company_name: next.companyName.trim(),
      contact_email: next.contactEmail.trim(),
      notice_de: next.noticeDe,
      notice_en: next.noticeEn,
      version,
      updated_at: now,
    }, { onConflict: 'coach_user_id' });
    if (err) {
      throw new Error(/coach_privacy_notices/i.test(err.message)
        ? 'Saving needs the latest Supabase migration (20261002_anamnesis_form_link.sql).'
        : err.message);
    }
    setNotice({ ...next, companyName: next.companyName.trim(), contactEmail: next.contactEmail.trim(), version, updatedAt: now });
  }, [user, notice]);

  return { notice, loading, error, save };
}
