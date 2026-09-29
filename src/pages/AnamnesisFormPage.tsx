/**
 * AnamnesisFormPage — public page behind an anamnesis form link (/anamnesis/:token), no login.
 *
 * The athlete completes "About you" (pre-filled from their profile) and the template sections the
 * coach marked "Filled in by the athlete", reads the coach's privacy notice and gives consent
 * (a parent / guardian for athletes under 16), then submits. Answers are saved as a draft while
 * typing, so the link can be finished later until it expires. All reads and writes go through the
 * token-checked database functions of migration 20261002_anamnesis_form_link.
 *
 * The form's own texts are German or English (browser language, switchable); the questions appear
 * as the coach wrote them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AnamnesisField, AnamnesisProfileAnswers, AnamnesisSection } from '@/types/anamnesis';

type Lang = 'de' | 'en';

interface FormData {
  status: 'open' | 'submitted' | 'expired';
  expiresAt?: string;
  templateName?: string;
  sections?: AnamnesisSection[];
  values?: Record<string, string>;
  profile?: AnamnesisProfileAnswers | null;
  language?: Lang | null;
  companyName?: string;
  contactEmail?: string;
  noticeDe?: string;
  noticeEn?: string;
}

const TEXT = {
  de: {
    title: 'Anamnese',
    intro: (company: string) => `Bitte beantworte die folgenden Fragen für ${company}. Deine Antworten werden beim Tippen gespeichert – du kannst den Link bis zum Absenden jederzeit wieder öffnen und weitermachen.`,
    openUntil: (d: string) => `Der Link ist gültig bis ${d}.`,
    aboutYou: 'Über dich',
    firstName: 'Vorname', lastName: 'Nachname', birthday: 'Geburtsdatum', sex: 'Geschlecht',
    sports: 'Sportart(en)', sportsHint: 'Mehrere mit Komma trennen', occupation: 'Beruf', activity: 'Aktivität im Alltag',
    sexes: { male: 'Männlich', female: 'Weiblich', other: 'Divers' },
    activities: {
      sedentary: 'Kaum aktiv (wenig oder kein Sport)',
      lightly_active: 'Leicht aktiv (1–3 Tage/Woche)',
      moderately_active: 'Mäßig aktiv (3–5 Tage/Woche)',
      very_active: 'Sehr aktiv (6–7 Tage/Woche)',
      extremely_active: 'Extrem aktiv (2× täglich)',
    },
    choose: 'Bitte wählen…', yes: 'Ja', no: 'Nein',
    consentTitle: 'Datenschutz und Einwilligung',
    readNotice: 'Datenschutzhinweise lesen',
    privacyAck: (company: string) => `Ich habe die Datenschutzhinweise von ${company} gelesen.`,
    healthConsent: (company: string, email: string) => `Ich willige ausdrücklich ein, dass ${company} meine in diesem Formular angegebenen Gesundheitsdaten (z. B. Beschwerden, Verletzungen, Vorerkrankungen, Medikamente) sowie die im Erstgespräch erhobenen Befunde zum Zweck meiner Trainingsbetreuung und physiotherapeutischen Versorgung verarbeitet – einschließlich einer KI-gestützten Zusammenfassung ohne Namensnennung durch einen Dienstleister in den USA, wie in den Datenschutzhinweisen beschrieben. Die Einwilligung ist freiwillig. Ich kann sie jederzeit mit Wirkung für die Zukunft widerrufen, z. B. per E-Mail an ${email}.`,
    minorNote: 'Da der Athlet jünger als 16 Jahre ist, muss ein Erziehungsberechtigter einwilligen.',
    guardianName: 'Name des Erziehungsberechtigten',
    guardianConsent: (athlete: string, company: string, email: string) => `Ich bin erziehungsberechtigt für ${athlete} und willige ausdrücklich ein, dass ${company} die in diesem Formular angegebenen Gesundheitsdaten meines Kindes sowie die im Erstgespräch erhobenen Befunde zum Zweck der Trainingsbetreuung und physiotherapeutischen Versorgung verarbeitet – einschließlich einer KI-gestützten Zusammenfassung ohne Namensnennung durch einen Dienstleister in den USA, wie in den Datenschutzhinweisen beschrieben. Die Einwilligung ist freiwillig und jederzeit mit Wirkung für die Zukunft widerrufbar, z. B. per E-Mail an ${email}.`,
    submit: 'Absenden', submitting: 'Wird gesendet…',
    saved: 'Gespeichert', saving: 'Speichert…', saveFailed: 'Nicht gespeichert – bitte Verbindung prüfen',
    submitError: 'Das Absenden hat nicht geklappt. Bitte versuche es noch einmal.',
    doneTitle: 'Vielen Dank!',
    done: (company: string) => `Deine Antworten wurden an ${company} gesendet.`,
    doneAlready: 'Diese Anamnese wurde bereits abgeschickt. Vielen Dank!',
    expiredTitle: 'Link nicht mehr gültig',
    expired: 'Dieser Link ist abgelaufen oder wurde zurückgezogen. Bitte frag deinen Trainer nach einem neuen Link.',
    notFound: 'Dieser Link ist ungültig. Bitte prüfe, ob du ihn vollständig kopiert hast.',
    loadError: 'Die Anamnese konnte nicht geladen werden. Bitte später erneut versuchen.',
    noticeMissing: 'Die Datenschutzhinweise sind noch nicht hinterlegt. Bitte wende dich an deinen Trainer.',
    close: 'Schließen',
  },
  en: {
    title: 'Anamnesis',
    intro: (company: string) => `Please answer the questions below for ${company}. Your answers are saved as you type — you can reopen this link and continue any time until you submit.`,
    openUntil: (d: string) => `This link is valid until ${d}.`,
    aboutYou: 'About you',
    firstName: 'First name', lastName: 'Last name', birthday: 'Date of birth', sex: 'Sex',
    sports: 'Sport(s)', sportsHint: 'Separate several with commas', occupation: 'Occupation', activity: 'Daily activity level',
    sexes: { male: 'Male', female: 'Female', other: 'Other' },
    activities: {
      sedentary: 'Sedentary (little or no exercise)',
      lightly_active: 'Lightly active (1–3 days/week)',
      moderately_active: 'Moderately active (3–5 days/week)',
      very_active: 'Very active (6–7 days/week)',
      extremely_active: 'Extremely active (2× per day)',
    },
    choose: 'Please choose…', yes: 'Yes', no: 'No',
    consentTitle: 'Privacy and consent',
    readNotice: 'Read the privacy notice',
    privacyAck: (company: string) => `I have read the privacy notice of ${company}.`,
    healthConsent: (company: string, email: string) => `I explicitly consent to ${company} processing the health data I provide in this form (e.g. complaints, injuries, medical conditions, medication) and the findings from the first appointment for the purpose of my training support and physiotherapy care – including an AI-assisted summary without my name by a provider in the USA, as described in the privacy notice. This consent is voluntary. I can withdraw it at any time with effect for the future, e.g. by email to ${email}.`,
    minorNote: 'As the athlete is under 16, a parent or legal guardian has to give consent.',
    guardianName: "Parent's / guardian's name",
    guardianConsent: (athlete: string, company: string, email: string) => `I am the parent or legal guardian of ${athlete} and explicitly consent to ${company} processing my child's health data provided in this form and the findings from the first appointment for the purpose of training support and physiotherapy care – including an AI-assisted summary without the name by a provider in the USA, as described in the privacy notice. This consent is voluntary and can be withdrawn at any time with effect for the future, e.g. by email to ${email}.`,
    submit: 'Submit', submitting: 'Submitting…',
    saved: 'Saved', saving: 'Saving…', saveFailed: 'Not saved — please check your connection',
    submitError: 'Submitting did not work. Please try again.',
    doneTitle: 'Thank you!',
    done: (company: string) => `Your answers have been sent to ${company}.`,
    doneAlready: 'This anamnesis has already been submitted. Thank you!',
    expiredTitle: 'Link no longer valid',
    expired: 'This link has expired or was withdrawn. Please ask your coach for a new one.',
    notFound: 'This link is not valid. Please check that you copied all of it.',
    loadError: 'The anamnesis could not be loaded. Please try again later.',
    noticeMissing: 'The privacy notice has not been added yet. Please contact your coach.',
    close: 'Close',
  },
} as const;

function browserLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Full years between a yyyy-MM-dd birthday and today */
function ageFrom(birthday: string | undefined): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const b = new Date(`${birthday}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

const inputClass = 'text-base h-11';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function SelectBox({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn('w-full rounded-md border border-input bg-background px-3', inputClass, !value && 'text-muted-foreground')}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function QuestionInput({ field, value, onChange, lang }: {
  field: AnamnesisField; value: string; onChange: (v: string) => void; lang: Lang;
}) {
  const t = TEXT[lang];
  switch (field.fieldType) {
    case 'textarea':
      return <Textarea className="text-base min-h-[96px]" placeholder={field.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
    case 'number':
      return <Input type="number" inputMode="decimal" className={inputClass} placeholder={field.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
    case 'select':
      return <SelectBox value={value} onChange={onChange} placeholder={t.choose} options={(field.options ?? []).map(o => ({ value: o, label: o }))} />;
    case 'boolean':
      return (
        <div className="flex gap-2">
          {([['true', t.yes], ['false', t.no]] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onChange(value === val ? '' : val)}
              className={cn(
                'min-h-[44px] min-w-[88px] px-4 rounded-md text-base border transition-colors',
                value === val ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input active:bg-accent',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      );
    default:
      return <Input className={inputClass} placeholder={field.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
  }
}

export default function AnamnesisFormPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [lang, setLang] = useState<Lang>(browserLang);
  const [form, setForm] = useState<FormData | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  const [values, setValues] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<AnamnesisProfileAnswers>({});
  const [sportsText, setSportsText] = useState('');
  const [privacyAck, setPrivacyAck] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dirty = useRef(false);

  const t = TEXT[lang];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_anamnesis_form', { p_token: token });
      if (cancelled) return;
      if (error) { setLoadState('error'); return; }
      if (!data) { setLoadState('notFound'); return; }
      const f = data as FormData;
      setForm(f);
      setValues(f.values ?? {});
      setProfile(f.profile ?? {});
      setSportsText((f.profile?.sports ?? []).join(', '));
      if (f.language === 'de' || f.language === 'en') setLang(f.language);
      setLoadState('ready');
    })();
    return () => { cancelled = true; };
  }, [token]);

  const profileForSave = useCallback((): AnamnesisProfileAnswers => ({
    ...profile,
    sports: sportsText.split(',').map(s => s.trim()).filter(Boolean),
  }), [profile, sportsText]);

  // Draft autosave, shortly after the last change
  useEffect(() => {
    if (!dirty.current || form?.status !== 'open' || submitted) return;
    const timer = setTimeout(async () => {
      setSaveState('saving');
      const { data, error } = await supabase.rpc('save_anamnesis_form', {
        p_token: token, p_values: values, p_profile: profileForSave(), p_language: lang,
      });
      setSaveState(error || data !== true ? 'failed' : 'saved');
    }, 1200);
    return () => clearTimeout(timer);
  }, [values, profile, sportsText, lang, token, form?.status, submitted, profileForSave]);

  const setValue = (id: string, v: string) => { dirty.current = true; setValues(prev => ({ ...prev, [id]: v })); };
  const setProfileField = <K extends keyof AnamnesisProfileAnswers>(key: K, v: AnamnesisProfileAnswers[K]) => {
    dirty.current = true;
    setProfile(prev => ({ ...prev, [key]: v }));
  };

  const company = form?.companyName || (lang === 'de' ? 'deinem Trainerteam' : 'your coaching team');
  const email = form?.contactEmail || '';
  const age = ageFrom(profile.birthday);
  const isMinor = age !== null && age < 16;
  const athleteName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || (lang === 'de' ? 'mein Kind' : 'my child');
  const notice = lang === 'de' ? (form?.noticeDe || form?.noticeEn) : (form?.noticeEn || form?.noticeDe);
  const consentText = isMinor ? t.guardianConsent(athleteName, company, email) : t.healthConsent(company, email);
  const canSubmit = !!notice && privacyAck && healthConsent && (!isMinor || guardianName.trim().length > 1) && !submitting;

  const expiresLabel = useMemo(() => {
    if (!form?.expiresAt) return null;
    return new Date(form.expiresAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [form?.expiresAt, lang]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(false);
    const { data, error } = await supabase.rpc('submit_anamnesis_form', {
      p_token: token,
      p_values: values,
      p_profile: profileForSave(),
      p_language: lang,
      p_consent: {
        privacyNoticeRead: privacyAck,
        healthDataConsent: healthConsent,
        guardianName: isMinor ? guardianName.trim() : undefined,
        privacyText: t.privacyAck(company),
        consentText,
      },
    });
    setSubmitting(false);
    if (error || data !== true) { setSubmitError(true); return; }
    setSubmitted(true);
    window.scrollTo({ top: 0 });
  };

  const langSwitch = (
    <div className="flex rounded-md border overflow-hidden shrink-0" role="group" aria-label="Language">
      {(['de', 'en'] as const).map(l => (
        <button
          key={l}
          type="button"
          onClick={() => { dirty.current = dirty.current || form?.status === 'open'; setLang(l); }}
          className={cn('min-h-[36px] px-3 text-sm font-medium', lang === l ? 'bg-primary text-primary-foreground' : 'bg-background active:bg-accent')}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-[640px] mx-auto px-4 py-6 space-y-5">{children}</div>
    </div>
  );

  const message = (title: string, body: string, ok = false) => shell(
    <div className="rounded-xl border bg-background p-6 text-center space-y-3 mt-10">
      {ok && <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />}
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      <div className="flex justify-center pt-2">{langSwitch}</div>
    </div>,
  );

  if (loadState === 'loading') {
    return shell(<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>);
  }
  if (loadState === 'notFound') return message(t.expiredTitle, t.notFound);
  if (loadState === 'error' || !form) return message(t.title, t.loadError);
  if (submitted) return message(t.doneTitle, t.done(company), true);
  if (form.status === 'submitted') return message(t.doneTitle, t.doneAlready, true);
  if (form.status === 'expired') return message(t.expiredTitle, t.expired);

  const activityKeys = Object.keys(t.activities) as Array<keyof typeof t.activities>;

  return shell(
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{form.companyName}</p>
          <h1 className="text-xl font-semibold">{t.title}</h1>
        </div>
        {langSwitch}
      </header>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t.intro(company)} {expiresLabel && t.openUntil(expiresLabel)}
      </p>

      {/* About you — the athlete's profile, pre-filled */}
      <section className="rounded-xl border bg-background p-4 space-y-4">
        <h2 className="text-base font-semibold">{t.aboutYou}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.firstName}>
            <Input className={inputClass} value={profile.firstName ?? ''} onChange={e => setProfileField('firstName', e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label={t.lastName}>
            <Input className={inputClass} value={profile.lastName ?? ''} onChange={e => setProfileField('lastName', e.target.value)} autoComplete="family-name" />
          </Field>
          <Field label={t.birthday}>
            <Input type="date" className={inputClass} value={profile.birthday ?? ''} onChange={e => setProfileField('birthday', e.target.value)} />
          </Field>
          <Field label={t.sex}>
            <SelectBox
              value={profile.sex ?? ''}
              onChange={v => setProfileField('sex', (v || undefined) as AnamnesisProfileAnswers['sex'])}
              placeholder={t.choose}
              options={(['male', 'female', 'other'] as const).map(s => ({ value: s, label: t.sexes[s] }))}
            />
          </Field>
          <Field label={t.sports} hint={t.sportsHint}>
            <Input className={inputClass} value={sportsText} onChange={e => { dirty.current = true; setSportsText(e.target.value); }} />
          </Field>
          <Field label={t.occupation}>
            <Input className={inputClass} value={profile.occupation ?? ''} onChange={e => setProfileField('occupation', e.target.value)} />
          </Field>
        </div>
        <Field label={t.activity}>
          <SelectBox
            value={profile.dailyActivityLevel ?? ''}
            onChange={v => setProfileField('dailyActivityLevel', (v || undefined) as AnamnesisProfileAnswers['dailyActivityLevel'])}
            placeholder={t.choose}
            options={activityKeys.map(k => ({ value: k, label: t.activities[k] }))}
          />
        </Field>
      </section>

      {/* The athlete's sections of the template */}
      {(form.sections ?? []).map(section => (
        <section key={section.id} className="rounded-xl border bg-background p-4 space-y-4">
          <h2 className="text-base font-semibold">{section.title}</h2>
          {section.fields.map(field => (
            <Field key={field.id} label={field.label}>
              <QuestionInput field={field} value={values[field.id] ?? ''} onChange={v => setValue(field.id, v)} lang={lang} />
            </Field>
          ))}
        </section>
      ))}

      {/* Consent */}
      <section className="rounded-xl border bg-background p-4 space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {t.consentTitle}
        </h2>
        {!notice ? (
          <p className="text-sm text-destructive">{t.noticeMissing}</p>
        ) : (
          <>
            <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => setNoticeOpen(true)}>
              {t.readNotice}
            </Button>
            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <Checkbox checked={privacyAck} onCheckedChange={v => setPrivacyAck(v === true)} className="mt-0.5 h-5 w-5" />
              <span className="text-sm leading-relaxed">{t.privacyAck(company)}</span>
            </label>
            {isMinor && (
              <div className="space-y-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-900">{t.minorNote}</p>
                <Field label={t.guardianName}>
                  <Input className={inputClass} value={guardianName} onChange={e => setGuardianName(e.target.value)} autoComplete="name" />
                </Field>
              </div>
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={healthConsent} onCheckedChange={v => setHealthConsent(v === true)} className="mt-0.5 h-5 w-5" />
              <span className="text-sm leading-relaxed">{consentText}</span>
            </label>
          </>
        )}
      </section>

      <div className="space-y-2 pb-10">
        <Button className="w-full h-12 text-base" disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.submitting}</> : t.submit}
        </Button>
        {submitError && <p className="text-sm text-destructive text-center">{t.submitError}</p>}
        <p className={cn('text-xs text-center', saveState === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>
          {saveState === 'saving' ? t.saving : saveState === 'saved' ? t.saved : saveState === 'failed' ? t.saveFailed : ' '}
        </p>
      </div>

      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{lang === 'de' ? 'Datenschutzhinweise' : 'Privacy notice'}</DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{notice}</div>
          <Button className="w-full mt-2" onClick={() => setNoticeOpen(false)}>{t.close}</Button>
        </DialogContent>
      </Dialog>
    </>,
  );
}
