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

export const sessionMetaKey = (mesocycleId: string, dayDate: string, sessionIndex: number) =>
  `workoutSessions_${mesocycleId}_${dayDate}_${sessionIndex}`;

export function readSessionMeta(mesocycleId: string, dayDate: string, sessionIndex: number): SessionVisibilityData {
  try {
    const raw = localStorage.getItem(sessionMetaKey(mesocycleId, dayDate, sessionIndex));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as SessionVisibilityData : {};
  } catch {
    return {};
  }
}

export function writeSessionMeta(mesocycleId: string, dayDate: string, sessionIndex: number, data: SessionVisibilityData): void {
  try {
    localStorage.setItem(sessionMetaKey(mesocycleId, dayDate, sessionIndex), JSON.stringify(data));
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
