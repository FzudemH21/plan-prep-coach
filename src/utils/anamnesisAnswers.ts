/**
 * anamnesisAnswers — reading, writing and showing anamnesis answers of every question type, and the
 * "show only if" conditions. Answers are stored as text per question (field_values); the structured
 * types keep JSON in that text:
 *   multiselect  ["Option A","Option B"]
 *   yesnoList    {"Item text":"yes","Other item":"no"}
 *   list         [{"colId":"value",…},…]
 *   bodyMap      [{"id":"…","view":"front","x":96.5,"y":140.2,"region":"16-L-F","note":"…","nrs":6,
 *                  "answers":{"s-kind":"…"},"linkedTo":"…"},…]  — "[]" = "None" (nothing to mark)
 *   weekGrid     {"v":1,"cells":{"0-17":"a","0-18":"t"}}  (day 0 = Monday, hour 5–22, a/t/o)
 *   dateRanges   [{"id":"…","from":"2026-07-12","to":"2026-07-19","label":"Mallorca","kind":"Urlaub"},…]
 * Unreadable JSON (e.g. a question whose type was changed) falls back to the plain text.
 */
import type {
  AnamnesisCondition, AnamnesisField, AnamnesisFile, AnamnesisSection,
} from '@/types/anamnesis';
import { PROFILE_SEX_SOURCE } from '@/types/anamnesis';
import { BODY_REGIONS, getRegionKeyLabel } from '@/lib/bodyMapData';
import { localizeField, optionLabel } from '@/utils/anamnesisI18n';

export type AnswerLang = 'de' | 'en';

// ── Parsing ───────────────────────────────────────────────────────────────────

function parseJson<T>(value: string | undefined, check: (v: unknown) => boolean): T | null {
  if (!value?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return check(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export function parseMulti(value: string | undefined): string[] {
  return parseJson<string[]>(value, v => Array.isArray(v))?.filter(x => typeof x === 'string') ?? [];
}

/** item → 'yes' | 'no'; with "Sonstiges": YESNO_OTHER → 'yes' | 'no' and YESNO_OTHER_TEXT → its text */
export type YesNoAnswers = Record<string, string>;
export const YESNO_OTHER = '__other';
export const YESNO_OTHER_TEXT = '__otherText';
export function parseYesNoList(value: string | undefined): YesNoAnswers {
  return parseJson<YesNoAnswers>(value, v => !!v && typeof v === 'object' && !Array.isArray(v)) ?? {};
}

export type ListRow = Record<string, string>;
export function parseList(value: string | undefined): ListRow[] {
  return parseJson<ListRow[]>(value, v => Array.isArray(v))?.filter(r => r && typeof r === 'object') ?? [];
}

export interface BodyMapSpot {
  id: string;
  view: 'front' | 'back';
  /** Exact position in the body image's viewBox (front 193×306, back 211×317) */
  x: number;
  y: number;
  /** Region key of bodyMapData (e.g. "16-L-F" = left knee, front) */
  region: string;
  note: string;
  /** Pain 0–10, when the question asks for it */
  nrs?: number;
  /** Answers to the body map's questions per spot (spotFields): question id → answer text, stored like
   *  field_values (files of a per-spot question under "<id>__files") */
  answers?: Record<string, string>;
  /** Part of the same problem as this earlier spot (e.g. pain radiating from the lower back into the
   *  thigh) — no questions of its own, the answers are that spot's */
  linkedTo?: string;
}
export function parseBodyMap(value: string | undefined): BodyMapSpot[] {
  return parseJson<BodyMapSpot[]>(value, v => Array.isArray(v))
    ?.filter(s => s && (s.view === 'front' || s.view === 'back') && Number.isFinite(s.x) && Number.isFinite(s.y))
    .map(s => ({ ...s, note: typeof s.note === 'string' ? s.note : '' })) ?? [];
}

/** The answer of a body map with "None" when there is nothing to mark */
export const BODY_MAP_NONE = '[]';
export const isBodyMapNone = (value: string | undefined): boolean => (value ?? '').trim() === BODY_MAP_NONE;

/** The spot whose answers count for `spot` — a linked spot shares the answers of its main spot */
export function mainSpot(spots: BodyMapSpot[], spot: BodyMapSpot): BodyMapSpot {
  return (spot.linkedTo && spots.find(s => s.id === spot.linkedTo && !s.linkedTo)) || spot;
}

/** Removes a spot; spots linked to it become spots of their own again */
export function withoutSpot(spots: BodyMapSpot[], id: string): BodyMapSpot[] {
  return spots.filter(s => s.id !== id).map(s => (s.linkedTo === id ? { ...s, linkedTo: undefined } : s));
}

/** A marked period in a 'dateRanges' question (from / to yyyy-MM-dd, both included) */
export interface DatePeriod {
  id: string;
  from: string;
  to: string;
  label: string;
  /** One of the question's types (options), e.g. "Urlaub" */
  kind?: string;
}
/** Uploaded files of a question are stored as an answer of their own: "<question id>__files" */
export const FILES_SUFFIX = '__files';
export const filesKey = (fieldId: string): string => `${fieldId}${FILES_SUFFIX}`;

export function parseAnswerFiles(value: string | undefined): AnamnesisFile[] {
  return parseJson<AnamnesisFile[]>(value, v => Array.isArray(v))
    ?.filter(f => f && typeof f.path === 'string' && typeof f.name === 'string') ?? [];
}

export function parseDateRanges(value: string | undefined): DatePeriod[] {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return parseJson<DatePeriod[]>(value, v => Array.isArray(v))
    ?.filter(p => p && iso.test(p.from) && iso.test(p.to))
    .map(p => ({ ...p, label: p.label ?? '' })) ?? [];
}

/** a = available for training, t = regular training (team / club), o = other physical load */
export type WeekGridCell = 'a' | 't' | 'o';
export interface WeekGridValue { v: 1; cells: Record<string, WeekGridCell> }
export const WEEK_GRID_START_HOUR = 5;
export const WEEK_GRID_END_HOUR = 23; // last slot 22:00–23:00
export const WEEK_GRID_HOURS = Array.from({ length: WEEK_GRID_END_HOUR - WEEK_GRID_START_HOUR }, (_, i) => WEEK_GRID_START_HOUR + i);
export function parseWeekGrid(value: string | undefined): WeekGridValue {
  const parsed = parseJson<WeekGridValue>(value, v => !!v && typeof v === 'object' && 'cells' in (v as object));
  return parsed ?? { v: 1, cells: {} };
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const DAY_LABELS: Record<AnswerLang, string[]> = {
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

export const WEEK_GRID_LABELS: Record<AnswerLang, Record<WeekGridCell, string>> = {
  de: { a: 'Verfügbar für Training', t: 'Reguläres Training (Team/Verein)', o: 'Sonstige Belastung (Arbeit, andere Sportarten)' },
  en: { a: 'Available for training', t: 'Regular training (team/club)', o: 'Other physical load (work, other sports)' },
};

/** Cell colours — the same in the form, the coach view and the PDF */
export const WEEK_GRID_COLORS: Record<WeekGridCell, string> = { a: '#22c55e', t: '#3b82f6', o: '#f59e0b' };

const REGION_LABELS_DE: Record<number, string> = {
  1: 'Kopf / Gesicht', 2: 'Nacken / Hals', 3: 'Schulter', 4: 'Oberarm', 5: 'Ellbogen', 6: 'Unterarm', 7: 'Handgelenk',
  8: 'Hand / Finger', 9: 'Brust / Rippen', 10: 'Bauch', 11: 'Brustwirbelsäule', 12: 'Lendenwirbelsäule',
  13: 'Becken / Gesäß', 14: 'Hüfte / Leiste', 15: 'Oberschenkel', 16: 'Knie', 17: 'Unterschenkel', 18: 'Sprunggelenk',
  19: 'Fuß / Zehen', 20: 'Sonstiges',
};

/** "Left Knee" / "Knie links" — from a region key, without the front/back suffix */
export function regionLabel(regionKey: string, lang: AnswerLang): string {
  const m = regionKey.match(/^(\d+)(?:-([LR]))?/);
  if (!m) return regionKey;
  const areaId = Number(m[1]);
  if (lang === 'en') return getRegionKeyLabel(regionKey).replace(/ \((Front|Back)\)$/, '');
  const base = REGION_LABELS_DE[areaId] ?? 'Unbekannt';
  return m[2] === 'L' ? `${base} links` : m[2] === 'R' ? `${base} rechts` : base;
}

export function regionAreaId(regionKey: string): string {
  return regionKey.match(/^(\d+)/)?.[1] ?? '';
}

export const BODY_AREAS = BODY_REGIONS;
export function areaLabel(areaId: string, lang: AnswerLang): string {
  const id = Number(areaId);
  return lang === 'de' ? (REGION_LABELS_DE[id] ?? areaId) : (BODY_REGIONS.find(r => r.id === id)?.label ?? areaId);
}

// ── Answered / text ───────────────────────────────────────────────────────────

/** Types the athlete answers — 'info' is text only */
export const isQuestion = (field: AnamnesisField) => field.fieldType !== 'info';

export function isAnswered(field: AnamnesisField, value: string | undefined): boolean {
  switch (field.fieldType) {
    case 'info': return true;
    case 'multiselect': return parseMulti(value).length > 0;
    case 'yesnoList': return Object.keys(parseYesNoList(value)).some(k => k !== YESNO_OTHER_TEXT);
    case 'list': return parseList(value).some(r => Object.values(r).some(v => v?.trim()));
    case 'bodyMap': return isBodyMapNone(value) || parseBodyMap(value).length > 0;
    case 'weekGrid': return Object.keys(parseWeekGrid(value).cells).length > 0;
    case 'dateRanges': return parseDateRanges(value).length > 0;
    default: return !!value?.trim();
  }
}

function formatDate(iso: string, lang: AnswerLang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "Mon: available 17–20, regular training 18–20" — consecutive hours merged */
export function weekGridLines(grid: WeekGridValue, lang: AnswerLang): string[] {
  const short = lang === 'de'
    ? { a: 'verfügbar', t: 'Training', o: 'sonstige Belastung' }
    : { a: 'available', t: 'regular training', o: 'other load' };
  const lines: string[] = [];
  for (let day = 0; day < 7; day++) {
    const parts: string[] = [];
    for (const kind of ['a', 't', 'o'] as WeekGridCell[]) {
      const ranges: string[] = [];
      let start: number | null = null;
      for (let h = WEEK_GRID_START_HOUR; h <= WEEK_GRID_END_HOUR; h++) {
        const on = h < WEEK_GRID_END_HOUR && grid.cells[`${day}-${h}`] === kind;
        if (on && start === null) start = h;
        if (!on && start !== null) { ranges.push(`${start}–${h}`); start = null; }
      }
      if (ranges.length > 0) parts.push(`${short[kind]} ${ranges.join(', ')}`);
    }
    if (parts.length > 0) lines.push(`${DAY_LABELS[lang][day]}: ${parts.join('; ')}`);
  }
  return lines;
}

/**
 * Plain-text answer — for the change history, the AI, the PDF and read-only fallbacks. Choices and
 * checklist items are shown in `lang` when the question has a translation into it (the PDF in the
 * template's other language); otherwise as stored.
 */
export function formatAnswer(field: AnamnesisField, value: string | undefined, lang: AnswerLang = 'en'): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  const label = (x: string) => optionLabel(field, x, lang);
  const yes = lang === 'de' ? 'Ja' : 'Yes';
  const no = lang === 'de' ? 'Nein' : 'No';
  switch (field.fieldType) {
    case 'boolean': return v === 'true' ? yes : v === 'false' ? no : v;
    case 'select': return label(v);
    case 'multiselect': {
      const m = parseMulti(v);
      if (!m.length) return v;
      // Entries that aren't one of the choices are the free text of "Sonstiges"
      const opts = field.options ?? [];
      return m.map(x => (opts.includes(x) ? label(x) : `${lang === 'de' ? 'Sonstiges' : 'Other'}: ${x}`)).join(', ');
    }
    case 'scale': return `${v} / ${field.scaleMax ?? 10}`;
    case 'date': return formatDate(v, lang);
    case 'yesnoList': {
      const a = parseYesNoList(v);
      const items = field.options ?? Object.keys(a).filter(k => k !== YESNO_OTHER && k !== YESNO_OTHER_TEXT);
      const lines = items.filter(i => a[i]).map(i => `${label(i)}: ${a[i] === 'yes' ? yes : no}`);
      if (a[YESNO_OTHER]) {
        const label = lang === 'de' ? 'Sonstiges' : 'Other';
        lines.push(`${label}${a[YESNO_OTHER_TEXT]?.trim() ? ` (${a[YESNO_OTHER_TEXT].trim()})` : ''}: ${a[YESNO_OTHER] === 'yes' ? yes : no}`);
      }
      return lines.join('\n');
    }
    case 'list': {
      const cols = field.listColumns ?? [];
      return parseList(v)
        .filter(r => Object.values(r).some(x => x?.trim()))
        .map(r => cols.length
          ? cols.filter(c => r[c.id]?.trim()).map(c => {
            // Column label and choice in `lang` when translated
            const ci = cols.indexOf(c);
            const tc = field.translations?.[lang]?.listColumns?.[ci];
            const val = c.type === 'date' ? formatDate(r[c.id], lang)
              : c.type === 'select' ? (tc?.options?.[(c.options ?? []).indexOf(r[c.id])]?.trim() || r[c.id]) : r[c.id];
            return `${tc?.label?.trim() || c.label}: ${val}`;
          }).join(', ')
          : Object.values(r).join(', '))
        .map(line => `- ${line}`)
        .join('\n');
    }
    case 'bodyMap': {
      if (isBodyMapNone(v)) return lang === 'de' ? 'Keine' : 'None';
      const spots = parseBodyMap(v);
      if (spots.length === 0) return v;
      // Without questions per spot: the note on the same line
      if (!field.spotFields?.length) {
        return spots.map((s, i) => spotHeading(s, i, lang) + (s.note.trim() ? `: ${s.note.trim()}` : '')).join('\n');
      }
      return spots.map((s, i) => [
        spotHeading(s, i, lang),
        ...spotDetailLines(field, s, spots, lang).flatMap(l => l.split('\n')).map(l => `   ${l}`),
      ].join('\n')).join('\n');
    }
    case 'weekGrid': return weekGridLines(parseWeekGrid(v), lang).join('\n');
    case 'dateRanges':
      return parseDateRanges(v)
        .map(p => `- ${p.from === p.to ? formatDate(p.from, lang) : `${formatDate(p.from, lang)} – ${formatDate(p.to, lang)}`}`
          + ((p.kind || p.label) ? `: ${[p.kind, p.label].filter(Boolean).join(' – ')}` : ''))
        .join('\n');
    case 'info': return '';
    default: return v;
  }
}

// ── Questions per spot (body map) ─────────────────────────────────────────────

const answerValues = (field: AnamnesisField, value: string | undefined): string[] =>
  field.fieldType === 'multiselect' ? parseMulti(value) : [(value ?? '').trim()];

/**
 * Whether a question per spot is asked for this spot: its body areas (spotRegions) and its condition
 * on an earlier answer of the same spot (a hidden or unanswered source = not asked)
 */
export function spotFieldShown(bodyMap: AnamnesisField, sub: AnamnesisField, spot: BodyMapSpot, depth = 0): boolean {
  if (sub.spotRegions?.length && !sub.spotRegions.includes(regionAreaId(spot.region))) return false;
  const c = sub.condition;
  if (!c || !c.sourceId || c.values.length === 0) return true;
  const source = bodyMap.spotFields?.find(f => f.id === c.sourceId);
  if (!source || source.id === sub.id) return true;
  if (depth < 10 && !spotFieldShown(bodyMap, source, spot, depth + 1)) return false;
  const value = spot.answers?.[source.id];
  if (!isAnswered(source, value)) return false;
  return answerValues(source, value).some(x => c.values.includes(x));
}

/** The questions asked for this spot, in order (none for a spot linked to another one) */
export function spotFieldsFor(bodyMap: AnamnesisField, spot: BodyMapSpot): AnamnesisField[] {
  if (spot.linkedTo) return [];
  return (bodyMap.spotFields ?? []).filter(f => spotFieldShown(bodyMap, f, spot));
}

/** Pain 0–10 of a spot (dot colour): the spot's own value, else the first 0–10 scale asked for it */
export function spotPain(bodyMap: AnamnesisField | undefined, spot: BodyMapSpot, spots: BodyMapSpot[]): number | undefined {
  if (spot.nrs !== undefined) return spot.nrs;
  if (!bodyMap?.spotFields?.length) return undefined;
  const main = mainSpot(spots, spot);
  const scale = spotFieldsFor(bodyMap, main)
    .find(f => f.fieldType === 'scale' && (f.scaleMin ?? 0) === 0 && (f.scaleMax ?? 10) === 10);
  const raw = scale ? main.answers?.[scale.id]?.trim() : '';
  const n = Number(raw);
  return raw && Number.isFinite(n) ? n : undefined;
}

/** "1. Knie links (vorne) – Schmerz 6/10" */
export function spotHeading(spot: BodyMapSpot, index: number, lang: AnswerLang): string {
  const side = lang === 'de' ? { front: 'vorne', back: 'hinten' } : { front: 'front', back: 'back' };
  return `${index + 1}. ${regionLabel(spot.region, lang)} (${side[spot.view]})`
    + (spot.nrs !== undefined ? ` – ${lang === 'de' ? 'Schmerz' : 'pain'} ${spot.nrs}/10` : '');
}

/**
 * The answers of one spot as "Question: answer" lines (questions asked for it with an answer, uploaded
 * files only as a count, the note). `skipNegative`: leave out choices that only say no / none (report).
 */
export function spotDetailLines(
  bodyMap: AnamnesisField, spot: BodyMapSpot, spots: BodyMapSpot[], lang: AnswerLang, skipNegative = false,
): string[] {
  const lines: string[] = [];
  const main = mainSpot(spots, spot);
  if (main !== spot) {
    const n = spots.indexOf(main) + 1;
    lines.push(lang === 'de' ? `Gehört zu ${n}. ${regionLabel(main.region, lang)}` : `Same problem as ${n}. ${regionLabel(main.region, lang)}`);
  } else {
    for (const sub of spotFieldsFor(bodyMap, spot)) {
      if (!isQuestion(sub)) continue;
      const value = spot.answers?.[sub.id];
      const fileCount = parseAnswerFiles(spot.answers?.[filesKey(sub.id)]).length;
      if (skipNegative && isNegativeChoice(sub, value) && fileCount === 0) continue;
      const answer = formatAnswer(sub, skipNegative && sub.fieldType === 'yesnoList' ? onlyYesItems(value) : value, lang);
      const files = fileCount === 0 ? ''
        : lang === 'de' ? `${fileCount} ${fileCount === 1 ? 'Datei' : 'Dateien'} hochgeladen` : `${fileCount} file${fileCount === 1 ? '' : 's'} uploaded`;
      const text = [answer, files].filter(Boolean).join(' · ');
      if (!text) continue;
      const label = localizeField(sub, lang).label;
      lines.push(text.includes('\n') ? `${label}:\n${text.split('\n').map(l => `  ${l}`).join('\n')}` : `${label}: ${text}`);
    }
  }
  if (spot.note.trim()) lines.push(`${lang === 'de' ? 'Notiz' : 'Note'}: ${spot.note.trim()}`);
  return lines;
}

export interface AnswerFileGroup { key: string; label: string; files: AnamnesisFile[] }

/** Files the athlete uploaded under a question — also those under a body map's questions per spot */
export function answerFileGroups(fields: AnamnesisField[], values: Record<string, string>, lang: AnswerLang = 'en'): AnswerFileGroup[] {
  const groups: AnswerFileGroup[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!key.endsWith(FILES_SUFFIX)) continue;
    const field = fields.find(f => f.id === key.slice(0, -FILES_SUFFIX.length));
    groups.push({ key, label: field ? localizeField(field, lang).label : 'Anamnesis', files: parseAnswerFiles(value) });
  }
  for (const field of fields) {
    if (field.fieldType !== 'bodyMap' || !field.spotFields?.length) continue;
    parseBodyMap(values[field.id]).forEach((spot, i) => {
      for (const sub of field.spotFields ?? []) {
        const files = parseAnswerFiles(spot.answers?.[filesKey(sub.id)]);
        if (files.length === 0) continue;
        groups.push({ key: `${field.id}.${spot.id}.${sub.id}`, label: `${localizeField(sub, lang).label} (${i + 1}. ${regionLabel(spot.region, lang)})`, files });
      }
    });
  }
  return groups.filter(g => g.files.length > 0);
}

/** How many files a question has — with a body map's questions per spot, those of all its spots */
export function answerFileCount(field: AnamnesisField, values: Record<string, string>): number {
  let n = parseAnswerFiles(values[filesKey(field.id)]).length;
  if (field.fieldType === 'bodyMap') {
    for (const spot of parseBodyMap(values[field.id])) {
      for (const sub of field.spotFields ?? []) n += parseAnswerFiles(spot.answers?.[filesKey(sub.id)]).length;
    }
  }
  return n;
}

// ── "No / none" answers (the report can leave them out) ───────────────────────

/** A choice that only says no / none — "Nein", "Keine", "Nichts davon", "Nein, noch nichts", "None" … */
const NEGATIVE_CHOICE = /^(nein|no|nope|kein|keine|keiner|none|nichts|nothing)\b/i;

/**
 * Whether a CHOICE answer only says "no / none" (yes/no = No, a choice like "Keine", a multiple choice
 * of only such options, a checklist without any "yes"). Free text is never treated as negative — a
 * text answer "keine" stays.
 */
export function isNegativeChoice(field: AnamnesisField, value: string | undefined): boolean {
  const v = (value ?? '').trim();
  if (!v) return false;
  switch (field.fieldType) {
    case 'bodyMap': return isBodyMapNone(v);
    case 'boolean': return v === 'false';
    case 'select': return NEGATIVE_CHOICE.test(v);
    case 'multiselect': {
      const picked = parseMulti(v);
      const opts = field.options ?? [];
      // Free text of "Sonstiges" is never negative
      return picked.length > 0 && picked.every(p => opts.includes(p) && NEGATIVE_CHOICE.test(p));
    }
    case 'yesnoList': {
      const a = parseYesNoList(v);
      return Object.keys(a).some(k => k !== YESNO_OTHER_TEXT) && !Object.entries(a).some(([k, x]) => k !== YESNO_OTHER_TEXT && x === 'yes');
    }
    default: return false;
  }
}

/** A checklist answer with only its "yes" items (and the "Sonstiges" text when that is yes) */
export function onlyYesItems(value: string | undefined): string {
  const a = parseYesNoList(value);
  const kept: YesNoAnswers = {};
  for (const [k, x] of Object.entries(a)) if (k !== YESNO_OTHER_TEXT && x === 'yes') kept[k] = x;
  if (kept[YESNO_OTHER] === 'yes' && a[YESNO_OTHER_TEXT]) kept[YESNO_OTHER_TEXT] = a[YESNO_OTHER_TEXT];
  return Object.keys(kept).length ? JSON.stringify(kept) : '';
}

// ── Conditions ────────────────────────────────────────────────────────────────

/** Types an answer can be a condition on */
export const CONDITION_SOURCE_TYPES = new Set(['boolean', 'select', 'multiselect', 'bodyMap']);

export interface ConditionContext {
  values: Record<string, string>;
  /** All fields of the anamnesis (to look up the source question and its own condition) */
  fields: AnamnesisField[];
  /** Sections — a source question in a hidden section counts as not answered */
  sections?: AnamnesisSection[];
  sex?: string | null;
}

export type ConditionState = 'met' | 'notMet' | 'unknown';

/**
 * Whether a condition holds. 'unknown' = the source question is not answered yet (or the sex isn't
 * known). A condition on a question that no longer exists is ignored ('met') — the question must not
 * disappear because its source was deleted.
 */
export function conditionState(condition: AnamnesisCondition | undefined, ctx: ConditionContext, depth = 0): ConditionState {
  if (!condition || !condition.sourceId || condition.values.length === 0) return 'met';
  if (condition.sourceId === PROFILE_SEX_SOURCE) {
    if (!ctx.sex) return 'unknown';
    return condition.values.includes(ctx.sex) ? 'met' : 'notMet';
  }
  const source = ctx.fields.find(f => f.id === condition.sourceId);
  if (!source) return 'met';
  // The source question itself hidden → its answer doesn't count
  if (depth < 10) {
    const sourceSection = ctx.sections?.find(s => s.fields.some(f => f.id === source.id));
    const sourceState = combine(
      conditionState(sourceSection?.condition, ctx, depth + 1),
      conditionState(source.condition, ctx, depth + 1),
    );
    if (sourceState === 'notMet') return 'notMet';
  }
  const value = ctx.values[source.id];
  if (!isAnswered(source, value)) return 'unknown';
  let picked: string[];
  switch (source.fieldType) {
    case 'multiselect': picked = parseMulti(value); break;
    case 'bodyMap': {
      const spots = parseBodyMap(value);
      if (condition.spotFieldId) {
        // "At least one spot whose answer to this per-spot question is …" (linked spots have none)
        const sub = source.spotFields?.find(f => f.id === condition.spotFieldId);
        if (!sub) return 'met';
        picked = spots.filter(s => !s.linkedTo && spotFieldShown(source, sub, s)).flatMap(s => answerValues(sub, s.answers?.[sub.id]));
      } else {
        picked = spots.map(s => regionAreaId(s.region));
      }
      break;
    }
    default: picked = [(value ?? '').trim()];
  }
  return picked.some(p => condition.values.includes(p)) ? 'met' : 'notMet';
}

function combine(a: ConditionState, b: ConditionState): ConditionState {
  if (a === 'notMet' || b === 'notMet') return 'notMet';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'met';
}

/** Section + question condition together */
export function fieldState(section: AnamnesisSection, field: AnamnesisField, ctx: ConditionContext): ConditionState {
  return combine(conditionState(section.condition, ctx), conditionState(field.condition, ctx));
}

export function contextFor(sections: AnamnesisSection[], values: Record<string, string>, sex?: string | null): ConditionContext {
  return { values, sections, fields: sections.flatMap(s => s.fields), sex };
}

/** "Do you have complaints? = Yes" — for the editor and the printed worksheet */
export function describeCondition(condition: AnamnesisCondition, fields: AnamnesisField[], lang: AnswerLang = 'en'): string {
  if (condition.sourceId === PROFILE_SEX_SOURCE) {
    const sexes = lang === 'de' ? { male: 'männlich', female: 'weiblich', other: 'divers' } : { male: 'male', female: 'female', other: 'other' };
    return `${lang === 'de' ? 'Geschlecht' : 'Sex'} = ${condition.values.map(v => sexes[v as keyof typeof sexes] ?? v).join(lang === 'de' ? ' oder ' : ' or ')}`;
  }
  const source = fields.find(f => f.id === condition.sourceId);
  if (!source) return lang === 'de' ? '(Frage gelöscht)' : '(question deleted)';
  const sub = condition.spotFieldId ? source.spotFields?.find(f => f.id === condition.spotFieldId) : undefined;
  if (condition.spotFieldId && !sub) return lang === 'de' ? '(Frage gelöscht)' : '(question deleted)';
  const asked = sub ?? source;
  const shown = condition.values.map(v => {
    if (asked.fieldType === 'boolean') return v === 'true' ? (lang === 'de' ? 'Ja' : 'Yes') : (lang === 'de' ? 'Nein' : 'No');
    if (asked.fieldType === 'bodyMap') return areaLabel(v, lang);
    return v;
  });
  const what = sub ? `${source.label} → ${lang === 'de' ? 'eine Stelle mit' : 'a spot with'} „${sub.label}“` : source.label;
  return `${what} = ${shown.join(lang === 'de' ? ' oder ' : ' or ')}`;
}

/** Possible values of a condition source: [value, label] */
export function conditionChoices(source: AnamnesisField | 'sex'): Array<[string, string]> {
  if (source === 'sex') return [['male', 'Male'], ['female', 'Female'], ['other', 'Other']];
  switch (source.fieldType) {
    case 'boolean': return [['true', 'Yes'], ['false', 'No']];
    case 'select':
    case 'multiselect': return (source.options ?? []).map(o => [o, o]);
    case 'bodyMap': return BODY_REGIONS.map(r => [String(r.id), r.label]);
    default: return [];
  }
}
