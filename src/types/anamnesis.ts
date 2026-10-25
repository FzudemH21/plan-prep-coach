export type AnamnesisFieldType =
  | 'text' | 'textarea' | 'number' | 'select' | 'boolean'
  // Added 2026-10-18 — answers are stored as text too (JSON for the structured ones, see
  // src/utils/anamnesisAnswers.ts)
  | 'multiselect'  // several options — JSON array of the picked options
  | 'scale'        // e.g. pain 0–10 — the number as text
  | 'date'         // yyyy-MM-dd
  | 'yesnoList'    // several yes/no items on one screen (options = items) — JSON { item: 'yes' | 'no' }
  | 'list'         // repeatable rows ("Add another"), columns in listColumns — JSON array of { columnId: value }
  | 'bodyMap'      // spots on the body (exact position) with a note — JSON array of BodyMapSpot
  | 'weekGrid'     // weekly schedule: available / regular training / other load per hour — JSON WeekGridValue
  | 'dateRanges'   // calendar: periods marked by click-and-drag, named (holiday, competition …) — JSON array of DatePeriod; options = types
  | 'info';        // text only (label = heading, helpText = body), no answer

/** One column of a 'list' question (e.g. injuries: When / What / Time out) */
export interface AnamnesisListColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  /** Display only (never stored): the choices as shown in the current language */
  optionLabels?: string[];
}

/**
 * "Show only if": the question / section is shown when the answer to an earlier question is one of
 * `values` (yes/no: 'true' / 'false'; choices: the option; body map: region ids from bodyMapData,
 * e.g. '1' head, '2' neck) — or the athlete's sex (sourceId 'profile.sex': 'male' / 'female' / 'other').
 */
export interface AnamnesisCondition {
  sourceId: string;
  values: string[];
}

export const PROFILE_SEX_SOURCE = 'profile.sex';

// ── Language versions ─────────────────────────────────────────────────────────
// A template is written in its main language (`language`, default German) and can carry a
// translation into the other one. Answers are always stored with the main language's values (choices,
// checklist items), so conditions and the coach's view don't depend on the language the athlete used;
// the translation is only what the athlete sees (and the PDF in that language).

export type AnamnesisLang = 'de' | 'en';
export const ANAMNESIS_LANG_LABELS: Record<AnamnesisLang, string> = { de: 'German', en: 'English' };
export const otherLang = (lang: AnamnesisLang): AnamnesisLang => (lang === 'de' ? 'en' : 'de');

/** The translated texts of a question — options / items / list columns by position */
export interface AnamnesisFieldTranslation {
  label?: string;
  helpText?: string;
  placeholder?: string;
  options?: string[];
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  listColumns?: Array<{ label?: string; options?: string[] }>;
}

export interface AnamnesisSectionTranslation {
  title?: string;
  helpText?: string;
}

export interface AnamnesisTemplateTranslation {
  name?: string;
  introText?: string;
}

export interface AnamnesisAttachment {
  name: string;
  type: 'image' | 'document';
  mimeType: string;
  path: string;
  size: number;
}

/** A file the athlete uploaded in the form link (documents bucket, anamnesis-form/<record>/<token>/…) */
export interface AnamnesisFile {
  path: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface AnamnesisField {
  id: string;
  label: string;
  fieldType: AnamnesisFieldType;
  options?: string[];
  placeholder?: string;
  /** Explanation under the question (plain words, e.g. what a "minor trauma" is) */
  helpText?: string;
  condition?: AnamnesisCondition;
  /** scale: range (default 0–10) and the words at both ends */
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  /** list: the columns of each row */
  listColumns?: AnamnesisListColumn[];
  /** bodyMap: also ask for the pain intensity (0–10) of each spot */
  bodyMapIntensity?: boolean;
  /** multiselect: an extra "Sonstiges" choice with free text (stored in the answer as the text itself) */
  allowOther?: boolean;
  /** The athlete may upload files below the answer (e.g. a report) — stored as the answer
   *  "<id>__files" (AnamnesisFile[] as JSON); the AI only learns how many there are */
  allowFiles?: boolean;
  /** The question in the template's other language */
  translations?: Partial<Record<AnamnesisLang, AnamnesisFieldTranslation>>;
  /** Display only (never stored): the options as shown in the current language — set by localizeField */
  optionLabels?: string[];
}

export interface AnamnesisSection {
  id: string;
  title: string;
  /** Short text under the section title (shown with the section's first question) */
  helpText?: string;
  condition?: AnamnesisCondition;
  fields: AnamnesisField[];
  translations?: Partial<Record<AnamnesisLang, AnamnesisSectionTranslation>>;
  /** Filled in by the athlete through the online form link. Default (unset): yes — only an explicit
   *  false keeps the section for the coach (e.g. movement screening). */
  athleteFills?: boolean;
}

/** Whether the athlete sees this section in the form link (default: yes) */
export const isAthleteSection = (section: AnamnesisSection): boolean => section.athleteFills !== false;

export interface AnamnesisTemplate {
  id: string;
  coachUserId: string;
  name: string;
  sections: AnamnesisSection[];
  /** Start-screen text of the online form link; empty = the standard text */
  introText?: string;
  /** Main language (default: German) and the translation of name / intro (migration 20261019) */
  language?: AnamnesisLang;
  translations?: Partial<Record<AnamnesisLang, AnamnesisTemplateTranslation>>;
  createdAt: string;
  updatedAt: string;
}

export interface AnamnesisTemplateSnapshot {
  name: string;
  sections: AnamnesisSection[];
  introText?: string;
  language?: AnamnesisLang;
  translations?: Partial<Record<AnamnesisLang, AnamnesisTemplateTranslation>>;
}

/** What the template editor saves */
export interface AnamnesisTemplateDraft {
  name: string;
  sections: AnamnesisSection[];
  introText: string;
  language?: AnamnesisLang;
  translations?: Partial<Record<AnamnesisLang, AnamnesisTemplateTranslation>>;
}

/** The copy of a template an anamnesis keeps (its questions as they were when it was created) */
export function snapshotOf(t: { name: string; sections: AnamnesisSection[]; introText?: string; language?: AnamnesisLang;
  translations?: Partial<Record<AnamnesisLang, AnamnesisTemplateTranslation>> }): AnamnesisTemplateSnapshot {
  return {
    name: t.name,
    sections: t.sections,
    ...(t.introText?.trim() ? { introText: t.introText.trim() } : {}),
    ...(t.language ? { language: t.language } : {}),
    ...(t.translations && Object.keys(t.translations).length ? { translations: t.translations } : {}),
  };
}

export interface AthleteAnamnesis {
  id: string;
  coachUserId: string;
  athleteLocalId: string;
  templateId: string | null;
  templateSnapshot: AnamnesisTemplateSnapshot;
  conductedAt: string;
  customQuestions: AnamnesisField[];
  fieldValues: Record<string, string>;
  customFieldValues: Record<string, string>;
  /** Plain-text version of the notes (kept in step with noteEntries — read by the AI drawer, PDF) */
  notes: string;
  /** Notes added to the anamnesis, typed or dictated (migration 20261010); older records only have `notes` */
  noteEntries?: AnamnesisNote[];
  aiSummary: string | null;
  attachments: AnamnesisAttachment[];
  /** Online form link: 'sent' = waiting for the athlete, 'submitted' = athlete sent it; null = coach-only record */
  formStatus?: 'sent' | 'submitted' | null;
  formToken?: string | null;
  formExpiresAt?: string | null;
  formSubmittedAt?: string | null;
  formLanguage?: string | null;
  consent?: AnamnesisConsent | null;
  /** Profile details the athlete entered in the form ("About you"), applied to the profile by the coach */
  athleteProfileAnswers?: AnamnesisProfileAnswers | null;
  profileAppliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A note on an anamnesis — typed, or dictated (speech-to-text; the audio is not kept) */
export interface AnamnesisNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  source: 'typed' | 'dictated';
}

/** The notes of a record — older records only have the plain `notes` text, shown as one note */
export function noteEntriesOf(rec: { noteEntries?: AnamnesisNote[] | null; notes?: string | null; conductedAt?: string; createdAt?: string }): AnamnesisNote[] {
  if (rec.noteEntries && rec.noteEntries.length > 0) return rec.noteEntries;
  const legacy = rec.notes?.trim();
  if (!legacy) return [];
  return [{ id: 'legacy-notes', text: legacy, createdAt: rec.createdAt ?? `${rec.conductedAt ?? ''}T12:00:00`, source: 'typed' }];
}

/** "2026-10-05 14:32 (dictated): …" — one block per note, for the plain `notes` column */
export function notesAsText(entries: AnamnesisNote[]): string {
  return entries.map((n) => {
    const d = new Date(n.createdAt);
    const stamp = isNaN(d.getTime())
      ? ''
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const head = [stamp, n.source === 'dictated' ? '(dictated)' : ''].filter(Boolean).join(' ');
    return head ? `${head}: ${n.text}` : n.text;
  }).join('\n\n');
}

/** One change in the change history: what changed, from → to (display text) */
export interface AnamnesisChange {
  what: string;
  from: string;
  to: string;
}

/** A saved change of an anamnesis (append-only table anamnesis_change_log) */
export interface AnamnesisChangeLogEntry {
  id: string;
  anamnesisId: string;
  changedAt: string;
  changedByName: string;
  summary: string;
  changes: AnamnesisChange[];
}

/** "About you" in the form — the athlete profile fields the athlete confirms or completes */
export interface AnamnesisProfileAnswers {
  firstName?: string;
  lastName?: string;
  birthday?: string;
  sex?: 'male' | 'female' | 'other';
  sports?: string[];
  occupation?: string;
  dailyActivityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  /** Needs migration 20261018_anamnesis_form_billing_address (without it, the server drops it) */
  billingAddress?: { street: string; postalCode: string; city: string; country: string };
}

/** Consent given in the form, as stored by the server on submit */
export interface AnamnesisConsent {
  privacyNoticeRead: boolean;
  healthDataConsent: boolean;
  /** Set when a parent / legal guardian consented for an athlete under 16 */
  guardianName?: string;
  privacyText?: string;
  consentText?: string;
  noticeVersion?: number;
  language?: string;
  consentedAt: string;
}

// Predefined default template seeded from the sports-science anamnesis protocol
export const DEFAULT_ANAMNESIS_TEMPLATE: Omit<AnamnesisTemplate, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'> = {
  name: 'General Anamnesis',
  sections: [
    {
      // Name, date of birth, sex, occupation and activity level live on the athlete
      // profile (entered once in the Add Athlete dialog) — not asked again here.
      id: 'sec-basic',
      title: 'Current Status & History',
      athleteFills: true,
      fields: [
        { id: 'f-complaint', label: 'Main Complaint / Current Status', fieldType: 'textarea' },
        { id: 'f-injury-history', label: 'Injury / Surgery History', fieldType: 'textarea' },
        { id: 'f-prev-therapy', label: 'Previous Therapy / Treatment', fieldType: 'textarea' },
      ],
    },
    {
      id: 'sec-medical',
      title: 'Medical History',
      athleteFills: true,
      fields: [
        {
          id: 'f-smoking',
          label: 'Smoking',
          fieldType: 'select',
          options: ['Never', 'Former smoker', 'Active smoker'],
        },
        {
          id: 'f-alcohol',
          label: 'Alcohol',
          fieldType: 'select',
          options: ['None', 'Occasional', 'Regular'],
        },
        { id: 'f-medications', label: 'Current Medications', fieldType: 'textarea' },
        {
          id: 'f-sleep',
          label: 'Sleep Quality',
          fieldType: 'select',
          options: ['Poor', 'Fair', 'Good', 'Excellent'],
        },
        { id: 'f-nutrition', label: 'Nutrition Habits', fieldType: 'text' },
        { id: 'f-family-history', label: 'Family History of Relevant Conditions', fieldType: 'textarea' },
        { id: 'f-head-injuries', label: 'Head Injuries / Concussions', fieldType: 'textarea' },
        { id: 'f-eyes', label: 'Eye Conditions', fieldType: 'text' },
        { id: 'f-dental', label: 'Dental / Jaw Issues', fieldType: 'text' },
        { id: 'f-gynaecology', label: 'Gynaecology / Urology', fieldType: 'text' },
      ],
    },
    {
      id: 'sec-lower',
      title: 'Movement Screening — Lower Body',
      athleteFills: false,
      fields: [
        { id: 'f-overhead-squat', label: 'Overhead Squat', fieldType: 'textarea' },
        { id: 'f-thomas-test', label: 'Thomas Test (bilateral)', fieldType: 'textarea' },
        { id: 'f-gait', label: 'Gait Analysis', fieldType: 'textarea' },
        { id: 'f-hip-rom', label: 'Hip ROM (bilateral)', fieldType: 'textarea' },
        { id: 'f-knee-to-wall', label: 'Knee-to-Wall', fieldType: 'textarea' },
      ],
    },
    {
      id: 'sec-upper',
      title: 'Movement Screening — Upper Body / Core / Posture',
      athleteFills: false,
      fields: [
        { id: 'f-cervical', label: 'Cervical Rotation (bilateral)', fieldType: 'textarea' },
        { id: 'f-shoulder-rom', label: 'Shoulder ROM', fieldType: 'textarea' },
        { id: 'f-anti-rotation', label: 'Anti-rotation Test', fieldType: 'textarea' },
        { id: 'f-anti-flexion', label: 'Anti-flexion Test', fieldType: 'textarea' },
        { id: 'f-single-leg', label: 'Single-Leg Balance', fieldType: 'textarea' },
      ],
    },
    {
      id: 'sec-summary',
      title: 'Summary & Training Focus',
      athleteFills: false,
      fields: [
        { id: 'f-key-findings', label: 'Key Findings', fieldType: 'textarea' },
        { id: 'f-training-priorities', label: 'Training Priorities / Focus', fieldType: 'textarea' },
        { id: 'f-contraindications', label: 'Contraindications / Limitations', fieldType: 'textarea' },
      ],
    },
  ],
};
