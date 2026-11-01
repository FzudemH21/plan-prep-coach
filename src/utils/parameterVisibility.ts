/**
 * Parameter visibility (which parameters an exercise shows in its grid) is stored per exercise in
 * the session's metadata key `workoutSessions_{mesoId}_{date}_{sessionIdx}`:
 *   { parameterVisibility?: Overrides,                       // legacy: whole session
 *     parameterVisibilityByExercise?: { [exerciseId]: Overrides } }
 * Overrides are a delta on the toolbox's showInGridByDefault. An exercise without its own entry
 * falls back to the (legacy) session-wide overrides; its first change copies those into its own
 * entry, so exercises are independent from then on.
 */
export type VisibilityOverrides = Record<string, boolean>;

export interface SessionVisibilityData {
  parameterVisibility?: VisibilityOverrides;
  parameterVisibilityByExercise?: Record<string, VisibilityOverrides>;
  [key: string]: unknown;
}

/**
 * Fired after per-session data (workoutSessions_ / sessionIntensity_ / workoutSections_ keys) is
 * written, so the wizard auto-saves it into the program — these keys aren't React state.
 */
export const SESSION_META_CHANGED_EVENT = 'ppc:session-meta-changed';
export function notifySessionMetaChanged(): void {
  window.dispatchEvent(new Event(SESSION_META_CHANGED_EVENT));
}

/**
 * Storage key of one session's stored data ("workoutSessions_", "sessionIntensity_",
 * "workoutSections_"). With a scope (the athlete calendar's assignment id) the key is
 * "{prefix}@{scope}@{mesocycleId}_{date}_{index}" — never shared with the training-program wizard,
 * whose sessions use the same mesocycle ids and often the same dates.
 */
export const sessionStorageKey = (
  prefix: string, mesocycleId: string, dayDate: string, sessionIndex: number, scope?: string,
) => scope
  ? `${prefix}@${scope}@${mesocycleId}_${dayDate}_${sessionIndex}`
  : `${prefix}${mesocycleId}_${dayDate}_${sessionIndex}`;

export const sessionMetaKey = (mesocycleId: string, dayDate: string, sessionIndex: number, scope?: string) =>
  sessionStorageKey('workoutSessions_', mesocycleId, dayDate, sessionIndex, scope);

/** A session's settings; a scoped read falls back to the unscoped key (settings saved before scoping) */
export function readSessionMeta(mesocycleId: string, dayDate: string, sessionIndex: number, scope?: string): SessionVisibilityData {
  try {
    const raw = localStorage.getItem(sessionMetaKey(mesocycleId, dayDate, sessionIndex, scope))
      ?? (scope ? localStorage.getItem(sessionMetaKey(mesocycleId, dayDate, sessionIndex)) : null);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as SessionVisibilityData : {};
  } catch {
    return {};
  }
}

export function writeSessionMeta(mesocycleId: string, dayDate: string, sessionIndex: number, data: SessionVisibilityData, scope?: string): void {
  try {
    localStorage.setItem(sessionMetaKey(mesocycleId, dayDate, sessionIndex, scope), JSON.stringify(data));
    notifySessionMetaChanged();
  } catch { /* ignore */ }
}

type PlacedExercise = { id?: string; exerciseId: string; parameterVisibility?: VisibilityOverrides };

/**
 * An exercise's overrides in its session: the session's own entry for it (session sheet / Master
 * Planner), else the exercise's own setting (`parameterVisibility` on its distribution entry — set in
 * the exercise distribution step and copied with the exercise), else the legacy session-wide ones.
 * Every place that changes them writes both, so they agree.
 */
export function placementVisibility(data: SessionVisibilityData | undefined, exercise: PlacedExercise): VisibilityOverrides {
  return data?.parameterVisibilityByExercise?.[exercise.id || exercise.exerciseId]
    ?? exercise.parameterVisibility
    ?? data?.parameterVisibility
    ?? {};
}

/** Distribution entries with one exercise's overrides set on it (they travel with copies of it) */
export function withExerciseVisibility<T extends PlacedExercise>(entries: T[], exerciseKey: string, overrides: VisibilityOverrides): T[] {
  return entries.map(e => ((e.id || e.exerciseId) === exerciseKey ? { ...e, parameterVisibility: overrides } : e));
}

/** The exercise has the parameter (Periodization Table / its own) — for all sets or per set ("Reps_set2") */
export function hasParam(params: Record<string, unknown> | undefined, name: string): boolean {
  if (!params) return false;
  if (name in params) return true;
  const perSet = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_set\\d+$`, 'i');
  return Object.keys(params).some(k => perSet.test(k));
}

/** Whether a parameter is shown when the coach hasn't chosen — the same rule as the session sheet and
 *  the Master Planner: a parameter the exercise has is shown when its Training Toolbox entry says
 *  "show in grid by default" (unset = yes); parameters it doesn't have are hidden */
export function visibleByDefault(hasValue: boolean, toolboxEntry?: { showInGridByDefault?: boolean }): boolean {
  return hasValue && (toolboxEntry?.showInGridByDefault ?? true);
}

/** The parameters an exercise of this method can show (Training Toolbox), for the visibility picker;
 *  `hasValue`: whether the exercise has the parameter (decides the default with the toolbox) */
export function methodVisibilityParams(
  entries: Array<{ category: string; subCategory?: string; parameterName: string; showInGridByDefault?: boolean; isSetParameter?: boolean; isFrequencyParameter?: boolean }>,
  methodId: string,
  hasValue: (name: string) => boolean = () => false,
): Array<{ name: string; showInGridByDefault: boolean }> {
  const [main = '', sub = ''] = methodId.split('::')[0].split(' - ');
  const seen = new Set<string>();
  return entries
    .filter(e => e.category === main && (sub ? e.subCategory === sub : !e.subCategory))
    .filter(e => !e.isSetParameter && !e.isFrequencyParameter && e.parameterName !== 'frequency_per_week' && e.parameterName !== 'Frequency')
    .filter(e => !seen.has(e.parameterName) && !!seen.add(e.parameterName))
    .map(e => ({ name: e.parameterName, showInGridByDefault: visibleByDefault(hasValue(e.parameterName), e) }));
}

/** Effective overrides for one exercise. */
export function getExerciseVisibility(data: SessionVisibilityData | undefined, exerciseId: string): VisibilityOverrides {
  const own = data?.parameterVisibilityByExercise?.[exerciseId];
  return own ?? data?.parameterVisibility ?? {};
}

/** Returns `data` with one exercise's overrides replaced by `update(current effective overrides)`. */
export function updateExerciseVisibility(
  data: SessionVisibilityData,
  exerciseId: string,
  update: (current: VisibilityOverrides) => VisibilityOverrides,
): SessionVisibilityData {
  return {
    ...data,
    parameterVisibilityByExercise: {
      ...(data.parameterVisibilityByExercise ?? {}),
      [exerciseId]: update(getExerciseVisibility(data, exerciseId)),
    },
  };
}
