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
import type { AnamnesisAttachment, AnamnesisField, AnamnesisFile, AnamnesisNote, AnamnesisSection, AnamnesisConsent } from '@/types/anamnesis';
import {
  DAY_LABELS, YESNO_OTHER, YESNO_OTHER_TEXT, WEEK_GRID_COLORS, WEEK_GRID_HOURS, WEEK_GRID_LABELS, contextFor, conditionState, describeCondition, formatAnswer,
  FILES_SUFFIX, filesKey, isAnswered, isNegativeChoice, onlyYesItems, parseAnswerFiles, parseBodyMap, parseDateRanges, parseList, parseMulti, parseWeekGrid, parseYesNoList, regionLabel,
  type BodyMapSpot, type WeekGridCell,
} from '@/utils/anamnesisAnswers';
import { localizeField, localizeSection } from '@/utils/anamnesisI18n';

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
  branding?: { logoBase64?: string; primaryColor?: string; businessName?: string; businessAddress?: string; businessPhone?: string };
  coachName?: string;
}

const L = {
  de: {
    title: 'Anamnese',
    name: 'Name', birthday: 'Geburtsdatum', sex: 'Geschlecht', sports: 'Sportart(en)', occupation: 'Beruf', date: 'Termin',
    years: 'Jahre', sexes: { male: 'männlich', female: 'weiblich', other: 'divers' } as Record<string, string>,
    yes: 'Ja', no: 'Nein', notes: 'Notizen', custom: 'Weitere Fragen',
    onlyIf: (c: string) => `Nur falls: ${c}`,
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
    onlyIf: (c: string) => `Only if: ${c}`,
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

/** Tick boxes — `values` are what is stored (main language), `labels` what is printed (may be translated) */
function Options({ labels, values, picked }: { labels: string[]; values?: string[]; picked?: string | string[] }) {
  const valueOf = (label: string) => values?.[labels.indexOf(label)] ?? label;
  const isPicked = (label: string) => (Array.isArray(picked) ? picked.includes(valueOf(label)) : picked === valueOf(label));
  return (
    <View style={s.optionRow}>
      {labels.map((label) => (
        <View key={label} style={s.option}>
          <View style={[s.tick, isPicked(label) ? { backgroundColor: C.fg1, borderColor: C.fg1 } : {}]} />
          <Text style={{ fontSize: 9.5, color: C.fg2 }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Body map: both views with the marked spots (numbered), or empty to mark by hand ──
const BODY_VIEWBOX = { front: { w: 193, h: 306 }, back: { w: 211, h: 317 } } as const;
const BODY_PDF_H = 190;

function BodyMapBlock({ spots, lang }: { spots: BodyMapSpot[]; lang: AnamnesisPdfLang }) {
  const sideLabel = lang === 'de' ? { front: 'Vorne', back: 'Hinten' } : { front: 'Front', back: 'Back' };
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {(['front', 'back'] as const).map((view) => {
          const vb = BODY_VIEWBOX[view];
          const scale = BODY_PDF_H / vb.h;
          const w = vb.w * scale;
          return (
            <View key={view} style={{ marginRight: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: C.fg3, marginBottom: 2 }}>{sideLabel[view]}</Text>
              <View style={{ position: 'relative', width: w, height: BODY_PDF_H }}>
                <Image src={`/bodymap-${view}.png`} style={{ width: w, height: BODY_PDF_H }} />
                {spots.map((spot, i) => (spot.view !== view ? null : (
                  <View key={spot.id} style={{
                    position: 'absolute', left: spot.x * scale - 6, top: spot.y * scale - 6, width: 12, height: 12,
                    borderRadius: 6, backgroundColor: '#1e40af', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 6.5, fontWeight: 700, color: '#ffffff' }}>{i + 1}</Text>
                  </View>
                )))}
              </View>
            </View>
          );
        })}
      </View>
      {spots.map((spot, i) => (
        <Text key={spot.id} style={{ fontSize: 9.5, color: C.fg1, marginBottom: 2 }}>
          {i + 1}. {regionLabel(spot.region, lang)} ({sideLabel[spot.view].toLowerCase()})
          {spot.nrs !== undefined ? ` – ${lang === 'de' ? 'Schmerz' : 'pain'} ${spot.nrs}/10` : ''}
          {spot.note.trim() ? `: ${spot.note.trim()}` : ''}
        </Text>
      ))}
    </View>
  );
}

// ── Weekly schedule: hours × days, coloured cells (empty grid to fill in by hand) ──
function WeekGridBlock({ value, lang }: { value: string; lang: AnamnesisPdfLang }) {
  const grid = parseWeekGrid(value);
  const cellW = 52;
  const cellH = 9;
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        {(['a', 't', 'o'] as WeekGridCell[]).map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
            <View style={{ width: 8, height: 8, backgroundColor: WEEK_GRID_COLORS[k], marginRight: 3, borderRadius: 1 }} />
            <Text style={{ fontSize: 8, color: C.fg2 }}>{WEEK_GRID_LABELS[lang][k]}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 22 }} />
        {DAY_LABELS[lang].map((d) => (
          <Text key={d} style={{ width: cellW, fontSize: 8, color: C.fg3, textAlign: 'center' }}>{d}</Text>
        ))}
      </View>
      {WEEK_GRID_HOURS.map((h) => (
        <View key={h} style={{ flexDirection: 'row' }}>
          <Text style={{ width: 22, fontSize: 7, color: C.fg3, textAlign: 'right', paddingRight: 3 }}>{h}</Text>
          {Array.from({ length: 7 }, (_, day) => {
            const cell = grid.cells[`${day}-${h}`];
            return (
              <View key={day} style={{
                width: cellW, height: cellH, borderWidth: 0.4, borderColor: C.line, marginLeft: -0.4, marginTop: -0.4,
                backgroundColor: cell ? WEEK_GRID_COLORS[cell] : undefined,
              }} />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ListBlock({ field, value, lang }: { field: AnamnesisField; value: string; lang: AnamnesisPdfLang }) {
  const cols = field.listColumns ?? [];
  const rows = parseList(value).filter((r) => Object.values(r).some((v) => v?.trim()));
  const shownRows: Array<Record<string, string>> = rows.length > 0 ? rows : [{}, {}, {}];
  return (
    <View style={{ borderWidth: 0.5, borderColor: C.border, borderRadius: 2 }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.box }}>
        {cols.map((c) => (
          <Text key={c.id} style={{ flex: 1, fontSize: 8.5, fontWeight: 600, color: C.fg2, paddingVertical: 3, paddingHorizontal: 4 }}>{c.label}</Text>
        ))}
      </View>
      {shownRows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.border, minHeight: rows.length > 0 ? 0 : LINE_H }}>
          {cols.map((c) => (
            <Text key={c.id} style={{ flex: 1, fontSize: 9.5, paddingVertical: 3, paddingHorizontal: 4 }}>
              {c.type === 'date' && r[c.id] ? formatDate(r[c.id], L[lang].locale)
                : c.type === 'select' && r[c.id] ? (c.optionLabels?.[(c.options ?? []).indexOf(r[c.id])] ?? r[c.id]) : (r[c.id] ?? '')}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Marked periods as a table (From / To / What) — empty rows to fill in by hand */
function PeriodsBlock({ value, lang }: { value: string; lang: AnamnesisPdfLang }) {
  const t = L[lang];
  const periods = parseDateRanges(value);
  const head = lang === 'de' ? ['Von', 'Bis', 'Was'] : ['From', 'To', 'What'];
  const rows = periods.length > 0
    ? periods.map((p) => [formatDate(p.from, t.locale), formatDate(p.to, t.locale), [p.kind, p.label].filter(Boolean).join(': ')])
    : [['', '', ''], ['', '', ''], ['', '', '']];
  const widths = [70, 70, undefined];
  return (
    <View style={{ borderWidth: 0.5, borderColor: C.border, borderRadius: 2 }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.box }}>
        {head.map((h, i) => (
          <Text key={h} style={{ width: widths[i], flex: widths[i] ? undefined : 1, fontSize: 8.5, fontWeight: 600, color: C.fg2, paddingVertical: 3, paddingHorizontal: 4 }}>{h}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.border, minHeight: periods.length > 0 ? 0 : LINE_H }}>
          {r.map((cell, i) => (
            <Text key={i} style={{ width: widths[i], flex: widths[i] ? undefined : 1, fontSize: 9.5, paddingVertical: 3, paddingHorizontal: 4 }}>{cell}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function YesNoListBlock({ field, value, lang }: { field: AnamnesisField; value: string; lang: AnamnesisPdfLang }) {
  const t = L[lang];
  const answers = parseYesNoList(value);
  return (
    <View>
      {[...(field.options ?? []), ...(field.allowOther ? [YESNO_OTHER] : [])].map((item) => (
        <View key={item} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2.5, borderBottomWidth: 0.4, borderBottomColor: C.border }}>
          {(['yes', 'no'] as const).map((a) => (
            <View key={a} style={{ flexDirection: 'row', alignItems: 'center', width: 40 }}>
              <View style={[s.tick, answers[item] === a ? { backgroundColor: C.fg1, borderColor: C.fg1 } : {}]} />
              <Text style={{ fontSize: 8.5, color: C.fg3 }}>{a === 'yes' ? t.yes : t.no}</Text>
            </View>
          ))}
          <Text style={{ flex: 1, fontSize: 9.5, color: C.fg1 }}>
            {item === YESNO_OTHER
              ? `${lang === 'de' ? 'Sonstiges' : 'Other'}: ${answers[YESNO_OTHER_TEXT] ?? '______________________________'}`
              : (field.optionLabels?.[(field.options ?? []).indexOf(item)] ?? item)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** "Dateien: a.pdf, b.jpg" below an answer — the files the athlete uploaded (attached separately) */
function FilesLine({ files, lang }: { files: AnamnesisFile[]; lang: AnamnesisPdfLang }) {
  if (files.length === 0) return null;
  return (
    <Text style={{ fontSize: 8.5, color: C.fg2, marginTop: 2 }}>
      {lang === 'de' ? 'Hochgeladene Dateien' : 'Uploaded files'}: {files.map((f) => f.name).join(', ')}
    </Text>
  );
}

function FieldBlock({ field: original, value, lang, onlyIf, files = [] }: {
  field: AnamnesisField; value: string; lang: AnamnesisPdfLang;
  /** Files uploaded below the answer */
  files?: AnamnesisFile[];
  /** Shown when it depends on an earlier answer that isn't known yet */
  onlyIf?: string;
}) {
  const t = L[lang];
  // The question in the PDF's language when the template has a translation into it
  const field = localizeField(original, lang);
  const answered = isAnswered(field, value) && field.fieldType !== 'info';
  const type = field.fieldType;
  // A question is never split across two pages (a block taller than a page still breaks)
  return (
    <View wrap={false} style={{ marginBottom: 11 }}>
      <Text style={s.fieldLabel} minPresenceAhead={40}>{field.label}</Text>
      {onlyIf && <Text style={{ fontSize: 8, color: C.fg3, marginTop: -2, marginBottom: 3 }}>{t.onlyIf(onlyIf)}</Text>}
      {field.helpText && (
        <Text style={type === 'info'
          ? { fontSize: 9.5, color: C.fg2, lineHeight: 1.4 }
          : { fontSize: 8.5, color: C.fg3, marginTop: -2, marginBottom: 4 }}>{field.helpText}</Text>
      )}
      {type === 'info' ? null
        : type === 'bodyMap' ? <BodyMapBlock spots={parseBodyMap(value)} lang={lang} />
        : type === 'weekGrid' ? <WeekGridBlock value={value} lang={lang} />
        : type === 'dateRanges' ? <PeriodsBlock value={value} lang={lang} />
        : type === 'list' ? <ListBlock field={field} value={value} lang={lang} />
        : type === 'yesnoList' ? <YesNoListBlock field={field} value={value} lang={lang} />
        : type === 'multiselect' ? (
          <View>
            <Options labels={field.optionLabels ?? field.options ?? []} values={field.options} picked={parseMulti(value)} />
            {field.allowOther && (() => {
              const other = parseMulti(value).find((x) => !(field.options ?? []).includes(x));
              return (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 9.5, color: C.fg2, marginRight: 4 }}>{lang === 'de' ? 'Sonstiges:' : 'Other:'}</Text>
                  {other
                    ? <Text style={{ fontSize: 9.5, color: C.fg1 }}>{other}</Text>
                    : <View style={[s.writeLine, { flex: 1, height: 14 }]} />}
                </View>
              );
            })()}
          </View>
        )
        : type === 'scale' ? (
          <View>
            <Options
              labels={Array.from({ length: (field.scaleMax ?? 10) - (field.scaleMin ?? 0) + 1 }, (_, i) => String((field.scaleMin ?? 0) + i))}
              picked={value.trim()}
            />
            {(field.scaleMinLabel || field.scaleMaxLabel) && (
              <Text style={{ fontSize: 8, color: C.fg3 }}>
                {[field.scaleMinLabel && `${field.scaleMin ?? 0} = ${field.scaleMinLabel}`, field.scaleMaxLabel && `${field.scaleMax ?? 10} = ${field.scaleMaxLabel}`].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
        )
        : answered ? (
          <>
            <Text style={s.answer}>{formatAnswer(field, value, lang)}</Text>
            <View style={s.noteLine} />
            <View style={s.noteLine} />
          </>
        ) : type === 'select' && (field.options?.length ?? 0) > 0 ? (
          <Options labels={field.optionLabels ?? field.options ?? []} />
        ) : type === 'boolean' ? (
          <Options labels={[t.yes, t.no]} />
        ) : type === 'textarea' ? (
          <Lines count={4} />
        ) : type === 'number' || type === 'date' ? (
          <View style={[s.writeLine, { width: 140 }]} />
        ) : (
          <Lines count={2} />
        )}
      <FilesLine files={files} lang={lang} />
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
  const ctx = contextFor(props.sections, props.fieldValues, athlete.sex);
  const allFields = props.sections.flatMap((sec) => sec.fields);

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

        {/* Sections — questions whose "show only if" clearly doesn't hold are left out; those that
            depend on an answer not given yet are printed with "Only if: …" */}
        {props.sections.map((section) => {
          const sectionState = conditionState(section.condition, ctx);
          if (sectionState === 'notMet') return null;
          const fields = section.fields.filter((f) => conditionState(f.condition, ctx) !== 'notMet');
          if (fields.length === 0) return null;
          return (
            <View key={section.id}>
              <SectionTitle title={localizeSection(section, lang).title} accent={accent} />
              {sectionState === 'unknown' && section.condition && (
                <Text style={{ fontSize: 8, color: C.fg3, marginTop: -6, marginBottom: 6 }}>
                  {t.onlyIf(describeCondition(section.condition, allFields, lang))}
                </Text>
              )}
              {localizeSection(section, lang).helpText && <Text style={{ fontSize: 8.5, color: C.fg3, marginTop: -4, marginBottom: 8 }}>{localizeSection(section, lang).helpText}</Text>}
              {fields.map((field) => (
                <FieldBlock
                  key={field.id}
                  field={field}
                  value={props.fieldValues[field.id] ?? ''}
                  files={parseAnswerFiles(props.fieldValues[filesKey(field.id)])}
                  lang={lang}
                  onlyIf={field.condition && conditionState(field.condition, ctx) === 'unknown'
                    ? describeCondition(field.condition, allFields, lang) : undefined}
                />
              ))}
            </View>
          );
        })}

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

// ── Report (Befundbericht) — after the appointment ───────────────────────────
// Compact: sender, athlete details, only the answered questions (no space to write), the
// appointment's notes, the AI summary, the list of attachments, signature line. The coach picks the
// content before exporting (data minimisation, e.g. for a doctor).

const R = {
  de: {
    title: 'Befundbericht', created: 'Erstellt am', for: 'Für', notes: 'Notizen aus dem Termin', dictated: 'diktiert',
    summary: 'Zusammenfassung', attachments: 'Anhänge (separat)', place: 'Ort, Datum', signature: 'Unterschrift',
    appointment: 'Termin', athlete: 'Athlet/in',
  },
  en: {
    title: 'Assessment report', created: 'Created on', for: 'For', notes: 'Notes from the appointment', dictated: 'dictated',
    summary: 'Summary', attachments: 'Attachments (separate)', place: 'Place, date', signature: 'Signature',
    appointment: 'Appointment', athlete: 'Athlete',
  },
} as const;

export interface AnamnesisReportContent {
  /** Sections to include (ids) */
  sectionIds: string[];
  customQuestions: boolean;
  notes: boolean;
  summary: boolean;
  attachments: boolean;
  /** Leave out choice answers that only say no / none (never free text) */
  hideNegatives?: boolean;
}

export interface AnamnesisReportProps extends AnamnesisPdfProps {
  include: AnamnesisReportContent;
  notes: AnamnesisNote[];
  aiSummary: string | null;
  attachments: AnamnesisAttachment[];
  /** e.g. "Dr. Müller (Orthopädie)" — shown under the title */
  recipient?: string;
  contactEmail?: string;
}

/** One answered question: label + answer (structured answers as their block) */
function ReportAnswer({ field: original, value, lang, files = [] }: { field: AnamnesisField; value: string; lang: AnamnesisPdfLang; files?: AnamnesisFile[] }) {
  const field = localizeField(original, lang);
  const type = field.fieldType;
  const block = type === 'bodyMap' ? <BodyMapBlock spots={parseBodyMap(value)} lang={lang} />
    : type === 'weekGrid' ? <WeekGridBlock value={value} lang={lang} />
    : type === 'list' ? <ListBlock field={field} value={value} lang={lang} />
    : type === 'dateRanges' ? <PeriodsBlock value={value} lang={lang} />
    : null;
  return (
    <View wrap={false} style={{ marginBottom: 7 }}>
      <Text style={{ fontSize: 9, fontWeight: 600, color: C.fg2, marginBottom: 2 }}>{field.label}</Text>
      {block ?? <Text style={{ fontSize: 10, lineHeight: 1.4, color: C.fg1 }}>{formatAnswer(field, value, lang)}</Text>}
      <FilesLine files={files} lang={lang} />
    </View>
  );
}

/** "## Heading" / "- item" / "**bold**" of the AI summary as PDF text */
function SummaryText({ text }: { text: string }) {
  return (
    <View>
      {text.split('\n').filter((l) => l.trim()).map((line, i) => {
        const heading = /^#{1,3}\s+/.test(line);
        const bullet = /^\s*[-*]\s+/.test(line);
        const clean = line.replace(/^#{1,3}\s+/, '').replace(/^\s*[-*]\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1');
        return heading
          ? <Text key={i} style={{ fontSize: 10, fontWeight: 700, marginTop: i === 0 ? 0 : 6, marginBottom: 2 }}>{clean}</Text>
          : <Text key={i} style={{ fontSize: 9.5, lineHeight: 1.4, marginLeft: bullet ? 8 : 0, color: C.fg1 }}>{bullet ? `• ${clean}` : clean}</Text>;
      })}
    </View>
  );
}

export function AnamnesisReportPDF(props: AnamnesisReportProps) {
  const { lang, athlete, branding, include } = props;
  const t = L[lang];
  const r = R[lang];
  const accent = branding?.primaryColor && /^#[0-9a-f]{6}$/i.test(branding.primaryColor) ? branding.primaryColor : DEFAULT_ACCENT;
  const studio = branding?.businessName || props.coachName || '';
  const age = ageFrom(athlete.birthday);
  const ctx = contextFor(props.sections, props.fieldValues, athlete.sex);
  const today = formatDate(new Date().toISOString(), t.locale);
  // Files the athlete uploaded in the form (all questions) — listed with the attachments
  const formFiles = Object.entries(props.fieldValues)
    .filter(([key]) => key.endsWith(FILES_SUFFIX))
    .flatMap(([, value]) => parseAnswerFiles(value));

  const sections = props.sections
    .filter((sec) => include.sectionIds.includes(sec.id) && conditionState(sec.condition, ctx) !== 'notMet')
    .map((sec) => ({
      sec,
      fields: sec.fields.filter((f) => f.fieldType !== 'info'
        && conditionState(f.condition, ctx) !== 'notMet'
        && isAnswered(f, props.fieldValues[f.id])
        && !(include.hideNegatives && isNegativeChoice(f, props.fieldValues[f.id]))),
    }))
    .filter((x) => x.fields.length > 0);
  const customs = include.customQuestions
    ? props.customQuestions.filter((f) => f.label.trim() && isAnswered(f, props.customFieldValues[f.id])
      && !(include.hideNegatives && isNegativeChoice(f, props.customFieldValues[f.id])))
    : [];

  const info: Array<[string, string]> = [
    [r.athlete, athlete.name],
    [t.birthday, athlete.birthday ? `${formatDate(athlete.birthday, t.locale)}${age !== null ? ` (${age} ${t.years})` : ''}` : ''],
    [t.sports, (athlete.sports ?? []).join(', ')],
    [r.appointment, formatDate(props.conductedAt, t.locale)],
  ].filter(([, v]) => v) as Array<[string, string]>;

  return (
    <Document title={`${r.title} – ${athlete.name}`} author={studio || undefined}>
      <Page size="A4" style={s.page}>
        <Text fixed style={{ position: 'absolute', top: 20, left: 44, right: 44, fontSize: 8, color: C.fg3 }}
          render={({ pageNumber }) => (pageNumber > 1 ? `${r.title} · ${athlete.name}` : '')} />

        {/* Sender */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <View style={{ maxWidth: 280 }}>
            {branding?.logoBase64
              ? <Image src={branding.logoBase64} style={{ height: 32, objectFit: 'contain', objectPosition: 'left', marginBottom: 4 }} />
              : null}
            {studio ? <Text style={{ fontSize: 10, fontWeight: 700 }}>{studio}</Text> : null}
            {props.coachName && props.coachName !== studio ? <Text style={{ fontSize: 9, color: C.fg2 }}>{props.coachName}</Text> : null}
            {(branding?.businessAddress ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => (
              <Text key={i} style={{ fontSize: 9, color: C.fg2 }}>{l}</Text>
            ))}
            {[branding?.businessPhone?.trim(), props.contactEmail].filter(Boolean).length > 0
              ? <Text style={{ fontSize: 9, color: C.fg2 }}>{[branding?.businessPhone?.trim(), props.contactEmail].filter(Boolean).join(' · ')}</Text>
              : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 19, fontWeight: 700 }}>{r.title}</Text>
            <Text style={{ fontSize: 9, color: C.fg3, marginTop: 2 }}>{r.created} {today}</Text>
            {props.recipient ? <Text style={{ fontSize: 9, color: C.fg2, marginTop: 2 }}>{r.for}: {props.recipient}</Text> : null}
          </View>
        </View>
        <View style={{ height: 2, backgroundColor: accent, marginBottom: 12 }} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {info.map(([label, value]) => (
            <View key={label} style={{ width: '50%', paddingRight: 14, marginBottom: 6 }}>
              <Text style={{ fontSize: 8, color: C.fg3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 1 }}>{label}</Text>
              <Text style={{ fontSize: 10.5, fontWeight: 500 }}>{value}</Text>
            </View>
          ))}
        </View>

        {include.summary && props.aiSummary?.trim() ? (
          <View>
            <SectionTitle title={r.summary} accent={accent} />
            <SummaryText text={props.aiSummary} />
          </View>
        ) : null}

        {sections.map(({ sec, fields }) => (
          <View key={sec.id}>
            <SectionTitle title={localizeSection(sec, lang).title} accent={accent} />
            {fields.map((f) => (
              <ReportAnswer key={f.id} field={f} lang={lang} files={parseAnswerFiles(props.fieldValues[filesKey(f.id)])}
                value={include.hideNegatives && f.fieldType === 'yesnoList' ? onlyYesItems(props.fieldValues[f.id]) : (props.fieldValues[f.id] ?? '')} />
            ))}
          </View>
        ))}

        {customs.length > 0 && (
          <View>
            <SectionTitle title={t.custom} accent={accent} />
            {customs.map((f) => <ReportAnswer key={f.id} field={f} value={props.customFieldValues[f.id] ?? ''} lang={lang} />)}
          </View>
        )}

        {include.notes && props.notes.length > 0 && (
          <View>
            <SectionTitle title={r.notes} accent={accent} />
            {props.notes.map((n) => (
              <View key={n.id} wrap={false} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 8, color: C.fg3, marginBottom: 1 }}>
                  {formatDate(n.createdAt, t.locale)}{n.source === 'dictated' ? ` · ${r.dictated}` : ''}
                </Text>
                <Text style={{ fontSize: 9.5, lineHeight: 1.4 }}>{n.text}</Text>
              </View>
            ))}
          </View>
        )}

        {include.attachments && (props.attachments.length > 0 || formFiles.length > 0) && (
          <View>
            <SectionTitle title={r.attachments} accent={accent} />
            {props.attachments.map((a) => <Text key={a.path} style={{ fontSize: 9.5, marginBottom: 2 }}>• {a.name}</Text>)}
            {/* Uploaded by the athlete in the form */}
            {formFiles.map((f) => <Text key={f.path} style={{ fontSize: 9.5, marginBottom: 2 }}>• {f.name}</Text>)}
          </View>
        )}

        {/* Signature */}
        <View wrap={false} style={{ flexDirection: 'row', marginTop: 28 }}>
          <View style={{ flex: 1, marginRight: 30 }}>
            <View style={{ height: 22, borderBottomWidth: 0.6, borderBottomColor: C.fg3 }} />
            <Text style={{ fontSize: 8, color: C.fg3, marginTop: 2 }}>{r.place}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ height: 22, borderBottomWidth: 0.6, borderBottomColor: C.fg3 }} />
            <Text style={{ fontSize: 8, color: C.fg3, marginTop: 2 }}>{r.signature}{props.coachName ? ` – ${props.coachName}` : ''}</Text>
          </View>
        </View>

        <View fixed style={{
          position: 'absolute', bottom: 24, left: 44, right: 44,
          flexDirection: 'row', justifyContent: 'space-between',
          borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6,
        }}>
          <Text style={{ fontSize: 7.5, color: C.fg3 }}>{[studio, t.confidential].filter(Boolean).join(' · ')}</Text>
          <Text style={{ fontSize: 7.5, color: C.fg3 }} render={({ pageNumber, totalPages }) => t.page(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
