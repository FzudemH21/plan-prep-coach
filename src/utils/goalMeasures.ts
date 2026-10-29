/**
 * goalMeasures — SMART goals per parameter MEASURE (2026-10-28, stage 2 of the measures concept).
 *
 * A goal is linked to a parameter (linkedParameterId) and — new — to one of its measures (measureId,
 * unset = the main measure) and, for parameters recorded per side, to a side / the weaker side / the
 * LSI. Several goals can share one parameter (e.g. "30 m Sprint · Pain: pain-free" for the first
 * phases and "30 m Sprint · Time: 4.3 s" for the last one); step 1 shows them under the parameter.
 *
 * Values stay numbers in baselineValue / desiredValue so every older place keeps working:
 *   number / LSI → the value · scale → the scale value · levels → the level's index (0 = worst) ·
 *   pass / fail → 0 = not passed, 1 = passed. `formatGoalValue` shows them properly.
 */
import type { ParameterValue } from '@/types/athlete';
import type { GoalSide, SmartGoal } from '@/types/training';
import { MAIN_MEASURE_ID, type ParameterMeasure, type ParameterV2 } from '@/types/parametersV2';
import { latestNumericValue, parseMeasuredNumber } from '@/utils/latestParameterValue';
import { hasCustomMeasures, limbSymmetryIndex, measureById, parameterMeasures } from '@/utils/parameterMeasures';

export const GOAL_SIDE_LABELS: Record<GoalSide, string> = {
  L: 'Left', R: 'Right', both: 'Both sides', weaker: 'Weaker side', lsi: 'LSI',
};

type GoalRef = Pick<SmartGoal, 'measureId' | 'side'>;
/** A recorded value — only what the goal logic needs */
export type MeasuredValue = Pick<ParameterValue, 'value' | 'recordedAt' | 'measureId' | 'side'>;

/** The values of one measure (older values without a measure id belong to the main measure) */
export function valuesOfMeasure<V extends MeasuredValue>(values: V[], measureId: string | undefined, side?: 'L' | 'R'): V[] {
  const id = measureId ?? MAIN_MEASURE_ID;
  return values.filter((v) => (v.measureId ?? MAIN_MEASURE_ID) === id && (side ? v.side === side : true));
}

/** The main series of a parameter: main measure, no side (what readers without measures show) */
export function mainSeries<V extends MeasuredValue>(values: V[]): V[] {
  return values.filter((v) => (v.measureId ?? MAIN_MEASURE_ID) === MAIN_MEASURE_ID && !v.side);
}

/** Every value of an athlete's parameter, incl. other measures and sides */
export function allValuesOf<V extends MeasuredValue>(pp: { values: V[]; allValues?: V[] }): V[] {
  return pp.allValues ?? pp.values;
}

/** Values grouped per series (measure + side), the main series first; label e.g. "Pain · Left" */
export function seriesOfValues<V extends MeasuredValue>(param: ParameterV2 | undefined, values: V[]): Array<{ measureId?: string; side?: 'L' | 'R'; label: string; unit: string; values: V[] }> {
  const groups = new Map<string, { measureId?: string; side?: 'L' | 'R'; values: V[] }>();
  for (const v of values) {
    const measureId = v.measureId && v.measureId !== MAIN_MEASURE_ID ? v.measureId : undefined;
    const key = `${measureId ?? ''}|${v.side ?? ''}`;
    const g = groups.get(key) ?? { measureId, side: v.side, values: [] };
    g.values.push(v);
    groups.set(key, g);
  }
  const measures = param ? parameterMeasures(param) : [];
  const order = (g: { measureId?: string; side?: 'L' | 'R' }) =>
    Math.max(0, measures.findIndex((m) => m.id === (g.measureId ?? MAIN_MEASURE_ID))) * 3 + (g.side === 'L' ? 1 : g.side === 'R' ? 2 : 0);
  return [...groups.values()].sort((a, b) => order(a) - order(b)).map((g) => {
    const measure = param ? measureById(param, g.measureId) : undefined;
    const label = [
      g.measureId ? (measure?.name ?? g.measureId) : '',
      g.side === 'L' ? 'Left' : g.side === 'R' ? 'Right' : '',
    ].filter(Boolean).join(' · ');
    return { ...g, label, unit: goalUnit(measure, undefined, param?.unit ?? ''), values: g.values };
  });
}

function latestOf<V extends MeasuredValue>(values: V[]): V | undefined {
  return [...values].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}

/** A stored value as the goal's number: level → index, pass / fail → 0 / 1, else the number */
export function goalNumberOf(measure: ParameterMeasure | undefined, raw: string | undefined): number | null {
  if (raw === undefined || raw === null || `${raw}`.trim() === '') return null;
  if (measure?.kind === 'levels') {
    const i = (measure.levels ?? []).findIndex((l) => l.trim().toLowerCase() === raw.trim().toLowerCase());
    return i >= 0 ? i : null;
  }
  if (measure?.kind === 'passFail') return /^(pass|passed|yes|ja|true|1|bestanden)$/i.test(raw.trim()) ? 1 : 0;
  return parseMeasuredNumber(raw);
}

/**
 * The athlete's current value for a goal (its baseline): latest value of that measure; per side the
 * side, the weaker side ("both" also takes the weaker one) or the LSI of the latest left / right values.
 */
export function goalBaseline(goal: GoalRef, param: ParameterV2 | undefined, values: MeasuredValue[]): number | null {
  if (!param) return latestNumericValue(values);
  const measure = measureById(param, goal.measureId);
  if (!measure) return null;
  const side = goal.side;
  if (!param.perSide || !side) {
    const own = valuesOfMeasure(values, measure.id);
    return goalNumberOf(measure, latestOf(own)?.value);
  }
  if (side === 'L' || side === 'R') return goalNumberOf(measure, latestOf(valuesOfMeasure(values, measure.id, side))?.value);
  const left = goalNumberOf(measure, latestOf(valuesOfMeasure(values, measure.id, 'L'))?.value);
  const right = goalNumberOf(measure, latestOf(valuesOfMeasure(values, measure.id, 'R'))?.value);
  if (side === 'lsi') return left !== null && right !== null ? limbSymmetryIndex(left, right) : null;
  if (left === null || right === null) return left ?? right;
  // Weaker side: depends on which direction is better (default: higher is better)
  return measure.betterWhen === 'lower' ? Math.max(left, right) : Math.min(left, right);
}

/** Unit of a goal's values: % for the LSI, "/10" for a scale, the unit for a number, none otherwise */
export function goalUnit(measure: ParameterMeasure | undefined, side: GoalSide | undefined, fallback = ''): string {
  if (side === 'lsi') return '%';
  if (!measure) return fallback;
  if (measure.kind === 'number') return measure.unit ?? fallback;
  if (measure.kind === 'scale') return `/${measure.scaleMax ?? 10}`;
  return '';
}

/** A goal value as text: "4.3 s", "2/10", "Clean", "passed", "92 % LSI" */
export function formatGoalValue(goal: Pick<SmartGoal, 'measureId' | 'side' | 'unit'>, value: number | null | undefined, param?: ParameterV2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const measure = param ? measureById(param, goal.measureId) : undefined;
  if (goal.side === 'lsi') return `${value} % LSI`;
  switch (measure?.kind) {
    case 'scale': return `${value}/${measure.scaleMax ?? 10}`;
    case 'levels': return measure.levels?.[value] ?? `level ${value + 1}`;
    case 'passFail': return value >= 1 ? 'passed' : 'not passed';
    default: return `${value}${goal.unit ? ` ${goal.unit}` : ''}`;
  }
}

/** "5/10 → ≤ 0/10", "4.6 s → 4.3 s", "Guarded → Clean" */
export function formatGoalRange(goal: SmartGoal, param?: ParameterV2): string {
  const measure = param ? measureById(param, goal.measureId) : undefined;
  const target = formatGoalValue(goal, goal.desiredValue, param);
  const prefix = measure?.kind === 'scale' ? (measure.betterWhen === 'higher' ? '≥ ' : '≤ ') : '';
  if (measure?.kind === 'passFail') return target;
  return `${formatGoalValue(goal, goal.baselineValue, param)} → ${prefix}${target}`;
}

/** Whether the goal's change is shown in % (numbers and LSI, not scales / levels / pass-fail) */
export function goalShowsPercent(goal: GoalRef, param?: ParameterV2): boolean {
  if (goal.side === 'lsi') return true;
  const measure = param ? measureById(param, goal.measureId) : undefined;
  return !measure || measure.kind === 'number';
}

/** "Pain", "Time · Right", "Distance · LSI" — the measure part of a goal ('' for a plain parameter) */
export function goalMeasurePart(goal: GoalRef, param?: ParameterV2): string {
  if (!param) return '';
  const measure = measureById(param, goal.measureId);
  const parts = [hasCustomMeasures(param) ? measure?.name : '', goal.side ? GOAL_SIDE_LABELS[goal.side] : ''].filter(Boolean);
  return parts.join(' · ');
}

/** The goal's name as stored in `description` — "30 m Sprint · Pain", "Single-leg hop · LSI" */
export function goalDescription(param: ParameterV2, goal: GoalRef): string {
  const part = goalMeasurePart(goal, param);
  return part ? `${param.name} · ${part}` : param.name;
}

/** "DB RFESS 3RM - Right" → 'R' */
function sideInName(name: string): 'L' | 'R' | undefined {
  const m = name.match(/\b(left|right)\b/i);
  return m ? (m[1].toLowerCase() === 'left' ? 'L' : 'R') : undefined;
}

/** "DB RFESS 3RM - Right" → "DB RFESS 3RM", "Single-Leg CMJ Height - Left (Hands on Hips)" → "Single-Leg CMJ Height (Hands on Hips)" */
function withoutSideInName(name: string): string {
  return name.replace(/\s*[-–]\s*(left|right)\b/i, '').replace(/\b(left|right)\b\s*/i, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * A goal whose left / right parameter was merged into one parameter recorded per side (2026-10-29):
 * the side comes from the goal's old name ("… - Right"), and a goal of the removed parameter moves to
 * the parameter now named like it without the side. Other goals stay as they are.
 */
export function relinkMergedSideGoal<G extends SmartGoal>(goal: G, parameters: ParameterV2[]): G {
  if (!goal.linkedParameterId || goal.side) return goal;
  const side = sideInName(goal.description);
  if (!side) return goal;
  const own = parameters.find((p) => p.id === goal.linkedParameterId);
  const param = own ?? parameters.find((p) => p.name.trim().toLowerCase() === withoutSideInName(goal.description).toLowerCase());
  if (!param?.perSide) return goal;
  const next = { ...goal, linkedParameterId: param.id, side };
  return { ...next, description: goalDescription(param, next) };
}

/** Goals grouped by their parameter (in order of first appearance); goals without one stay alone */
export function groupGoalsByParameter<G extends Pick<SmartGoal, 'id' | 'linkedParameterId'>>(goals: G[]): Array<{ key: string; parameterId?: string; goals: G[] }> {
  const groups: Array<{ key: string; parameterId?: string; goals: G[] }> = [];
  for (const g of goals) {
    const existing = g.linkedParameterId ? groups.find((x) => x.parameterId === g.linkedParameterId) : undefined;
    if (existing) existing.goals.push(g);
    else groups.push({ key: g.linkedParameterId ?? g.id, parameterId: g.linkedParameterId, goals: [g] });
  }
  return groups;
}
