/**
 * Coach side of the anamnesis form link:
 * - PrivacyNoticeEditor / PrivacyNoticeDialog: the privacy notice (DE + EN) the form shows
 * - SendFormLinkDialog: pick a template → a record waiting for the athlete + its link
 * - FormLinkBox: the link of a waiting record (copy, share, renew, withdraw)
 * - ProfileAnswersBanner: take the athlete's "About you" answers over into the profile
 */
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Copy, Link2, Loader2, RefreshCw, Send, Share2, ShieldCheck, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAnamnesisTemplates } from '@/hooks/useAnamnesisTemplates';
import { isPrivacyNoticeComplete, type CoachPrivacyNoticeState } from '@/hooks/useCoachPrivacyNotice';
import { anamnesisFormUrl, FORM_LINK_DAYS } from '@/hooks/useAthleteAnamneses';
import { isAthleteSection, type AthleteAnamnesis, type AnamnesisTemplateSnapshot, type AnamnesisProfileAnswers } from '@/types/anamnesis';
import { ACTIVITY_LEVEL_LABELS, SEX_LABELS, type Athlete } from '@/types/athlete';

// ── Privacy notice ────────────────────────────────────────────────────────────

/** The notice texts, with company name + contact email shown from the coach profile.
 *  Used in the Coach Profile settings and in the dialog of the anamnesis tab. */
export function PrivacyNoticeEditor({ privacy, onSaved, onCancel }: {
  privacy: CoachPrivacyNoticeState;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { notice, companyName, contactEmail, loading, save } = privacy;
  const { toast } = useToast();
  const [noticeDe, setNoticeDe] = useState('');
  const [noticeEn, setNoticeEn] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!notice) return;
    setNoticeDe(notice.noticeDe);
    setNoticeEn(notice.noticeEn);
  }, [notice]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ noticeDe, noticeEn });
      toast({ title: 'Privacy notice saved' });
      onSaved?.();
    } catch (err) {
      toast({ title: 'Could not save', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  const dirty = noticeDe !== (notice?.noticeDe ?? '') || noticeEn !== (notice?.noticeEn ?? '');
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
        <p><span className="text-muted-foreground">Company:</span> {companyName || <span className="text-amber-700">not set — add the business name under Report Branding</span>}</p>
        <p><span className="text-muted-foreground">Contact email:</span> {contactEmail || <span className="text-amber-700">not set — add it under Personal Information</span>}</p>
        <p className="text-xs text-muted-foreground">
          From your Coach Profile (Settings). Both appear in the consent text of the form.
          {notice && notice.version > 0 && ` Notice version ${notice.version}${notice.updatedAt ? ` (${format(parseISO(notice.updatedAt), 'd MMM yyyy')})` : ''}; changing the texts creates a new version.`}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Privacy notice — German</Label>
        <Textarea className="min-h-[180px] text-sm" value={noticeDe} onChange={e => setNoticeDe(e.target.value)} placeholder="Paste the German privacy notice (Datenschutzhinweise)…" />
      </div>
      <div className="space-y-1.5">
        <Label>Privacy notice — English</Label>
        <Textarea className="min-h-[180px] text-sm" value={noticeEn} onChange={e => setNoticeEn(e.target.value)} placeholder="Paste the English privacy notice…" />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save privacy notice
        </Button>
      </div>
    </div>
  );
}

/** `privacy` = the caller's useCoachPrivacyNotice(), so a save shows up there at once */
export function PrivacyNoticeDialog({ open, onClose, privacy }: {
  open: boolean;
  onClose: () => void;
  privacy: CoachPrivacyNoticeState;
}) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Privacy notice for the anamnesis form</DialogTitle>
          <DialogDescription>
            Shown to athletes before they consent in the form link. Also editable in Coach Profile → Settings.
          </DialogDescription>
        </DialogHeader>
        <PrivacyNoticeEditor privacy={privacy} onSaved={onClose} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}

// ── Link box ──────────────────────────────────────────────────────────────────

export function FormLinkBox({ record, athleteName, onRenew, onWithdraw }: {
  record: AthleteAnamnesis;
  athleteName: string;
  onRenew: () => Promise<boolean>;
  onWithdraw: () => Promise<boolean>;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'renew' | 'withdraw' | null>(null);
  if (!record.formToken || record.formStatus !== 'sent') return null;
  const url = anamnesisFormUrl(record.formToken);
  const expired = !!record.formExpiresAt && new Date(record.formExpiresAt) < new Date();
  const expiresLabel = record.formExpiresAt ? format(parseISO(record.formExpiresAt), 'd MMM yyyy') : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Could not copy', description: url });
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Anamnesis', text: `Anamnesis for ${athleteName}`, url });
    } catch { /* cancelled */ }
  };
  const run = async (kind: 'renew' | 'withdraw') => {
    setBusy(kind);
    const ok = kind === 'renew' ? await onRenew() : await onWithdraw();
    setBusy(null);
    toast(ok
      ? { title: kind === 'renew' ? 'New link created' : 'Link withdrawn', description: kind === 'renew' ? 'The old link no longer works.' : 'The athlete can no longer open the form.' }
      : { title: 'Something went wrong', variant: 'destructive' });
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
      <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5">
        <Link2 className="h-4 w-4" />
        {expired ? `Form link expired on ${expiresLabel}` : `Waiting for the athlete · link valid until ${expiresLabel}`}
      </p>
      {!expired && (
        <div className="flex gap-2">
          <Input readOnly value={url} className="h-8 text-xs bg-background" onFocus={e => e.target.select()} />
          <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={share} aria-label="Share link">
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={busy !== null} onClick={() => run('renew')}>
          {busy === 'renew' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {expired ? `New link (${FORM_LINK_DAYS} days)` : 'New link'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" disabled={busy !== null} onClick={() => run('withdraw')}>
          {busy === 'withdraw' ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          Withdraw link
        </Button>
      </div>
    </div>
  );
}

// ── Send dialog ───────────────────────────────────────────────────────────────

export function SendFormLinkDialog({ open, onClose, athleteName, privacy, onCreate, onRenew, onWithdraw }: {
  open: boolean;
  privacy: CoachPrivacyNoticeState;
  onClose: () => void;
  athleteName: string;
  onCreate: (templateId: string, snapshot: AnamnesisTemplateSnapshot) => Promise<AthleteAnamnesis>;
  onRenew: (id: string) => Promise<boolean>;
  onWithdraw: (id: string) => Promise<boolean>;
}) {
  const { templates, loading } = useAnamnesisTemplates();
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<AthleteAnamnesis | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    setTemplateId(prev => prev || templates[0]?.id || '');
  }, [open, templates]);

  const template = templates.find(t => t.id === templateId);
  const athleteSections = useMemo(() => (template?.sections ?? []).filter(isAthleteSection), [template]);
  const noticeReady = isPrivacyNoticeComplete(privacy);

  const handleCreate = async () => {
    if (!template) return;
    setCreating(true);
    try {
      const rec = await onCreate(template.id, { name: template.name, sections: template.sections });
      setCreated(rec);
    } catch (err) {
      toast({ title: 'Could not create the link', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" />Send anamnesis form to {athleteName}</DialogTitle>
            <DialogDescription>
              The athlete fills in "About you" and the sections marked "Filled in by the athlete" online — no login needed.
              The rest of the template stays for you in the first appointment.
            </DialogDescription>
          </DialogHeader>

          {created ? (
            <div className="space-y-3">
              <p className="text-sm">Send this link to {athleteName} (e.g. by WhatsApp or email). It is valid for {FORM_LINK_DAYS} days.</p>
              <FormLinkBox
                record={created}
                athleteName={athleteName}
                onRenew={async () => { const ok = await onRenew(created.id); if (ok) onClose(); return ok; }}
                onWithdraw={async () => { const ok = await onWithdraw(created.id); if (ok) onClose(); return ok; }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder={loading ? 'Loading…' : 'Choose a template'} /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {template && (
                  athleteSections.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      The athlete fills in: About you · {athleteSections.map(s => s.title || 'Untitled section').join(' · ')}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      Every section of this template is switched off for the athlete — edit the template first (the athlete would only see "About you").
                    </p>
                  )
                )}
              </div>
              {!noticeReady && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                  <p className="text-sm text-amber-900">
                    Before sending, add your privacy notice (German and English), plus the business name (Report Branding) and contact email (Personal Information) in your Coach Profile — the athlete must read the notice and consent in the form.
                  </p>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPrivacyOpen(true)}>
                    <ShieldCheck className="h-3.5 w-3.5" />Add privacy notice
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {created ? (
              <Button onClick={onClose}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!template || !noticeReady || creating} className="gap-1.5">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Create link
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PrivacyNoticeDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} privacy={privacy} />
    </>
  );
}

// ── Profile answers → athlete profile ─────────────────────────────────────────

type ProfilePatch = Partial<Pick<Athlete, 'firstName' | 'lastName' | 'birthday' | 'sex' | 'sports' | 'occupation' | 'dailyActivityLevel'>>;

interface ProfileChange { label: string; from: string; to: string }

/** What the athlete's answers would change on the profile */
export function profileChanges(athlete: Athlete, answers: AnamnesisProfileAnswers | null | undefined): { patch: ProfilePatch; changes: ProfileChange[] } {
  const patch: ProfilePatch = {};
  const changes: ProfileChange[] = [];
  if (!answers) return { patch, changes };
  const text = (label: string, key: 'firstName' | 'lastName' | 'occupation', value: string | undefined) => {
    const next = value?.trim();
    const cur = (athlete[key] ?? '').trim();
    if (next && next !== cur) { patch[key] = next; changes.push({ label, from: cur || '—', to: next }); }
  };
  text('First name', 'firstName', answers.firstName);
  text('Last name', 'lastName', answers.lastName);
  if (answers.birthday && answers.birthday !== athlete.birthday) {
    patch.birthday = answers.birthday;
    changes.push({ label: 'Date of birth', from: athlete.birthday ?? '—', to: answers.birthday });
  }
  if (answers.sex && answers.sex !== athlete.sex) {
    patch.sex = answers.sex;
    changes.push({ label: 'Sex', from: athlete.sex ? SEX_LABELS[athlete.sex] : '—', to: SEX_LABELS[answers.sex] });
  }
  const curSports = athlete.sports?.length ? athlete.sports : athlete.sport ? [athlete.sport] : [];
  if (answers.sports && answers.sports.length > 0 && answers.sports.join('|') !== curSports.join('|')) {
    patch.sports = answers.sports;
    changes.push({ label: 'Sports', from: curSports.join(', ') || '—', to: answers.sports.join(', ') });
  }
  text('Occupation', 'occupation', answers.occupation);
  if (answers.dailyActivityLevel && answers.dailyActivityLevel !== athlete.dailyActivityLevel) {
    patch.dailyActivityLevel = answers.dailyActivityLevel;
    changes.push({
      label: 'Activity level',
      from: athlete.dailyActivityLevel ? ACTIVITY_LEVEL_LABELS[athlete.dailyActivityLevel] : '—',
      to: ACTIVITY_LEVEL_LABELS[answers.dailyActivityLevel],
    });
  }
  return { patch, changes };
}

export function ProfileAnswersBanner({ athlete, record, onApply, onDismiss }: {
  athlete: Athlete;
  record: AthleteAnamnesis;
  onApply: (patch: ProfilePatch) => Promise<void>;
  onDismiss: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const { patch, changes } = profileChanges(athlete, record.athleteProfileAnswers);
  if (record.formStatus !== 'submitted' || record.profileAppliedAt || changes.length === 0) return null;
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
      <p className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
        <UserCheck className="h-4 w-4" />
        The athlete updated their details in the form
      </p>
      <ul className="text-xs text-blue-900 space-y-0.5">
        {changes.map(c => (
          <li key={c.label}><span className="font-medium">{c.label}:</span> {c.from} → {c.to}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" disabled={busy} onClick={async () => { setBusy(true); await onApply(patch); setBusy(false); }}>
          Apply to profile
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={async () => { setBusy(true); await onDismiss(); setBusy(false); }}>
          Keep profile as is
        </Button>
      </div>
    </div>
  );
}
