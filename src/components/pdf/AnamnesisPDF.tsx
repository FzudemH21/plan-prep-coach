/**
 * AnamnesisPDF — printable anamnesis worksheet for the first appointment.
 *
 * Header with the coach's logo / business name, the athlete's details, then every section of the
 * anamnesis: answers already given (e.g. by the athlete through the form link) are printed in a
 * grey box with two lines for notes below; open questions get space to write — lines for text,
 * tick boxes for choices and yes/no. Ends with an empty lined notes area — the worksheet is for
 * before / during the appointment, so saved notes are not printed (they belong in the report).
 * Labels in German or
 * English; the questions appear as written in the template.
 *
 * Loaded on demand (like TrainingPlanPDF) — do not import @react-pdf/renderer at the top level of
 * components that are part of the initial bundle.
 */
import React from 'react';
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { AnamnesisField, AnamnesisSection, AnamnesisConsent } from '@/types/anamnesis';

Font.register({
  family: 'Geist',
  fonts: [
    { src: '/fonts/Geist-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Geist-Medium.ttf', fontWeight: 500 },
    { src: '/fonts/Geist-SemiBold.ttf', fontWeight: 600 },
    { src: '/fonts/Geist-Bold.ttf', fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

export type AnamnesisPdfLang = 'de' | 'en';

export interface AnamnesisPdfProps {
  lang: AnamnesisPdfLang;
  templateName: string;
  sections: AnamnesisSection[];
  customQuestions: AnamnesisField[];
  fieldValues: Record<string, string>;
  customFieldValues: Record<string, string>;
  /** yyyy-MM-dd */
  conductedAt: string;
  consent?: AnamnesisConsent | null;
  athlete: {
    name: string;
    birthday?: string;
    sex?: string;
    sports?: string[];
    occupation?: string;
  };
  branding?: { logoBase64?: string; primaryColor?: string; businessName?: string };
  coachName?: string;
}

const L = {
  de: {
    title: 'Anamnese',
    name: 'Name', birthday: 'Geburtsdatum', sex: 'Geschlecht', sports: 'Sportart(en)', occupation: 'Beruf', date: 'Termin',
    years: 'Jahre', sexes: { male: 'männlich', female: 'weiblich', other: 'divers' } as Record<string, string>,
    yes: 'Ja', no: 'Nein', notes: 'Notizen', custom: 'Weitere Fragen',
    online: (d: string) => `Online-Formular ausgefüllt am ${d}`,
    consent: 'Einwilligung zur Verarbeitung der Gesundheitsdaten erteilt',
    guardian: (n: string) => ` (durch Erziehungsberechtigte/n: ${n})`,
    confidential: 'Vertraulich – enthält Gesundheitsdaten',
    page: (p: number, n: number) => `Seite ${p} / ${n}`,
    locale: 'de-DE',
  },
  en: {
    title: 'Anamnesis',
    name: 'Name', birthday: 'Date of birth', sex: 'Sex', sports: 'Sport(s)', occupation: 'Occupation', date: 'Appointment',
    years: 'years', sexes: { male: 'male', female: 'female', other: 'other' } as Record<string, string>,
    yes: 'Yes', no: 'No', notes: 'Notes', custom: 'Further questions',
    online: (d: string) => `Online form completed on ${d}`,
    consent: 'Consent to processing of health data given',
    guardian: (n: string) => ` (by parent/guardian: ${n})`,
    confidential: 'Confidential – contains health data',
    page: (p: number, n: number) => `Page ${p} / ${n}`,
    locale: 'en-GB',
  },
} as const;

const C = {
  fg1: '#18181b',
  fg2: '#44403c',
  fg3: '#78716c',
  line: '#d6d3d1',
  box: '#f4f4f3',
  border: '#e7e5e4',
};
const DEFAULT_ACCENT = '#e2522b';
const LINE_H = 20;

const s = StyleSheet.create({
  page: { fontFamily: 'Geist', fontSize: 10, color: C.fg1, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44 },
  fieldLabel: { fontSize: 10, fontWeight: 600, color: C.fg1, marginBottom: 4 },
  answer: { backgroundColor: C.box, borderRadius: 3, paddingVertical: 5, paddingHorizontal: 7, fontSize: 10, lineHeight: 1.4, color: C.fg1 },
  writeLine: { height: LINE_H, borderBottomWidth: 0.6, borderBottomColor: C.line },
  noteLine: { height: 17, borderBottomWidth: 0.5, borderBottomColor: C.border },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 1 },
  option: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 5 },
  tick: { width: 9, height: 9, borderWidth: 0.8, borderColor: C.fg3, borderRadius: 1.5, marginRight: 4 },
});

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function ageFrom(birthday: string | undefined): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const b = new Date(`${birthday}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

function Lines({ count }: { count: number }) {
  return <View>{Array.from({ length: count }, (_, i) => <View key={i} style={s.writeLine} />)}</View>;
}

function Options({ labels, picked }: { labels: string[]; picked?: string }) {
  return (
    <View style={s.optionRow}>
      {labels.map((label) => (
        <View key={label} style={s.option}>
          <View style={[s.tick, picked === label ? { backgroundColor: C.fg1, borderColor: C.fg1 } : {}]} />
          <Text style={{ fontSize: 9.5, color: C.fg2 }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function FieldBlock({ field, value, lang }: { field: AnamnesisField; value: string; lang: AnamnesisPdfLang }) {
  const t = L[lang];
  const answered = value.trim().length > 0;
  const shown = field.fieldType === 'boolean'
    ? (value === 'true' ? t.yes : value === 'false' ? t.no : value)
    : value;
  return (
    <View wrap={false} style={{ marginBottom: 11 }}>
      <Text style={s.fieldLabel}>{field.label}</Text>
      {answered ? (
        <>
          <Text style={s.answer}>{shown}</Text>
          <View style={s.noteLine} />
          <View style={s.noteLine} />
        </>
      ) : field.fieldType === 'select' && (field.options?.length ?? 0) > 0 ? (
        <Options labels={field.options ?? []} />
      ) : field.fieldType === 'boolean' ? (
        <Options labels={[t.yes, t.no]} />
      ) : field.fieldType === 'textarea' ? (
        <Lines count={4} />
      ) : field.fieldType === 'number' ? (
        <View style={[s.writeLine, { width: 140 }]} />
      ) : (
        <Lines count={2} />
      )}
    </View>
  );
}

function SectionTitle({ title, accent }: { title: string; accent: string }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 10 }} minPresenceAhead={60}>
      <View style={{ width: 3, height: 13, backgroundColor: accent, marginRight: 7, borderRadius: 1 }} />
      <Text style={{ fontSize: 12.5, fontWeight: 700, color: C.fg1 }}>{title}</Text>
    </View>
  );
}

export function AnamnesisPDF(props: AnamnesisPdfProps) {
  const { lang, athlete, branding } = props;
  const t = L[lang];
  const accent = branding?.primaryColor && /^#[0-9a-f]{6}$/i.test(branding.primaryColor) ? branding.primaryColor : DEFAULT_ACCENT;
  const studio = branding?.businessName || props.coachName || '';
  const age = ageFrom(athlete.birthday);

  const info: Array<[string, string]> = [
    [t.name, athlete.name],
    [t.birthday, athlete.birthday ? `${formatDate(athlete.birthday, t.locale)}${age !== null ? ` (${age} ${t.years})` : ''}` : ''],
    [t.sex, athlete.sex ? (t.sexes[athlete.sex] ?? athlete.sex) : ''],
    [t.sports, (athlete.sports ?? []).join(', ')],
    [t.occupation, athlete.occupation ?? ''],
    [t.date, formatDate(props.conductedAt, t.locale)],
  ];

  const customs = props.customQuestions.filter((f) => f.label.trim());

  return (
    <Document title={`${t.title} – ${athlete.name}`} author={studio || undefined}>
      <Page size="A4" style={s.page}>
        {/* Running header from page 2 on */}
        <Text
          fixed
          style={{ position: 'absolute', top: 20, left: 44, right: 44, fontSize: 8, color: C.fg3 }}
          render={({ pageNumber }) => (pageNumber > 1 ? `${t.title} · ${athlete.name}` : '')}
        />

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          <View style={{ maxWidth: 260 }}>
            {branding?.logoBase64 ? (
              <Image src={branding.logoBase64} style={{ height: 34, objectFit: 'contain', objectPosition: 'left' }} />
            ) : studio ? (
              <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: C.fg1 }}>{studio}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: C.fg1 }}>{t.title}</Text>
            {props.templateName ? <Text style={{ fontSize: 9, color: C.fg3, marginTop: 2 }}>{props.templateName}</Text> : null}
          </View>
        </View>
        <View style={{ height: 2, backgroundColor: accent, marginBottom: 14 }} />

        {/* Athlete details — empty ones get a line to fill in */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {info.map(([label, value]) => (
            <View key={label} style={{ width: '50%', paddingRight: 14, marginBottom: 8 }}>
              <Text style={{ fontSize: 8, color: C.fg3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{label}</Text>
              {value
                ? <Text style={{ fontSize: 10.5, fontWeight: 500 }}>{value}</Text>
                : <View style={{ height: 14, borderBottomWidth: 0.6, borderBottomColor: C.line }} />}
            </View>
          ))}
        </View>

        {props.consent ? (
          <Text style={{ fontSize: 8.5, color: C.fg3, marginBottom: 10 }}>
            {t.online(formatDate(props.consent.consentedAt, t.locale))} · {t.consent}
            {props.consent.guardianName ? t.guardian(props.consent.guardianName) : ''}
          </Text>
        ) : null}

        {/* Sections */}
        {props.sections.map((section) => (
          <View key={section.id}>
            <SectionTitle title={section.title} accent={accent} />
            {section.fields.map((field) => (
              <FieldBlock key={field.id} field={field} value={props.fieldValues[field.id] ?? ''} lang={lang} />
            ))}
          </View>
        ))}

        {customs.length > 0 && (
          <View>
            <SectionTitle title={t.custom} accent={accent} />
            {customs.map((field) => (
              <FieldBlock key={field.id} field={field} value={props.customFieldValues[field.id] ?? ''} lang={lang} />
            ))}
          </View>
        )}

        {/* Notes — a page's worth of lines (may continue on the next page) */}
        <View>
          <SectionTitle title={t.notes} accent={accent} />
          <Lines count={24} />
        </View>

        {/* Footer */}
        <View
          fixed
          style={{
            position: 'absolute', bottom: 24, left: 44, right: 44,
            flexDirection: 'row', justifyContent: 'space-between',
            borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6,
          }}
        >
          <Text style={{ fontSize: 7.5, color: C.fg3 }}>{[studio, t.confidential].filter(Boolean).join(' · ')}</Text>
          <Text style={{ fontSize: 7.5, color: C.fg3 }} render={({ pageNumber, totalPages }) => t.page(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
