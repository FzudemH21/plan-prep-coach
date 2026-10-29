/**
 * parameterMeasures — the measures of a parameter (what is recorded for it: time, pain, quality …).
 *
 * A parameter without `measures` has ONE main measure: a number in its `unit`. Values, goals and
 * monitoring blocks without a measure id belong to the main measure, so older data needs no
 * conversion. The main measure's unit always comes from the parameter's `unit` (the field every
 * older place reads), never from a copy that could drift apart.
 */
import { MAIN_MEASURE_ID, type MeasureKind, type ParameterMeasure, type ParameterV2 } from '@/types/parametersV2';

export const MEASURE_KIND_LABELS: Record<MeasureKind, string> = {
  number: 'Number',
  scale: 'Scale',
  levels: 'Levels',
  passFail: 'Pass / fail',
};

/** Ready-made scales */
export const SCALE_PRESETS: Array<{ id: string; label: string; measure: Omit<ParameterMeasure, 'id'> }> = [
  {
    id: 'pain', label: 'Pain NRS 0–10',
    measure: { name: 'Pain', kind: 'scale', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'no pain', scaleMaxLabel: 'worst imaginable pain', betterWhen: 'lower' },
  },
  {
    id: 'effort', label: 'Effort (Borg CR10)',
    measure: { name: 'Effort', kind: 'scale', scaleMin: 0, scaleMax: 10, scaleMinLabel: 'rest', scaleMaxLabel: 'maximal', betterWhen: 'lower' },
  },
];

/** The main measure as stored, or built from the parameter's unit */
function defaultMainMeasure(p: Pick<ParameterV2, 'unit'>): ParameterMeasure {
  return { id: MAIN_MEASURE_ID, name: 'Value', kind: 'number', unit: p.unit };
}

/** All measures of a parameter, the main measure first (its unit = the parameter's unit) */
export function parameterMeasures(p: Pick<ParameterV2, 'unit' | 'measures'>): ParameterMeasure[] {
  const stored = (p.measures ?? []).filter((m) => m && m.id && m.kind);
  const main = stored.find((m) => m.id === MAIN_MEASURE_ID) ?? defaultMainMeasure(p);
  const mainResolved: ParameterMeasure = main.kind === 'number' ? { ...main, unit: p.unit } : main;
  return [mainResolved, ...stored.filter((m) => m.id !== MAIN_MEASURE_ID)];
}

export function mainMeasure(p: Pick<ParameterV2, 'unit' | 'measures'>): ParameterMeasure {
  return parameterMeasures(p)[0];
}

/** A measure by id — unset id = the main measure (older values / goals) */
export function measureById(p: Pick<ParameterV2, 'unit' | 'measures'>, id: string | undefined): ParameterMeasure | undefined {
  const all = parameterMeasures(p);
  return id ? all.find((m) => m.id === id) : all[0];
}

/** Whether the parameter has more than the plain main measure (then the measure name is shown) */
export function hasCustomMeasures(p: Pick<ParameterV2, 'unit' | 'measures'>): boolean {
  return parameterMeasures(p).length > 1;
}

/** "30 m Sprint · Pain" — just the parameter name while it has only its main measure */
export function measureLabel(p: Pick<ParameterV2, 'name' | 'unit' | 'measures'>, measureId?: string): string {
  const m = measureById(p, measureId);
  if (!m || !hasCustomMeasures(p)) return p.name;
  return `${p.name} · ${m.name}`;
}

/** Short description of a measure: "s, lower is better", "0–10", "3 levels", "pass / fail" */
export function measureSummary(m: ParameterMeasure): string {
  switch (m.kind) {
    case 'number': return [m.unit, m.betterWhen ? `${m.betterWhen} is better` : ''].filter(Boolean).join(', ') || 'number';
    case 'scale': return `${m.scaleMin ?? 0}–${m.scaleMax ?? 10}${m.betterWhen ? `, ${m.betterWhen} is better` : ''}`;
    case 'levels': return `${(m.levels ?? []).length} levels`;
    case 'passFail': return 'pass / fail';
  }
}

/**
 * Limb symmetry index in % — the smaller side ÷ the larger side × 100 (works for "higher is better",
 * e.g. hop distance, and for "lower is better", e.g. time: the faster side is the smaller value).
 * null when a side is missing or not a positive number.
 */
export function limbSymmetryIndex(left: number | string | undefined, right: number | string | undefined): number | null {
  const l = typeof left === 'string' ? Number(left.replace(',', '.')) : left;
  const r = typeof right === 'string' ? Number(right.replace(',', '.')) : right;
  if (l === undefined || r === undefined || !Number.isFinite(l) || !Number.isFinite(r) || l <= 0 || r <= 0) return null;
  return Math.round((Math.min(l, r) / Math.max(l, r)) * 1000) / 10;
}

/** The measures to store: unset while the parameter has only its plain main measure (nothing to keep) */
export function measuresToStore(measures: ParameterMeasure[]): ParameterMeasure[] | undefined {
  const [main, ...rest] = measures;
  const plainMain = !main || (main.kind === 'number' && main.name === 'Value' && !main.betterWhen);
  if (rest.length === 0 && plainMain) return undefined;
  // The main measure's unit lives on the parameter (`unit`) — not stored twice
  return measures.map((m) => (m.id === MAIN_MEASURE_ID ? { ...m, unit: undefined } : m));
}

/**
 * Whether a method link / interaction applies to a measure: without a scope it applies to all measures
 * of the parameter; with a scope only to the measures listed. No measure given = the main measure.
 * Scoped ids of measures that were removed are ignored (an empty scope then means all again).
 */
export function appliesToMeasure(
  link: { measureIds?: string[] }, measureId: string | undefined, target?: Pick<ParameterV2, 'unit' | 'measures'>,
): boolean {
  const ids = (link.measureIds ?? []).filter((id) => !target || parameterMeasures(target).some((m) => m.id === id));
  if (ids.length === 0) return true;
  return ids.includes(measureId ?? MAIN_MEASURE_ID);
}

/** "Time, Pain" — the measures a link is scoped to (empty = all measures) */
export function scopeLabel(link: { measureIds?: string[] }, target: Pick<ParameterV2, 'unit' | 'measures'>): string {
  const names = parameterMeasures(target).filter((m) => link.measureIds?.includes(m.id)).map((m) => m.name);
  return names.length ? names.join(', ') : 'all measures';
}

// ── Stored values of a measure ──
// Results / monitoring values are stored per parameter id (athlete_test_results.parameter_id, text).
// A value of another measure than the main one (or of a side) is stored under a reference that
// extends the id: "<parameter>::m:<measure>" / "…::s:L". Every place that reads by the exact
// parameter id therefore keeps seeing only the main measure's values — nothing gets mixed.

/** The stored reference of a measure's (and side's) values — the main measure keeps the plain id */
export function measureRef(parameterId: string, measureId?: string, side?: 'L' | 'R'): string {
  return parameterId
    + (measureId && measureId !== MAIN_MEASURE_ID ? `::m:${measureId}` : '')
    + (side ? `::s:${side}` : '');
}

/** "<parameter>::m:pain::s:L" → its parts (a plain id → the main measure) */
export function parseMeasureRef(ref: string): { parameterId: string; measureId?: string; side?: 'L' | 'R' } {
  const [parameterId, ...rest] = ref.split('::');
  const out: { parameterId: string; measureId?: string; side?: 'L' | 'R' } = { parameterId };
  for (const part of rest) {
    if (part.startsWith('m:')) out.measureId = part.slice(2);
    else if (part === 's:L' || part === 's:R') out.side = part.slice(2) as 'L' | 'R';
  }
  return out;
}

/** The stored reference of a monitoring block's values */
export function metricRefOf(cfg: { parameterId: string; measureId?: string }): string {
  return measureRef(cfg.parameterId, cfg.measureId);
}

/** A test of a measure / side in the athlete app: how to ask the value (stored with the test entry) */
export interface TestMeasureSpec {
  name: string;
  kind: MeasureKind;
  unit?: string;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  levels?: string[];
  side?: 'L' | 'R';
}

/** The spec for a test reference ("<id>::m:pain::s:L") — undefined for a plain number test */
export function testMeasureSpec(param: Pick<ParameterV2, 'unit' | 'measures'>, ref: string): TestMeasureSpec | undefined {
  const parsed = parseMeasureRef(ref);
  const m = measureById(param, parsed.measureId);
  if (!m) return undefined;
  if (m.kind === 'number' && !parsed.side && !parsed.measureId) return undefined;
  return {
    name: m.name, kind: m.kind, unit: m.kind === 'number' ? m.unit : undefined,
    scaleMin: m.scaleMin, scaleMax: m.scaleMax, scaleMinLabel: m.scaleMinLabel, scaleMaxLabel: m.scaleMaxLabel,
    levels: m.levels, side: parsed.side,
  };
}

export function newMeasureId(): string {
  return `m_${Math.random().toString(36).slice(2, 9)}`;
}
