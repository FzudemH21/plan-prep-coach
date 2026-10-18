/**
 * anamnesisAnswers — reading, writing and showing anamnesis answers of every question type, and the
 * "show only if" conditions. Answers are stored as text per question (field_values); the structured
 * types keep JSON in that text:
 *   multiselect  ["Option A","Option B"]
 *   yesnoList    {"Item text":"yes","Other item":"no"}
 *   list         [{"colId":"value",…},…]
 *   bodyMap      [{"id":"…","view":"front","x":96.5,"y":140.2,"region":"16-L-F","note":"…","nrs":6},…]
 *   weekGrid     {"v":1,"cells":{"0-17":"a","0-18":"t"}}  (day 0 = Monday, hour 5–22, a/t/o)
 * Unreadable JSON (e.g. a question whose type was changed) falls back to the plain text.
 */
import type {
  AnamnesisCondition, AnamnesisField, AnamnesisSection,
} from '@/types/anamnesis';
import { PROFILE_SEX_SOURCE } from '@/types/anamnesis';
import { BODY_REGIONS, getRegionKeyLabel } from '@/lib/bodyMapData';

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

export type YesNoAnswers = Record<string, 'yes' | 'no'>;
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
}
export function parseBodyMap(value: string | undefined): BodyMapSpot[] {
  return parseJson<BodyMapSpot[]>(value, v => Array.isArray(v))
    ?.filter(s => s && (s.view === 'front' || s.view === 'back') && Number.isFinite(s.x) && Number.isFinite(s.y)) ?? [];
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
    case 'yesnoList': return Object.keys(parseYesNoList(value)).length > 0;
    case 'list': return parseList(value).some(r => Object.values(r).some(v => v?.trim()));
    case 'bodyMap': return parseBodyMap(value).length > 0;
    case 'weekGrid': return Object.keys(parseWeekGrid(value).cells).length > 0;
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

/** Plain-text answer — for the change history, the AI, the PDF and read-only fallbacks */
export function formatAnswer(field: AnamnesisField, value: string | undefined, lang: AnswerLang = 'en'): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  const yes = lang === 'de' ? 'Ja' : 'Yes';
  const no = lang === 'de' ? 'Nein' : 'No';
  switch (field.fieldType) {
    case 'boolean': return v === 'true' ? yes : v === 'false' ? no : v;
    case 'multiselect': { const m = parseMulti(v); return m.length ? m.join(', ') : v; }
    case 'scale': return `${v} / ${field.scaleMax ?? 10}`;
    case 'date': return formatDate(v, lang);
    case 'yesnoList': {
      const a = parseYesNoList(v);
      const items = field.options ?? Object.keys(a);
      return items.filter(i => a[i]).map(i => `${i}: ${a[i] === 'yes' ? yes : no}`).join('\n');
    }
    case 'list': {
      const cols = field.listColumns ?? [];
      return parseList(v)
        .filter(r => Object.values(r).some(x => x?.trim()))
        .map(r => cols.length
          ? cols.filter(c => r[c.id]?.trim()).map(c => `${c.label}: ${c.type === 'date' ? formatDate(r[c.id], lang) : r[c.id]}`).join(', ')
          : Object.values(r).join(', '))
        .map(line => `- ${line}`)
        .join('\n');
    }
    case 'bodyMap': {
      const spots = parseBodyMap(v);
      if (spots.length === 0) return v === '[]' ? '' : v;
      const side = lang === 'de' ? { front: 'vorne', back: 'hinten' } : { front: 'front', back: 'back' };
      return spots.map((s, i) => `${i + 1}. ${regionLabel(s.region, lang)} (${side[s.view]})`
        + (s.nrs !== undefined ? ` – ${lang === 'de' ? 'Schmerz' : 'pain'} ${s.nrs}/10` : '')
        + (s.note.trim() ? `: ${s.note.trim()}` : '')).join('\n');
    }
    case 'weekGrid': return weekGridLines(parseWeekGrid(v), lang).join('\n');
    case 'info': return '';
    default: return v;
  }
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
    case 'bodyMap': picked = parseBodyMap(value).map(s => regionAreaId(s.region)); break;
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
  const shown = condition.values.map(v => {
    if (source.fieldType === 'boolean') return v === 'true' ? (lang === 'de' ? 'Ja' : 'Yes') : (lang === 'de' ? 'Nein' : 'No');
    if (source.fieldType === 'bodyMap') return areaLabel(v, lang);
    return v;
  });
  return `${source.label} = ${shown.join(lang === 'de' ? ' oder ' : ' or ')}`;
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
