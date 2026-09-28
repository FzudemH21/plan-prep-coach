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
