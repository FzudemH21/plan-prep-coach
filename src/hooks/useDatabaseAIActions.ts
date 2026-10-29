/**
 * useDatabaseAIActions — the AI's access to the Parameter Database and the Training Toolbox from
 * every page that has the AI assistant (wizard steps, parameter database, toolbox):
 *  - `parameterContext`: the parameter database as text for the AI (parameters, interactions, method
 *    links, the methods it can link) — the toolbox itself is in the global context already
 *  - `applyDatabaseActions`: applies the AI's database actions (add / remove parameters, interactions,
 *    method links; add methods and method parameters to the toolbox, change / remove a method
 *    parameter, method descriptions) in one pass per database and saves once.
 * Several actions applied right after one another build on each other (the latest state is kept in a
 * ref until the stores re-render), so "Apply" on one card after another never loses a change.
 */
import { useCallback, useMemo, useRef } from 'react';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useToast } from '@/hooks/use-toast';
import type { ApplySuggestion, ToolboxParameterSpec } from '@/components/wizard/WizardAIAssistant';
import { MAIN_MEASURE_ID, type ParameterMeasure, type ParametersDatabaseV2, type ParameterV2 } from '@/types/parametersV2';
import type { AIMeasureSpec } from '@/components/wizard/WizardAIAssistant';
import { measureSummary, measuresToStore, newMeasureId, parameterMeasures, scopeLabel } from '@/utils/parameterMeasures';
import type { ToolboxDatabase, ToolboxEntry } from '@/types/toolbox';

export const PARAMETER_ACTION_TYPES: ReadonlySet<string> = new Set([
  'add_parameter', 'add_parameters_bulk', 'remove_parameter', 'add_parameter_measures',
  'add_interaction', 'add_interactions_bulk', 'remove_interaction', 'remove_interactions_bulk',
  'add_parameter_method', 'add_parameter_methods_bulk', 'update_parameter_method', 'update_parameter_methods_bulk',
  'remove_parameter_method',
]);
export const TOOLBOX_ACTION_TYPES: ReadonlySet<string> = new Set([
  'set_method_description', 'toolbox_add_method', 'toolbox_add_method_parameters',
  'toolbox_update_method_parameter', 'toolbox_remove_method_parameter',
]);
export const isDatabaseAction = (action: ApplySuggestion): boolean =>
  PARAMETER_ACTION_TYPES.has(action.type) || TOOLBOX_ACTION_TYPES.has(action.type);

const VALID_EVIDENCE_QUALITY = new Set(['strong', 'moderate', 'preliminary', 'expert_opinion']);
export function normalizeEvidenceQuality(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim();
  if (VALID_EVIDENCE_QUALITY.has(lower)) return lower;
  // "expert opinion" → "expert_opinion"
  const underscored = lower.replace(/[\s-]+/g, '_');
  return VALID_EVIDENCE_QUALITY.has(underscored) ? underscored : undefined;
}

/** methodId of a toolbox method in the parameter database: "<category> - <subCategory>" (or the category alone) */
const methodIdOf = (e: Pick<ToolboxEntry, 'category' | 'subCategory'>) => (e.subCategory ? `${e.category} - ${e.subCategory}` : e.category);

// ── Context for the AI ────────────────────────────────────────────────────────

export function buildParameterDatabaseContext(data: ParametersDatabaseV2 | undefined, toolbox: ToolboxDatabase | undefined): string {
  // Name and metadata separately, so the AI doesn't take "(category)" for part of the name
  const paramList = data?.parameters?.length
    ? data.parameters.map((p) =>
        `- name: "${p.name}"`
        + (p.category ? ` | category: ${p.category}` : '')
        + (p.unit ? ` | unit: ${p.unit}` : '')
        + (p.measures?.length ? ` | measures: ${parameterMeasures(p).map((m) => `${m.name} (${m.id === MAIN_MEASURE_ID ? 'main, ' : ''}${m.kind}${measureSummary(m) ? `: ${measureSummary(m)}` : ''})`).join('; ')}` : '')
        + (p.perSide ? ' | recorded per side (L / R) — LSI calculated' : '')).join('\n')
    : 'No parameters defined yet.';

  const seen = new Set<string>();
  const methods: string[] = [];
  for (const entry of toolbox?.entries ?? []) {
    const id = methodIdOf(entry);
    if (seen.has(id)) continue;
    seen.add(id);
    methods.push(`- "${entry.subCategory || entry.category}" → methodId: "${id}"`);
  }

  const linkList = data?.parameterMethods?.length
    ? data.parameterMethods.map((link) => {
        const param = data.parameters.find((p) => p.id === link.parameterId);
        if (!param) return null;
        return `- parameterName: "${param.name}" | methodId: "${link.methodId}"`
          + (link.measureIds?.length ? ` | for: ${scopeLabel(link, param)}` : '')
          + (link.rationale ? ` | rationale: "${link.rationale}"` : '')
          + (link.evidence ? ` | evidence: "${link.evidence}"` : '')
          + (link.evidenceQuality ? ` | evidenceQuality: "${link.evidenceQuality}"` : '');
      }).filter(Boolean).join('\n')
    : 'No method links defined yet.';

  let interactions = 'No interactions defined yet.';
  if (data?.interactions?.length) {
    // Grouped by source parameter so the AI can look up per-parameter targets exactly
    const bySource = new Map<string, string[]>();
    for (const i of data.interactions) {
      const src = data.parameters.find((p) => p.id === i.sourceParameterId);
      const tgt = data.parameters.find((p) => p.id === i.targetParameterId);
      if (!src || !tgt) continue;
      if (!bySource.has(src.name)) bySource.set(src.name, []);
      bySource.get(src.name)!.push(`"${tgt.name}"${i.strength ? ` (${i.strength})` : ''}${i.measureIds?.length ? ` [for: ${scopeLabel(i, tgt)}]` : ''}`);
    }
    interactions = Array.from(bySource.entries()).map(([src, t]) => `"${src}" → ${t.join(', ')}`).join('\n');
  }

  return [
    `Parameters (${data?.parameters?.length ?? 0} total):\n${paramList}`,
    `Interactions already defined — grouped by source parameter (${data?.interactions?.length ?? 0} total).\nTo check if a pair exists: find the source parameter's row and look for that exact target. Only skip that exact source→target pair. Having other interactions does NOT block adding new ones for that parameter:\n${interactions}`,
    `Existing method links (${data?.parameterMethods?.length ?? 0} total — use these exact parameterName and methodId values when updating or removing):\n${linkList}`,
    `Available training methods — use the exact methodId string shown when applying:\n${methods.length ? methods.join('\n') : 'No training methods in the toolbox yet.'}`,
  ].join('\n\n');
}

// ── Parameter database ────────────────────────────────────────────────────────

interface Outcome<T> { db: T; done: string[]; failed: string[] }

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`;

/** A measure from the AI's description (new id, only the fields of its kind) */
function toMeasure(m: AIMeasureSpec): ParameterMeasure {
  const base: ParameterMeasure = { id: newMeasureId(), name: m.name.trim(), kind: m.kind };
  switch (m.kind) {
    case 'number': return { ...base, unit: m.unit, betterWhen: m.betterWhen };
    case 'scale': return { ...base, scaleMin: m.scaleMin ?? 0, scaleMax: m.scaleMax ?? 10, scaleMinLabel: m.scaleMinLabel, scaleMaxLabel: m.scaleMaxLabel, betterWhen: m.betterWhen };
    case 'levels': return { ...base, levels: (m.levels ?? []).filter(Boolean) };
    default: return base;
  }
}

export function applyParameterActions(base: ParametersDatabaseV2, actions: ApplySuggestion[]): Outcome<ParametersDatabaseV2> {
  let parameters = [...base.parameters];
  let interactions = [...base.interactions];
  let parameterMethods = [...base.parameterMethods];
  const failed: string[] = [];
  let pAdded = 0, pRemoved = 0, iAdded = 0, iRemoved = 0, mAdded = 0, mUpdated = 0, mRemoved = 0, mMeasures = 0, mPerSide = 0, n = 0;
  const newId = (k: string) => `${Date.now()}_${k}${n++}`;

  // Looks in the WORKING list, so a parameter added a step before is found right away; tolerant of
  // case and of a trailing "(…)" the AI may add or leave out
  const find = (name: string) => {
    const t = name.trim();
    const lower = t.toLowerCase();
    const bare = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
    return parameters.find((p) => p.name === t)
      ?? parameters.find((p) => p.name.trim().toLowerCase() === lower)
      ?? parameters.find((p) => bare(p.name) === bare(t) && bare(t).length > 0);
  };
  const addParam = (p: { name: string; category?: string; unit?: string; mainMeasureName?: string; mainBetterWhen?: 'higher' | 'lower'; measures?: AIMeasureSpec[]; perSide?: boolean }) => {
    if (find(p.name)) { failed.push(`"${p.name}" already exists`); return; }
    const measures: ParameterMeasure[] = [
      { id: MAIN_MEASURE_ID, name: p.mainMeasureName?.trim() || 'Value', kind: 'number', betterWhen: p.mainBetterWhen },
      ...(p.measures ?? []).map(toMeasure),
    ];
    const param: ParameterV2 = { id: newId('p'), name: p.name, category: p.category, unit: p.unit, createdAt: new Date().toISOString() };
    const stored = measuresToStore(measures);
    if (stored) param.measures = stored;
    if (p.perSide) param.perSide = true;
    parameters.push(param);
    pAdded++;
  };
  /** Measure names → ids of the parameter's measures (unknown names are reported); none = no scope */
  const scopeIds = (param: ParameterV2, names: string[] | undefined): string[] | undefined => {
    if (!names?.length) return undefined;
    const measures = parameterMeasures(param);
    const ids: string[] = [];
    for (const n of names) {
      const m = measures.find((x) => x.name.trim().toLowerCase() === n.trim().toLowerCase());
      if (m) ids.push(m.id); else failed.push(`${param.name}: measure "${n}" not found`);
    }
    return ids.length ? ids : undefined;
  };
  const addInteraction = (i: { sourceParameterName: string; targetParameterName: string; direction: 'contributes_to' | 'improved_by'; strength?: 'strong' | 'moderate' | 'weak'; targetMeasureNames?: string[] }) => {
    const src = find(i.sourceParameterName);
    const tgt = find(i.targetParameterName);
    if (!src || !tgt) { failed.push(`${i.sourceParameterName} → ${i.targetParameterName}: parameter not found`); return; }
    if (interactions.some((x) => x.sourceParameterId === src.id && x.targetParameterId === tgt.id)) return;
    const measureIds = scopeIds(tgt, i.targetMeasureNames);
    if (i.targetMeasureNames?.length && !measureIds) return;
    interactions.push({ id: newId('i'), sourceParameterId: src.id, targetParameterId: tgt.id, direction: i.direction, strength: i.strength ?? 'moderate', ...(measureIds ? { measureIds } : {}) });
    iAdded++;
  };
  const removeInteraction = (i: { sourceParameterName: string; targetParameterName: string }) => {
    const src = find(i.sourceParameterName);
    const tgt = find(i.targetParameterName);
    const before = interactions.length;
    if (src && tgt) interactions = interactions.filter((x) => !(x.sourceParameterId === src.id && x.targetParameterId === tgt.id));
    if (interactions.length === before) failed.push(`${i.sourceParameterName} → ${i.targetParameterName}: interaction not found`);
    else iRemoved += before - interactions.length;
  };
  const addLink = (l: { parameterName: string; methodId: string; rationale?: string; evidence?: string; evidenceQuality?: string; measureNames?: string[] }) => {
    const param = find(l.parameterName);
    if (!param) { failed.push(`${l.methodId} → ${l.parameterName}: parameter not found`); return; }
    if (parameterMethods.some((m) => m.parameterId === param.id && m.methodId === l.methodId)) return;
    const measureIds = scopeIds(param, l.measureNames);
    // Measures named but none of them found: not added without a scope (it would count for all measures)
    if (l.measureNames?.length && !measureIds) return;
    parameterMethods.push({ id: newId('m'), parameterId: param.id, methodId: l.methodId, rationale: l.rationale, evidence: l.evidence, evidenceQuality: normalizeEvidenceQuality(l.evidenceQuality), ...(measureIds ? { measureIds } : {}) });
    mAdded++;
  };
  const updateLink = (u: { parameterName: string; methodId: string; rationale?: string; evidence?: string; evidenceQuality?: string; measureNames?: string[] }) => {
    const param = find(u.parameterName);
    const eq = normalizeEvidenceQuality(u.evidenceQuality);
    const measureIds = param && u.measureNames ? scopeIds(param, u.measureNames) : undefined;
    let matched = false;
    if (param) {
      parameterMethods = parameterMethods.map((m) => {
        if (m.parameterId !== param.id || m.methodId !== u.methodId) return m;
        matched = true;
        return {
          ...m,
          ...(u.rationale !== undefined && { rationale: u.rationale }),
          ...(u.evidence !== undefined && { evidence: u.evidence }),
          ...(eq !== undefined && { evidenceQuality: eq }),
          ...(u.measureNames !== undefined && { measureIds }),
        };
      });
    }
    if (matched) mUpdated++;
    else failed.push(`${u.methodId} → ${u.parameterName}: link not found`);
  };

  for (const a of actions) {
    switch (a.type) {
      case 'add_parameter': addParam(a); break;
      case 'add_parameter_measures': {
        const param = find(a.parameterName);
        if (!param) { failed.push(`"${a.parameterName}" not found`); break; }
        const current = parameterMeasures(param);
        const added = (a.measures ?? []).filter((m) => m.name?.trim() && !current.some((c) => c.name.trim().toLowerCase() === m.name.trim().toLowerCase()));
        if ((a.measures ?? []).length > added.length) failed.push(`${param.name}: ${(a.measures ?? []).length - added.length} measure(s) already exist`);
        const next = [...current, ...added.map(toMeasure)];
        parameters = parameters.map((p) => (p.id !== param.id ? p : { ...p, measures: measuresToStore(next), ...(a.perSide ? { perSide: true } : {}) }));
        mMeasures += added.length;
        if (a.perSide && !param.perSide) mPerSide++;
        break;
      }
      case 'add_parameters_bulk': a.parameters.forEach(addParam); break;
      case 'remove_parameter': {
        const param = find(a.parameterName);
        if (!param) { failed.push(`"${a.parameterName}" not found`); break; }
        parameters = parameters.filter((p) => p.id !== param.id);
        interactions = interactions.filter((i) => i.sourceParameterId !== param.id && i.targetParameterId !== param.id);
        parameterMethods = parameterMethods.filter((m) => m.parameterId !== param.id);
        pRemoved++;
        break;
      }
      case 'add_interaction': addInteraction(a); break;
      case 'add_interactions_bulk': a.interactions.forEach(addInteraction); break;
      case 'remove_interaction': removeInteraction(a); break;
      case 'remove_interactions_bulk': a.interactions.forEach(removeInteraction); break;
      case 'add_parameter_method': addLink(a); break;
      case 'add_parameter_methods_bulk': a.links.forEach(addLink); break;
      case 'update_parameter_method': updateLink(a); break;
      case 'update_parameter_methods_bulk': a.updates.forEach(updateLink); break;
      case 'remove_parameter_method': {
        const param = find(a.parameterName);
        const before = parameterMethods.length;
        if (param) parameterMethods = parameterMethods.filter((m) => !(m.parameterId === param.id && m.methodId === a.methodId));
        if (parameterMethods.length === before) failed.push(`${a.methodId} → ${a.parameterName}: link not found`);
        else mRemoved++;
        break;
      }
      default: break;
    }
  }

  const done = [
    pAdded && `${plural(pAdded, 'parameter')} added`, pRemoved && `${plural(pRemoved, 'parameter')} removed`,
    iAdded && `${plural(iAdded, 'interaction')} added`, iRemoved && `${plural(iRemoved, 'interaction')} removed`,
    mAdded && `${plural(mAdded, 'method link')} added`, mUpdated && `${plural(mUpdated, 'method link')} updated`,
    mRemoved && `${plural(mRemoved, 'method link')} removed`,
    mMeasures && `${plural(mMeasures, 'measure')} added`,
    mPerSide && `${plural(mPerSide, 'parameter')} now recorded per side`,
  ].filter((x): x is string => !!x);
  return { db: { ...base, parameters, interactions, parameterMethods }, done, failed };
}

// ── Training toolbox ──────────────────────────────────────────────────────────

export function applyToolboxActions(base: ToolboxDatabase, actions: ApplySuggestion[]): Outcome<ToolboxDatabase> {
  let entries = [...base.entries];
  const descriptions = { ...(base.methodDescriptions ?? {}) };
  const failed: string[] = [];
  let methodsAdded = 0, paramsAdded = 0, paramsUpdated = 0, paramsRemoved = 0, descs = 0, n = 0;

  const same = (a: string | undefined, b: string | undefined) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
  /** "Category|||SubCategory" — also "Category - SubCategory" (as the toolbox list shows it) */
  const resolveMethod = (key: string): { category: string; subCategory: string } | null => {
    if (key.includes('|||')) {
      const [category, subCategory = ''] = key.split('|||');
      const hit = entries.find((e) => same(e.category, category) && same(e.subCategory, subCategory));
      return hit ? { category: hit.category, subCategory: hit.subCategory } : null;
    }
    const hit = entries.find((e) => same(methodIdOf(e), key) || same(e.subCategory, key));
    return hit ? { category: hit.category, subCategory: hit.subCategory } : null;
  };
  const methodEntries = (m: { category: string; subCategory: string }) => entries.filter((e) => e.category === m.category && e.subCategory === m.subCategory);

  const addParams = (m: { category: string; subCategory: string }, specs: ToolboxParameterSpec[], exerciseCategories?: string[]) => {
    const existing = methodEntries(m);
    const cats = exerciseCategories ?? existing[0]?.exerciseCategories;
    for (const spec of specs) {
      if (!spec.name?.trim()) continue;
      if (existing.some((e) => same(e.parameterName, spec.name)) || methodEntries(m).some((e) => same(e.parameterName, spec.name))) {
        failed.push(`${m.subCategory || m.category}: "${spec.name}" already exists`);
        continue;
      }
      const quantitative = spec.type !== 'qualitative';
      const current = methodEntries(m);
      // Only one frequency / set / rest parameter per method
      const entry: ToolboxEntry = {
        id: `${Date.now()}${n++}`,
        category: m.category,
        subCategory: m.subCategory,
        parameterName: spec.name.trim(),
        parameterType: quantitative ? 'quantitative' : 'qualitative',
        options: spec.options ?? [],
        ...(cats?.length ? { exerciseCategories: cats } : {}),
        ...(spec.role === 'frequency' && quantitative && !current.some((e) => e.isFrequencyParameter) ? { isFrequencyParameter: true } : {}),
        ...(spec.role === 'sets' && quantitative && !current.some((e) => e.isSetParameter) ? { isSetParameter: true } : {}),
        ...(spec.role === 'rest' && !current.some((e) => e.isRestParameter) ? { isRestParameter: true } : {}),
        ...(spec.showInGrid !== undefined ? { showInGridByDefault: spec.showInGrid } : {}),
      };
      entries.push(entry);
      paramsAdded++;
    }
  };

  for (const a of actions) {
    switch (a.type) {
      case 'set_method_description': {
        const m = resolveMethod(a.methodKey);
        const key = m ? `${m.category}|||${m.subCategory}` : a.methodKey;
        if (a.description) descriptions[key] = a.description; else delete descriptions[key];
        descs++;
        break;
      }
      case 'toolbox_add_method': {
        if (!a.category?.trim() || !a.subCategory?.trim()) { failed.push('Method needs a category and a name'); break; }
        if (!a.parameters?.length) { failed.push(`${a.subCategory}: a method needs at least one parameter`); break; }
        const existing = entries.find((e) => same(e.category, a.category) && same(e.subCategory, a.subCategory));
        const m = existing ? { category: existing.category, subCategory: existing.subCategory } : { category: a.category.trim(), subCategory: a.subCategory.trim() };
        if (!existing) methodsAdded++;
        addParams(m, a.parameters, a.exerciseCategories);
        if (a.description?.trim()) { descriptions[`${m.category}|||${m.subCategory}`] = a.description.trim(); }
        break;
      }
      case 'toolbox_add_method_parameters': {
        const m = resolveMethod(a.methodKey);
        if (!m) { failed.push(`Method "${a.methodKey}" not found`); break; }
        addParams(m, a.parameters);
        break;
      }
      case 'toolbox_update_method_parameter': {
        const m = resolveMethod(a.methodKey);
        const target = m ? methodEntries(m).find((e) => same(e.parameterName, a.parameterName)) : undefined;
        if (!m || !target) { failed.push(`"${a.parameterName}" in "${a.methodKey}" not found`); break; }
        entries = entries.map((e) => (e.id !== target.id ? e : {
          ...e,
          ...(a.parameterType ? { parameterType: a.parameterType } : {}),
          ...(a.options ? { options: a.options } : {}),
          ...(a.showInGrid !== undefined ? { showInGridByDefault: a.showInGrid } : {}),
        }));
        paramsUpdated++;
        break;
      }
      case 'toolbox_remove_method_parameter': {
        const m = resolveMethod(a.methodKey);
        const list = m ? methodEntries(m) : [];
        const target = list.find((e) => same(e.parameterName, a.parameterName));
        if (!m || !target) { failed.push(`"${a.parameterName}" in "${a.methodKey}" not found`); break; }
        // The last parameter would remove the whole method — that stays a manual step in the toolbox
        if (list.length <= 1) { failed.push(`"${a.parameterName}" is the method's only parameter — not removed`); break; }
        entries = entries.filter((e) => e.id !== target.id);
        paramsRemoved++;
        break;
      }
      default: break;
    }
  }

  const done = [
    methodsAdded && `${plural(methodsAdded, 'method')} added to the toolbox`,
    paramsAdded && `${plural(paramsAdded, 'method parameter')} added`,
    paramsUpdated && `${plural(paramsUpdated, 'method parameter')} updated`,
    paramsRemoved && `${plural(paramsRemoved, 'method parameter')} removed`,
    descs && `${plural(descs, 'method description')} updated`,
  ].filter((x): x is string => !!x);
  return { db: { ...base, entries, methodDescriptions: descriptions }, done, failed };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDatabaseAIActions() {
  const { data: paramData, saveData: saveParams, isLoading: paramsLoading } = useParametersDataV2();
  const { data: toolboxData, saveData: saveToolbox, isLoading: toolboxLoading } = useToolboxData();
  const { toast } = useToast();

  // Latest state: the store's data — or what was applied a moment ago and isn't rendered yet
  const paramRef = useRef(paramData);
  const paramSeen = useRef(paramData);
  if (paramSeen.current !== paramData) { paramSeen.current = paramData; paramRef.current = paramData; }
  const toolboxRef = useRef(toolboxData);
  const toolboxSeen = useRef(toolboxData);
  if (toolboxSeen.current !== toolboxData) { toolboxSeen.current = toolboxData; toolboxRef.current = toolboxData; }

  const parameterContext = useMemo(() => buildParameterDatabaseContext(paramData, toolboxData), [paramData, toolboxData]);

  const applyDatabaseActions = useCallback(async (actions: ApplySuggestion[]): Promise<void> => {
    const paramActions = actions.filter((a) => PARAMETER_ACTION_TYPES.has(a.type));
    const toolboxActions = actions.filter((a) => TOOLBOX_ACTION_TYPES.has(a.type));
    // Never save over a database that hasn't loaded yet
    if ((paramActions.length && paramsLoading) || (toolboxActions.length && toolboxLoading)) {
      toast({ title: 'Database still loading', description: 'Please apply again in a moment.', variant: 'destructive' });
      return;
    }
    const done: string[] = [];
    const failed: string[] = [];
    const saves: Promise<void>[] = [];
    if (paramActions.length) {
      const r = applyParameterActions(paramRef.current, paramActions);
      paramRef.current = r.db;
      done.push(...r.done); failed.push(...r.failed);
      if (r.done.length) saves.push(saveParams(r.db));
    }
    if (toolboxActions.length) {
      const r = applyToolboxActions(toolboxRef.current, toolboxActions);
      toolboxRef.current = r.db;
      done.push(...r.done); failed.push(...r.failed);
      if (r.done.length) saves.push(saveToolbox(r.db));
    }
    try {
      await Promise.all(saves);
    } catch (err) {
      console.error('[useDatabaseAIActions] save failed', err);
      toast({ title: 'Saving failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      return;
    }
    if (done.length) toast({ title: done.join(', ') });
    if (failed.length) {
      toast({
        title: `${plural(failed.length, 'change')} skipped`,
        description: failed.slice(0, 3).join(' · ') + (failed.length > 3 ? ` + ${failed.length - 3} more` : ''),
        variant: 'destructive',
      });
    }
  }, [paramsLoading, toolboxLoading, saveParams, saveToolbox, toast]);

  return { parameterContext, applyDatabaseActions };
}
