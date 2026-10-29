/**
 * Merging a parameter into another one as one of its measures (stage 5 of the parameter measures
 * concept) — e.g. "30 m Sprint Pain" becomes the measure "Pain" of "30 m Sprint".
 *
 * Pure functions, one per store; useParameterMerge applies them to the stores. Everything that
 * points at the merged parameter is moved over: its values (with the measure), its references
 * ("<id>::s:L" → "<target>::m:<measure>::s:L"), goals, interactions and method links (scoped to
 * the measure). Only a parameter with nothing but its main measure can be merged.
 *
 * Sides: "SL Hop RSI - Right" can become the right side of "SL Hop RSI - Left" (`side`); a plan with
 * `markTarget` (source = target) first marks the target's own values, tests and goals without a side
 * as the other side. Several plans are applied in order (applyPlans).
 *
 * LSI parameters (`lsiGoals`): "SL CMJ LSI" goes into "Single-Leg CMJ Height" — its entered values become
 * the measure "LSI (entered)", its goals become LSI goals (main measure, side 'lsi', calculated from left /
 * right). `convertSelf` (source = target): "SL Heel Raise LSI" itself becomes "SL Heel Raise", recorded per
 * side in `mainUnit`; its own values so far become the measure "LSI (entered)".
 */
import type { AthleteCalendarAssignment, AthletePerformanceParameter, MonitoringConfig, ParameterValue } from '@/types/athlete';
import type { SmartGoal, SubGoal } from '@/types/training';
import {
  MAIN_MEASURE_ID,
  type ParameterInteraction,
  type ParameterMeasure,
  type ParameterMethodV2,
  type ParametersDatabaseV2,
  type ParameterV2,
} from '@/types/parametersV2';
import { hasCustomMeasures, measureRef, measuresToStore, metricRefOf, parameterMeasures, parseMeasureRef } from '@/utils/parameterMeasures';
import { toParameterId } from '@/utils/parameterRef';

export interface ParameterMergePlan {
  sourceId: string;
  targetId: string;
  /** The target's measure the source's values become: an existing one (incl. the main one) or `newMeasure` */
  measureId: string;
  /** A measure added to the target for the source's values */
  newMeasure?: ParameterMeasure;
  /** The source's values are this side of the target (the target is then recorded per side) */
  side?: 'L' | 'R';
  /** Source = target: its values / tests / goals without a side become `side` (nothing is removed) */
  markTarget?: boolean;
  /** New name of the target */
  renameTarget?: string;
  /** The target is recorded per side from now on */
  perSide?: boolean;
  /** The source is an LSI parameter: its goals become the target's LSI goals (main measure, side 'lsi') */
  lsiGoals?: boolean;
  /** Name of the target after the merge (for the goals' names) */
  targetName?: string;
  /** Source = target: the parameter itself is renamed, recorded per side in `mainUnit`; its own values,
   *  tests and blocks of the main measure become `measureId` */
  convertSelf?: { name: string; mainUnit: string };
}

/** A store value through several plans in order */
export function applyPlans<T>(value: T, plans: ParameterMergePlan[], apply: (value: T, plan: ParameterMergePlan) => T): T {
  return plans.reduce(apply, value);
}

/** Why a parameter can't be merged into another one (null = it can) */
export function mergeBlocker(source: ParameterV2 | undefined, target: ParameterV2 | undefined): string | null {
  if (!source || !target) return 'Parameter not found.';
  if (source.id === target.id) return 'A parameter cannot be merged into itself.';
  if (hasCustomMeasures(source)) return `"${source.name}" has measures of its own — only a parameter with a single measure can be merged.`;
  return null;
}

/** The measure id stored on values / goals / links ("main" is never stored) */
const storedMeasureId = (plan: ParameterMergePlan) => (plan.measureId === MAIN_MEASURE_ID ? undefined : plan.measureId);

/** A reference to the source ("<id>", "<id>::s:L", old "bio:<id>") → the same reference to the target's measure; null = not the source */
export function remapParameterRef(ref: string | null | undefined, plan: ParameterMergePlan): string | null {
  if (!ref) return null;
  const parsed = parseMeasureRef(ref);
  if (toParameterId(parsed.parameterId) !== plan.sourceId) return null;
  if (plan.markTarget) return parsed.side ? null : measureRef(plan.targetId, parsed.measureId, plan.side);
  if (plan.convertSelf) return parsed.side || (parsed.measureId && parsed.measureId !== MAIN_MEASURE_ID) ? null : measureRef(plan.targetId, storedMeasureId(plan));
  return measureRef(plan.targetId, storedMeasureId(plan), plan.side ?? parsed.side);
}

/** A reference through several plans; null = unchanged */
export function remapThroughPlans(ref: string, plans: ParameterMergePlan[]): string | null {
  const out = applyPlans(ref, plans, (r, plan) => remapParameterRef(r, plan) ?? r);
  return out === ref ? null : out;
}

// ── Parameter database ──────────────────────────────────────────────────────

/** A copy without its measure scope / measure id */
function withoutScope<T extends { measureIds?: string[] }>(x: T): T {
  const copy = { ...x };
  delete copy.measureIds;
  return copy;
}
function withoutMeasure<T extends { measureId?: string }>(x: T): T {
  const copy = { ...x };
  delete copy.measureId;
  return copy;
}

/** Scopes merged into one: unset (= all measures) wins */
function unionScope(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
  if (!a?.length || !b?.length) return undefined;
  return [...new Set([...a, ...b])];
}

export function mergeParameterDatabase(db: ParametersDatabaseV2, plan: ParameterMergePlan): ParametersDatabaseV2 {
  const source = db.parameters.find((p) => p.id === plan.sourceId);
  const target = db.parameters.find((p) => p.id === plan.targetId);
  if (plan.markTarget) {
    // Only the target changes: recorded per side (and renamed)
    if (!target || plan.sourceId !== plan.targetId || !plan.side) throw new Error('Parameter not found.');
    return {
      ...db,
      parameters: db.parameters.map((p) => (p.id === target.id
        ? { ...p, perSide: true, ...(plan.renameTarget?.trim() ? { name: plan.renameTarget.trim() } : {}) }
        : p)),
    };
  }
  if (plan.convertSelf) {
    if (!target || plan.sourceId !== plan.targetId || !plan.newMeasure) throw new Error('Parameter not found.');
    const measures = [...parameterMeasures(target), plan.newMeasure];
    return {
      ...db,
      parameters: db.parameters.map((p) => (p.id === target.id
        ? { ...p, name: plan.convertSelf!.name, unit: plan.convertSelf!.mainUnit, measures: measuresToStore(measures), perSide: true }
        : p)),
    };
  }
  const blocker = mergeBlocker(source, target);
  if (blocker) throw new Error(blocker);
  // LSI goals are about the whole parameter: links of an LSI parameter are not scoped to "LSI (entered)"
  const scope = plan.lsiGoals ? undefined : [plan.measureId];

  // The target gets the new measure; recorded per side when either was
  const measures = plan.newMeasure ? [...parameterMeasures(target!), plan.newMeasure] : parameterMeasures(target!);
  const mergedTarget: ParameterV2 = {
    ...target!,
    measures: measuresToStore(measures),
    ...(source!.perSide || target!.perSide || plan.side || plan.perSide ? { perSide: true } : {}),
    ...(plan.renameTarget?.trim() ? { name: plan.renameTarget.trim() } : {}),
    mergedParameters: [...(target!.mergedParameters ?? []), { id: source!.id, name: source!.name, ...(plan.lsiGoals ? { asLsi: true } : {}) }],
  };

  // Interactions: the source's become the target's (as target: scoped to the measure); self-links go
  const moved: ParameterInteraction[] = [];
  for (const i of db.interactions) {
    const fromSource = i.sourceParameterId === plan.sourceId;
    const toSource = i.targetParameterId === plan.sourceId;
    if (!fromSource && !toSource) { moved.push(i); continue; }
    const next: ParameterInteraction = {
      ...i,
      sourceParameterId: fromSource ? plan.targetId : i.sourceParameterId,
      targetParameterId: toSource ? plan.targetId : i.targetParameterId,
      ...(toSource && scope ? { measureIds: scope } : {}),
    };
    if (next.sourceParameterId === next.targetParameterId) continue;
    moved.push(next);
  }
  // One interaction per pair and direction (scopes merged)
  const interactions: ParameterInteraction[] = [];
  for (const i of moved) {
    const idx = interactions.findIndex((x) => x.sourceParameterId === i.sourceParameterId && x.targetParameterId === i.targetParameterId && x.direction === i.direction);
    if (idx < 0) { interactions.push(i); continue; }
    const twin = interactions[idx];
    const measureIds = unionScope(twin.measureIds, i.measureIds);
    interactions[idx] = { ...withoutScope(twin), strength: twin.strength ?? i.strength, ...(measureIds ? { measureIds } : {}) };
  }

  // Method links: the source's become the target's, scoped to the measure; one link per method
  const parameterMethods: ParameterMethodV2[] = db.parameterMethods.filter((m) => m.parameterId !== plan.sourceId);
  for (const m of db.parameterMethods.filter((x) => x.parameterId === plan.sourceId)) {
    const twinIdx = parameterMethods.findIndex((x) => x.parameterId === plan.targetId && x.methodId === m.methodId);
    if (twinIdx < 0) { parameterMethods.push({ ...withoutScope(m), parameterId: plan.targetId, ...(scope ? { measureIds: scope } : {}) }); continue; }
    const twin = parameterMethods[twinIdx];
    const measureIds = unionScope(twin.measureIds, scope);
    parameterMethods[twinIdx] = {
      ...withoutScope(twin),
      rationale: twin.rationale || m.rationale,
      evidence: twin.evidence || m.evidence,
      evidenceQuality: twin.evidenceQuality || m.evidenceQuality,
      ...(measureIds ? { measureIds } : {}),
    };
  }

  return {
    ...db,
    parameters: db.parameters.filter((p) => p.id !== plan.sourceId).map((p) => (p.id === plan.targetId ? mergedTarget : p)),
    interactions,
    parameterMethods,
  };
}

// ── Athlete database ────────────────────────────────────────────────────────

/** A source value as a value of the target's measure (side kept) */
function movedValue(v: ParameterValue, plan: ParameterMergePlan): ParameterValue {
  const measureId = storedMeasureId(plan);
  return { ...withoutMeasure(v), ...(measureId ? { measureId } : {}), ...(plan.side ? { side: plan.side } : {}) };
}

/** Each athlete's values of the source move to the target (created where the athlete has none) */
export function mergeAthleteParameters(
  list: AthletePerformanceParameter[],
  plan: ParameterMergePlan,
  newId: () => string,
): AthletePerformanceParameter[] {
  if (plan.markTarget) {
    return list.map((pp) => (pp.athleticismParameterId === plan.targetId && pp.values.some((v) => !v.side)
      ? { ...pp, values: pp.values.map((v) => (v.side ? v : { ...v, side: plan.side })) }
      : pp));
  }
  if (plan.convertSelf) {
    const isOwnMain = (v: ParameterValue) => !v.side && (v.measureId ?? MAIN_MEASURE_ID) === MAIN_MEASURE_ID;
    return list.map((pp) => (pp.athleticismParameterId === plan.targetId && pp.values.some(isOwnMain)
      ? { ...pp, values: pp.values.map((v) => (isOwnMain(v) ? { ...v, measureId: plan.measureId } : v)) }
      : pp));
  }
  const sources = list.filter((pp) => pp.athleticismParameterId === plan.sourceId);
  if (sources.length === 0) return list;
  let next = list.filter((pp) => pp.athleticismParameterId !== plan.sourceId);
  for (const src of sources) {
    const values = src.values.map((v) => movedValue(v, plan));
    const target = next.find((pp) => pp.athleteId === src.athleteId && pp.athleticismParameterId === plan.targetId);
    if (target) {
      const ids = new Set(target.values.map((v) => v.id));
      next = next.map((pp) => (pp === target ? { ...pp, values: [...pp.values, ...values.filter((v) => !ids.has(v.id))] } : pp));
    } else {
      next = [...next, { id: newId(), athleteId: src.athleteId, athleticismParameterId: plan.targetId, values }];
    }
  }
  return next;
}

/** Goals of assigned programs (the athlete's tests) */
export function mergeAssignmentGoals(list: AthleteCalendarAssignment[], plan: ParameterMergePlan): AthleteCalendarAssignment[] {
  return list.map((a) => {
    if (!a.reviewedSubGoals?.some((g) => g.parameterLinkedId && toParameterId(g.parameterLinkedId) === plan.sourceId)) return a;
    return {
      ...a,
      reviewedSubGoals: a.reviewedSubGoals.map((g) => {
        if (!g.parameterLinkedId || toParameterId(g.parameterLinkedId) !== plan.sourceId) return g;
        if (plan.markTarget) return g.side ? g : { ...g, side: plan.side };
        const measureId = storedMeasureId(plan);
        if (plan.convertSelf) return g.side || (g.measureId && g.measureId !== MAIN_MEASURE_ID) ? g : { ...g, measureId };
        return { ...withoutMeasure(g), parameterLinkedId: plan.targetId, ...(measureId ? { measureId } : {}), ...(plan.side ? { side: plan.side } : {}) };
      }),
    };
  });
}

// ── Programs ────────────────────────────────────────────────────────────────

/** Goals and sub-goals of a plan linked to the source → the target's measure (sides kept) */
export function mergePlanGoals<T extends { smartGoals?: SmartGoal[]; subGoals?: SubGoal[] }>(macro: T, plan: ParameterMergePlan): { macro: T; changed: boolean } {
  let changed = false;
  const measureId = storedMeasureId(plan);
  const smartGoals = macro.smartGoals?.map((g) => {
    if (!g.linkedParameterId || toParameterId(g.linkedParameterId) !== plan.sourceId) return g;
    if (plan.markTarget) {
      if (g.side) return g;
      changed = true;
      return { ...g, side: plan.side };
    }
    // An LSI parameter's goals: LSI goals of the target (calculated from left / right)
    if (plan.lsiGoals || plan.convertSelf) {
      if (plan.convertSelf && g.side) return g;
      changed = true;
      const name = plan.convertSelf?.name ?? plan.targetName;
      return { ...withoutMeasure(g), linkedParameterId: plan.targetId, side: 'lsi' as const, ...(name ? { description: `${name} · LSI` } : {}) };
    }
    changed = true;
    return { ...withoutMeasure(g), linkedParameterId: plan.targetId, ...(measureId ? { measureId } : {}), ...(plan.side ? { side: plan.side } : {}) };
  });
  // (sub-goals have no side: a marked target's sub-goals stay as they are)
  const subGoals = macro.subGoals?.map((g) => {
    if (plan.markTarget || !g.parameterLinkedId || toParameterId(g.parameterLinkedId) !== plan.sourceId) return g;
    if (plan.convertSelf && g.measureId && g.measureId !== MAIN_MEASURE_ID) return g;
    changed = true;
    return { ...withoutMeasure(g), parameterLinkedId: plan.targetId, ...(measureId ? { measureId } : {}) };
  });
  if (!changed) return { macro, changed };
  return { macro: { ...macro, ...(smartGoals ? { smartGoals } : {}), ...(subGoals ? { subGoals } : {}) }, changed };
}

// ── Monitoring ──────────────────────────────────────────────────────────────

/**
 * Monitoring blocks of the source → the target's measure. The athletes' check-in values stay where
 * they are (the coach can't rewrite check-ins): the block keeps reading and writing them under the
 * old reference (`storageRef`), so the history continues.
 */
export function mergeMonitoringConfig(config: MonitoringConfig, plan: ParameterMergePlan, target: ParameterV2 | undefined): { config: MonitoringConfig; changed: boolean } {
  // A marked target's blocks keep their reference (their values have no side)
  if (plan.markTarget) return { config, changed: false };
  let changed = false;
  const measureId = storedMeasureId(plan);
  const sideLabel = plan.side === 'L' ? ' · Left' : plan.side === 'R' ? ' · Right' : '';
  const measure = target ? (plan.newMeasure ?? parameterMeasures(target).find((m) => m.id === plan.measureId)) : undefined;
  const blocks = config.blocks.map((b) => {
    if (b.type !== 'custom_metric' || !b.config || toParameterId(b.config.parameterId) !== plan.sourceId) return b;
    if (plan.convertSelf && b.config.measureId && b.config.measureId !== MAIN_MEASURE_ID) return b;
    changed = true;
    const storageRef = metricRefOf(b.config);
    const cfg = withoutMeasure(b.config);
    return {
      ...b,
      config: {
        ...cfg,
        parameterId: plan.targetId,
        ...(measureId ? { measureId } : {}),
        storageRef,
        parameterName: target ? `${measure && measure.id !== MAIN_MEASURE_ID ? `${target.name} · ${measure.name}` : target.name}${sideLabel}` : cfg.parameterName,
      },
    };
  });
  return { config: changed ? { ...config, blocks } : config, changed };
}
