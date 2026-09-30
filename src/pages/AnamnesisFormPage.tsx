/**
 * AnamnesisFormPage — public page behind an anamnesis form link (/anamnesis/:token), no login.
 *
 * One question per screen (Typeform-like): a start screen, then "About you" (pre-filled from the
 * athlete's profile) step by step, then every question of the sections the coach left "Filled in by
 * the athlete", then privacy notice + consent (a parent / guardian for athletes under 16) and submit.
 * Choice and yes/no answers move on by themselves; Enter moves on in one-line fields. Answers are
 * saved as a draft while typing, so the link can be finished later until it expires ("Continue"
 * jumps to the first unanswered question). All reads and writes go through the token-checked
 * database functions of migration 20261002_anamnesis_form_link.
 *
 * Full-screen layout with its own scroll area — the app locks page scrolling (html/body overflow
 * hidden), so the page must not rely on the body scrolling.
 *
 * The form's own texts are German or English (browser language, switchable); the questions appear
 * as the coach wrote them.
 *
 * Branding from the coach profile: the logo in the header (large on the start screen) and the
 * accent colour for buttons, progress bar and selected answers. The start screen shows the
 * template's own introduction text when there is one; the notes about saving, number of questions
 * and expiry date are always added.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, ChevronLeft, Loader2, ShieldCheck } from 'lucide-react';
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
  /** The template's own start-screen text (empty = standard text) */
  introText?: string | null;
  /** Coach branding: logo (data URL) and accent colour (hex) */
  logo?: string | null;
  brandColor?: string | null;
  noticeDe?: string;
  noticeEn?: string;
}

type ProfileStep = 'name' | 'birthday' | 'sex' | 'sports' | 'occupation' | 'activity';
type Step =
  | { kind: 'welcome' }
  | { kind: 'profile'; key: ProfileStep }
  | { kind: 'question'; section: AnamnesisSection; field: AnamnesisField }
  | { kind: 'consent' };

const PROFILE_STEPS: ProfileStep[] = ['name', 'birthday', 'sex', 'sports', 'occupation', 'activity'];

const TEXT = {
  de: {
    title: 'Anamnese',
    intro: (company: string) => `Bitte beantworte ein paar Fragen für ${company}. Es kommt immer nur eine Frage auf einmal.`,
    savedNote: 'Deine Antworten werden gespeichert – du kannst den Link bis zum Absenden jederzeit wieder öffnen und weitermachen.',
    openUntil: (d: string) => `Der Link ist gültig bis ${d}.`,
    duration: (n: number) => `${n} Fragen · ca. ${Math.max(2, Math.round(n / 3))} Minuten`,
    start: 'Los geht’s', continue: 'Weitermachen',
    next: 'Weiter', skip: 'Überspringen', back: 'Zurück',
    enterHint: 'oder Enter drücken',
    aboutYou: 'Über dich',
    qName: 'Wie heißt du?', firstName: 'Vorname', lastName: 'Nachname',
    qBirthday: 'Wann bist du geboren?',
    qSex: 'Welches Geschlecht hast du?',
    qSports: 'Welche Sportart(en) machst du?', sportsHint: 'Mehrere mit Komma trennen',
    qOccupation: 'Was machst du beruflich?',
    qActivity: 'Wie aktiv bist du im Alltag?',
    sexes: { male: 'Männlich', female: 'Weiblich', other: 'Divers' },
    activities: {
      sedentary: 'Kaum aktiv (wenig oder kein Sport)',
      lightly_active: 'Leicht aktiv (1–3 Tage/Woche)',
      moderately_active: 'Mäßig aktiv (3–5 Tage/Woche)',
      very_active: 'Sehr aktiv (6–7 Tage/Woche)',
      extremely_active: 'Extrem aktiv (2× täglich)',
    },
    typeHere: 'Antwort eingeben…', yes: 'Ja', no: 'Nein',
    consentTitle: 'Datenschutz und Einwilligung',
    consentIntro: 'Fast geschafft. Bitte lies die Datenschutzhinweise und bestätige unten.',
    readNotice: 'Datenschutzhinweise lesen',
    privacyAck: (company: string) => `Ich habe die Datenschutzhinweise von ${company} gelesen.`,
    healthConsent: (company: string, email: string) => `Ich willige ausdrücklich ein, dass ${company} meine in diesem Formular angegebenen Gesundheitsdaten (z. B. Beschwerden, Verletzungen, Vorerkrankungen, Medikamente) sowie die im Erstgespräch erhobenen Befunde zum Zweck meiner Trainingsbetreuung und physiotherapeutischen Versorgung verarbeitet – einschließlich einer KI-gestützten Zusammenfassung ohne Namensnennung durch einen Dienstleister in den USA, wie in den Datenschutzhinweisen beschrieben. Die Einwilligung ist freiwillig. Ich kann sie jederzeit mit Wirkung für die Zukunft widerrufen, z. B. per E-Mail an ${email}.`,
    minorNote: 'Da der Athlet jünger als 16 Jahre ist, muss ein Erziehungsberechtigter einwilligen.',
    guardianName: 'Name des Erziehungsberechtigten',
    guardianConsent: (athlete: string, company: string, email: string) => `Ich bin erziehungsberechtigt für ${athlete} und willige ausdrücklich ein, dass ${company} die in diesem Formular angegebenen Gesundheitsdaten meines Kindes sowie die im Erstgespräch erhobenen Befunde zum Zweck der Trainingsbetreuung und physiotherapeutischen Versorgung verarbeitet – einschließlich einer KI-gestützten Zusammenfassung ohne Namensnennung durch einen Dienstleister in den USA, wie in den Datenschutzhinweisen beschrieben. Die Einwilligung ist freiwillig und jederzeit mit Wirkung für die Zukunft widerrufbar, z. B. per E-Mail an ${email}.`,
    submit: 'Absenden', submitting: 'Wird gesendet…',
    saved: 'Gespeichert', saving: 'Speichert…', saveFailed: 'Nicht gespeichert – Verbindung prüfen',
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
    intro: (company: string) => `Please answer a few questions for ${company}. You'll see one question at a time.`,
    savedNote: 'Your answers are saved — you can reopen this link and continue any time until you submit.',
    openUntil: (d: string) => `This link is valid until ${d}.`,
    duration: (n: number) => `${n} questions · about ${Math.max(2, Math.round(n / 3))} minutes`,
    start: 'Start', continue: 'Continue',
    next: 'Next', skip: 'Skip', back: 'Back',
    enterHint: 'or press Enter',
    aboutYou: 'About you',
    qName: 'What is your name?', firstName: 'First name', lastName: 'Last name',
    qBirthday: 'When were you born?',
    qSex: 'What is your sex?',
    qSports: 'Which sport(s) do you do?', sportsHint: 'Separate several with commas',
    qOccupation: 'What is your occupation?',
    qActivity: 'How active are you in daily life?',
    sexes: { male: 'Male', female: 'Female', other: 'Other' },
    activities: {
      sedentary: 'Sedentary (little or no exercise)',
      lightly_active: 'Lightly active (1–3 days/week)',
      moderately_active: 'Moderately active (3–5 days/week)',
      very_active: 'Very active (6–7 days/week)',
      extremely_active: 'Extremely active (2× per day)',
    },
    typeHere: 'Type your answer…', yes: 'Yes', no: 'No',
    consentTitle: 'Privacy and consent',
    consentIntro: 'Almost done. Please read the privacy notice and confirm below.',
    readNotice: 'Read the privacy notice',
    privacyAck: (company: string) => `I have read the privacy notice of ${company}.`,
    healthConsent: (company: string, email: string) => `I explicitly consent to ${company} processing the health data I provide in this form (e.g. complaints, injuries, medical conditions, medication) and the findings from the first appointment for the purpose of my training support and physiotherapy care – including an AI-assisted summary without my name by a provider in the USA, as described in the privacy notice. This consent is voluntary. I can withdraw it at any time with effect for the future, e.g. by email to ${email}.`,
    minorNote: 'As the athlete is under 16, a parent or legal guardian has to give consent.',
    guardianName: "Parent's / guardian's name",
    guardianConsent: (athlete: string, company: string, email: string) => `I am the parent or legal guardian of ${athlete} and explicitly consent to ${company} processing my child's health data provided in this form and the findings from the first appointment for the purpose of training support and physiotherapy care – including an AI-assisted summary without the name by a provider in the USA, as described in the privacy notice. This consent is voluntary and can be withdrawn at any time with effect for the future, e.g. by email to ${email}.`,
    submit: 'Submit', submitting: 'Submitting…',
    saved: 'Saved', saving: 'Saving…', saveFailed: 'Not saved — check your connection',
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

/** "#e2522b" → "12 76% 53%" (the HSL form the theme's colour variables use); null if not a hex colour */
function hexToHslVar(hex: string): { hsl: string; light: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  // Perceived brightness decides whether text on the colour is white or dark
  const light = 0.299 * r + 0.587 * g + 0.114 * b;
  return { hsl: `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`, light };
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

// 16px+ text everywhere: iOS zooms into smaller inputs
const bigInput = 'text-lg h-14 rounded-lg';

/** Tappable answers (A, B, C …) — picking one moves on */
function OptionList({ options, value, onPick }: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((o, i) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(selected ? '' : o.value)}
            className={cn(
              'w-full min-h-[52px] flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left text-base transition-colors',
              selected ? 'border-primary bg-primary/10' : 'border-input bg-background hover:bg-accent active:bg-accent',
            )}
          >
            <span className={cn(
              'w-7 h-7 shrink-0 rounded-md border flex items-center justify-center text-xs font-semibold',
              selected ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground',
            )}>
              {selected ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 min-w-0">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
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
  const [stepIdx, setStepIdx] = useState(0);
  const dirty = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }, 1000);
    return () => clearTimeout(timer);
  }, [values, profile, sportsText, lang, token, form?.status, submitted, profileForSave]);

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  // Coach's accent colour for the whole page (dialogs render outside the page root, so on <html>)
  useEffect(() => {
    const color = form?.brandColor ? hexToHslVar(form.brandColor) : null;
    if (!color) return;
    const root = document.documentElement;
    const vars: Record<string, string> = {
      '--primary': color.hsl,
      '--ring': color.hsl,
      '--primary-foreground': color.light > 0.6 ? '0 0% 9%' : '0 0% 100%',
    };
    const before = Object.fromEntries(Object.keys(vars).map(k => [k, root.style.getPropertyValue(k)]));
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    return () => Object.entries(before).forEach(([k, v]) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k)));
  }, [form?.brandColor]);

  // ── Steps ──────────────────────────────────────────────────────────────────
  const steps = useMemo<Step[]>(() => [
    { kind: 'welcome' },
    ...PROFILE_STEPS.map(key => ({ kind: 'profile' as const, key })),
    ...(form?.sections ?? []).flatMap(section => section.fields.map(field => ({ kind: 'question' as const, section, field }))),
    { kind: 'consent' },
  ], [form?.sections]);
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const questionCount = steps.length - 2;

  const goTo = (i: number) => {
    if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null; }
    setStepIdx(Math.max(0, Math.min(steps.length - 1, i)));
  };
  const next = () => goTo(stepIdx + 1);
  const back = () => goTo(stepIdx - 1);
  /** After a tap on a choice: short pause so the selection is visible, then on */
  const nextSoon = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => { advanceTimer.current = null; setStepIdx(i => Math.min(steps.length - 1, i + 1)); }, 250);
  };

  const setValue = (id: string, v: string) => { dirty.current = true; setValues(prev => ({ ...prev, [id]: v })); };
  const setProfileField = <K extends keyof AnamnesisProfileAnswers>(key: K, v: AnamnesisProfileAnswers[K]) => {
    dirty.current = true;
    setProfile(prev => ({ ...prev, [key]: v }));
  };

  const isAnswered = (s: Step): boolean => {
    if (s.kind === 'question') return !!values[s.field.id]?.trim();
    if (s.kind !== 'profile') return false;
    switch (s.key) {
      case 'name': return !!(profile.firstName?.trim() && profile.lastName?.trim());
      case 'birthday': return !!profile.birthday;
      case 'sex': return !!profile.sex;
      case 'sports': return !!sportsText.trim();
      case 'occupation': return !!profile.occupation?.trim();
      case 'activity': return !!profile.dailyActivityLevel;
    }
  };
  const hasAnswers = Object.values(values).some(v => v?.trim());

  // ── Consent / submit ───────────────────────────────────────────────────────
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
  };

  // ── Layout pieces ──────────────────────────────────────────────────────────
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

  const brand = form?.logo ? (
    <img src={form.logo} alt={form.companyName || ''} className="h-8 max-w-[180px] object-contain object-left" />
  ) : (
    <span className="text-sm font-medium text-muted-foreground truncate">{form?.companyName}</span>
  );

  /** Full screen with its own scroll area (page scrolling is locked app-wide) */
  const screen = (content: React.ReactNode, footer?: React.ReactNode, progress?: number, hideBrand = false) => (
    <div className="fixed inset-0 flex flex-col bg-background">
      {progress !== undefined && (
        <div className="h-1 bg-muted shrink-0">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 max-w-[640px] w-full mx-auto">
        <div className="min-w-0 flex items-center">{hideBrand ? null : brand}</div>
        {langSwitch}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="min-h-full flex flex-col justify-center max-w-[640px] w-full mx-auto px-5 py-6">
          {content}
        </div>
      </div>
      {footer && (
        <div className="shrink-0 border-t bg-background">
          <div className="max-w-[640px] w-full mx-auto px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        </div>
      )}
    </div>
  );

  const message = (title: string, body: string, ok = false) => screen(
    <div className="text-center space-y-3">
      {ok && <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />}
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-base text-muted-foreground">{body}</p>
    </div>,
  );

  if (loadState === 'loading') {
    return screen(<div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>);
  }
  if (loadState === 'notFound') return message(t.expiredTitle, t.notFound);
  if (loadState === 'error' || !form) return message(t.title, t.loadError);
  if (submitted) return message(t.doneTitle, t.done(company), true);
  if (form.status === 'submitted') return message(t.doneTitle, t.doneAlready, true);
  if (form.status === 'expired') return message(t.expiredTitle, t.expired);

  // ── Welcome ────────────────────────────────────────────────────────────────
  if (step.kind === 'welcome') {
    const firstOpen = steps.findIndex((s, i) => i > 0 && s.kind !== 'consent' && !isAnswered(s));
    return screen(
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {form.logo ? (
          <img src={form.logo} alt={form.companyName || ''} className="h-16 max-w-[240px] object-contain object-left" />
        ) : form.companyName ? (
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">{form.companyName}</p>
        ) : null}
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <p className="text-base leading-relaxed whitespace-pre-wrap">
          {form.introText?.trim() || t.intro(company)}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t.savedNote}<br />
          {t.duration(questionCount)}{expiresLabel ? ` · ${t.openUntil(expiresLabel)}` : ''}
        </p>
        <Button className="h-14 px-8 text-lg gap-2" onClick={() => goTo(hasAnswers && firstOpen > 0 ? firstOpen : 1)}>
          {hasAnswers ? t.continue : t.start}
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>,
      undefined,
      undefined,
      true,
    );
  }

  // ── Question / profile / consent step ──────────────────────────────────────
  const progress = stepIdx / (steps.length - 1);
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) { e.preventDefault(); next(); }
  };

  let kicker = '';
  let heading = '';
  let body: React.ReactNode = null;
  if (step.kind === 'profile') {
    kicker = t.aboutYou;
    const activityKeys = Object.keys(t.activities) as Array<keyof typeof t.activities>;
    switch (step.key) {
      case 'name':
        heading = t.qName;
        body = (
          <div className="space-y-3">
            <Input className={bigInput} placeholder={t.firstName} autoFocus autoComplete="given-name"
              value={profile.firstName ?? ''} onChange={e => setProfileField('firstName', e.target.value)} />
            <Input className={bigInput} placeholder={t.lastName} autoComplete="family-name"
              value={profile.lastName ?? ''} onChange={e => setProfileField('lastName', e.target.value)} onKeyDown={onEnter} />
          </div>
        );
        break;
      case 'birthday':
        heading = t.qBirthday;
        body = <Input type="date" className={bigInput} value={profile.birthday ?? ''} onChange={e => setProfileField('birthday', e.target.value)} onKeyDown={onEnter} />;
        break;
      case 'sex':
        heading = t.qSex;
        body = (
          <OptionList
            value={profile.sex ?? ''}
            options={(['male', 'female', 'other'] as const).map(s => ({ value: s, label: t.sexes[s] }))}
            onPick={v => { setProfileField('sex', (v || undefined) as AnamnesisProfileAnswers['sex']); if (v) nextSoon(); }}
          />
        );
        break;
      case 'sports':
        heading = t.qSports;
        body = (
          <div className="space-y-2">
            <Input className={bigInput} autoFocus placeholder={t.typeHere} value={sportsText}
              onChange={e => { dirty.current = true; setSportsText(e.target.value); }} onKeyDown={onEnter} />
            <p className="text-sm text-muted-foreground">{t.sportsHint}</p>
          </div>
        );
        break;
      case 'occupation':
        heading = t.qOccupation;
        body = <Input className={bigInput} autoFocus placeholder={t.typeHere} value={profile.occupation ?? ''}
          onChange={e => setProfileField('occupation', e.target.value)} onKeyDown={onEnter} />;
        break;
      case 'activity':
        heading = t.qActivity;
        body = (
          <OptionList
            value={profile.dailyActivityLevel ?? ''}
            options={activityKeys.map(k => ({ value: k, label: t.activities[k] }))}
            onPick={v => { setProfileField('dailyActivityLevel', (v || undefined) as AnamnesisProfileAnswers['dailyActivityLevel']); if (v) nextSoon(); }}
          />
        );
        break;
    }
  } else if (step.kind === 'question') {
    const { field, section } = step;
    kicker = section.title;
    heading = field.label;
    const value = values[field.id] ?? '';
    switch (field.fieldType) {
      case 'textarea':
        body = <Textarea className="text-lg min-h-[160px] rounded-lg" autoFocus placeholder={field.placeholder || t.typeHere}
          value={value} onChange={e => setValue(field.id, e.target.value)} />;
        break;
      case 'number':
        body = <Input type="number" inputMode="decimal" className={bigInput} autoFocus placeholder={field.placeholder || t.typeHere}
          value={value} onChange={e => setValue(field.id, e.target.value)} onKeyDown={onEnter} />;
        break;
      case 'select':
        body = <OptionList value={value} options={(field.options ?? []).map(o => ({ value: o, label: o }))}
          onPick={v => { setValue(field.id, v); if (v) nextSoon(); }} />;
        break;
      case 'boolean':
        body = <OptionList value={value} options={[{ value: 'true', label: t.yes }, { value: 'false', label: t.no }]}
          onPick={v => { setValue(field.id, v); if (v) nextSoon(); }} />;
        break;
      default:
        body = <Input className={bigInput} autoFocus placeholder={field.placeholder || t.typeHere}
          value={value} onChange={e => setValue(field.id, e.target.value)} onKeyDown={onEnter} />;
    }
  } else {
    heading = t.consentTitle;
    body = !notice ? (
      <p className="text-base text-destructive">{t.noticeMissing}</p>
    ) : (
      <div className="space-y-5">
        <p className="text-base text-muted-foreground">{t.consentIntro}</p>
        <Button type="button" variant="outline" className="w-full h-12 text-base gap-2" onClick={() => setNoticeOpen(true)}>
          <ShieldCheck className="h-4 w-4" />{t.readNotice}
        </Button>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={privacyAck} onCheckedChange={v => setPrivacyAck(v === true)} className="mt-0.5 h-6 w-6" />
          <span className="text-base leading-relaxed">{t.privacyAck(company)}</span>
        </label>
        {isMinor && (
          <div className="space-y-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-900">{t.minorNote}</p>
            <Input className={bigInput} placeholder={t.guardianName} autoComplete="name" value={guardianName} onChange={e => setGuardianName(e.target.value)} />
          </div>
        )}
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={healthConsent} onCheckedChange={v => setHealthConsent(v === true)} className="mt-0.5 h-6 w-6" />
          <span className="text-sm leading-relaxed">{consentText}</span>
        </label>
        {submitError && <p className="text-sm text-destructive">{t.submitError}</p>}
      </div>
    );
  }

  const answered = isAnswered(step);
  const isConsent = step.kind === 'consent';
  const saveLabel = saveState === 'saving' ? t.saving : saveState === 'saved' ? t.saved : saveState === 'failed' ? t.saveFailed : '';

  return screen(
    <div key={stepIdx} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="space-y-2">
        {kicker && <p className="text-sm font-medium text-primary">{kicker}</p>}
        <h1 className="text-2xl font-semibold leading-snug">
          {!isConsent && <span className="text-muted-foreground font-normal mr-2">{stepIdx}.</span>}
          {heading}
        </h1>
      </div>
      {body}
      {!isConsent && step.kind !== 'profile' && step.field.fieldType !== 'textarea' && step.field.fieldType !== 'select' && step.field.fieldType !== 'boolean' && (
        <p className="text-xs text-muted-foreground hidden sm:block">{t.enterHint}</p>
      )}

      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{lang === 'de' ? 'Datenschutzhinweise' : 'Privacy notice'}</DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{notice}</div>
          <Button className="w-full mt-2" onClick={() => setNoticeOpen(false)}>{t.close}</Button>
        </DialogContent>
      </Dialog>
    </div>,
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Button variant="outline" className="h-12 w-12 shrink-0 p-0" onClick={back} aria-label={t.back}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        {isConsent ? (
          <Button className="h-12 flex-1 text-base" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.submitting}</> : t.submit}
          </Button>
        ) : (
          <Button className="h-12 flex-1 text-base gap-2" variant={answered ? 'default' : 'secondary'} onClick={next}>
            {answered ? t.next : t.skip}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className={cn('text-xs text-center min-h-[16px]', saveState === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>
        {saveLabel}
      </p>
    </div>,
    progress,
  );
}
