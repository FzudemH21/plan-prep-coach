/**
 * workoutLog — the logged-session payload (`sets_logged` on athlete_session_logs), shared by the
 * athlete app, the coach mobile app and the coach closing an unfinished session for the athlete.
 */
import type { ExerciseSummary } from '@/hooks/useAthleteApp';
import type { WorkoutProgress } from '@/utils/workoutProgress';

export function getSetCount(ex: ExerciseSummary): number {
  if (ex.isCircuit) return Math.max(1, Number(ex.circuitRounds ?? 3));
  return ex.plannedSets && ex.plannedSets > 0 ? ex.plannedSets : 3;
}

/** Derive which param names to show as columns (excluding the "sets" count param). */
export function getParamColumns(ex: ExerciseSummary): string[] {
  // Build candidate list: coach-configured params take priority, otherwise
  // derive from all _setN keys present in plannedParams.
  let candidates: string[];
  if (ex.visibleParams && ex.visibleParams.length > 0) {
    candidates = ex.visibleParams;
  } else if (ex.plannedParams) {
    const bases = new Set<string>();
    for (const key of Object.keys(ex.plannedParams)) {
      const m = key.match(/^(.+)_set\d+$/);
      if (m) bases.add(m[1]);
    }
    candidates = bases.size > 0 ? Array.from(bases) : ['Reps'];
  } else {
    return ['Reps'];
  }

  // The rest parameter flagged in the Training Toolbox (restParamName) is not a log column — it
  // drives the timer and shows above the table. Other "…rest…" parameters (e.g. rest between reps
  // in intervals) are ordinary columns: the flag decides, not the name.
  candidates = candidates.filter(p => p !== ex.restParamName);

  // The coach chose these columns — show them all, also those without a planned value (e.g. Weight
  // when the intensity is prescribed via RiR: the athlete enters the weight they used)
  if (ex.visibleParams && ex.visibleParams.length > 0 && candidates.length > 0) return candidates;

  // Filter to only columns that have at least one non-empty planned value.
  // Supports two storage formats:
  //   • Per-set keys: "Reps_set1", "Reps_set2", … (ad-hoc/toolbox exercises)
  //   • Plain keys:   "Reps", "Tempo", …          (periodization-table exercises)
  if (ex.plannedParams) {
    const withValues = candidates.filter(param => {
      for (const [key, val] of Object.entries(ex.plannedParams!)) {
        if (val === undefined || val === null || val === '') continue;
        const m = key.match(/^(.+)_set\d+$/);
        if (m && m[1] === param) return true;  // per-set format
        if (key === param) return true;          // plain format (periodization table)
      }
      return false;
    });
    if (withValues.length > 0) return withValues;

    // plannedParams exists but no candidate has a non-empty value yet.
    // This happens for brand-new toolbox exercises (adhocPlannedParams has all
    // empty per-set placeholder keys) or when the periodization table wasn't filled.
    // If the coach configured visible columns, show them so the athlete can
    // fill in their actual values during the workout.
    if (candidates.length > 0) return candidates;
  }

  // No plannedParams or it was empty — fall back to the configured visible
  // columns if available, otherwise default to a single Reps column.
  return candidates.length > 0 ? candidates : ['Reps'];
}

export function getPlannedValue(ex: ExerciseSummary, paramName: string, setIdx: number): string {
  if (!ex.plannedParams) return '';
  // Per-set format (ad-hoc/toolbox exercises): "Reps_set1", "Reps_set2", …
  const perSetVal = ex.plannedParams[`${paramName}_set${setIdx + 1}`];
  if (perSetVal !== undefined && perSetVal !== null && perSetVal !== '') return String(perSetVal);
  // Plain format (periodization-table exercises): one value applies to all sets
  const plainVal = ex.plannedParams[paramName];
  if (plainVal !== undefined && plainVal !== null && plainVal !== '') return String(plainVal);
  return '';
}

/** What a workout has logged so far — the parts of WorkoutProgress the payload is built from */
export type WorkoutLogState = Pick<WorkoutProgress, 'loggedValues' | 'completedSets' | 'setCountOverrides' | 'swappedExercises'>;

export const EMPTY_WORKOUT_LOG_STATE: WorkoutLogState = {
  loggedValues: {}, completedSets: {}, setCountOverrides: {}, swappedExercises: {},
};

/**
 * The `sets_logged` payload — ALL exercises of the session (with section/superset structure), so the
 * coach sees the full session, including skipped exercises.
 * `countUntickedAsDone` (coach closing a session the athlete did, but didn't tick everything in the
 * app): every set / round not ticked counts as done, with its planned values.
 */
export function buildSetsLoggedPayload(
  exercises: ExerciseSummary[],
  state: WorkoutLogState,
  options: { countUntickedAsDone?: boolean } = {},
) {
  const { loggedValues, completedSets, setCountOverrides, swappedExercises } = state;
  const allDone = !!options.countUntickedAsDone;
  return exercises.map(ex => {
    if (ex.isCircuit) {
      const totalRounds = Math.max(1, Number(ex.circuitRounds ?? 3));
      return {
        exerciseName: ex.name,
        isCircuit: true as const,
        roundsCompleted: allDone ? totalRounds : (completedSets[ex.id] ?? []).length,
        totalRounds,
        circuitRestBetweenRounds: ex.circuitRestBetweenRounds,
        circuitRestBetweenExercises: ex.circuitRestBetweenExercises,
        circuitComments: ex.circuitComments,
        circuitExercises: ex.circuitExercises,
        sectionId: ex.sectionId,
        sectionName: ex.sectionName,
        sectionOrder: ex.sectionOrder ?? 0,
        supersetId: ex.supersetId,
        exerciseOrder: ex.order,
      };
    }
    const plannedSetCount = getSetCount(ex);
    const actualSetCount = setCountOverrides[ex.id] ?? plannedSetCount;
    const exCompleted = completedSets[ex.id] ?? [];
    const exLogged = loggedValues[ex.id] ?? {};
    const columns = getParamColumns(ex);
    // Convert plannedParams to string values for storage
    const plannedParamsStr: Record<string, string> = {};
    if (ex.plannedParams) {
      for (const [k, v] of Object.entries(ex.plannedParams)) plannedParamsStr[k] = String(v);
    }
    const swap = swappedExercises[ex.id];
    return {
      exerciseName: swap ? swap.replacementName : ex.name,
      exerciseLibraryId: ex.exerciseLibraryId,
      methodId: ex.methodKey,
      swappedFrom: swap ? swap.originalName : undefined,
      swapDirection: swap ? swap.direction : undefined,
      swapReason: swap?.reason || undefined,
      plannedSets: plannedSetCount,
      plannedParams: Object.keys(plannedParamsStr).length > 0 ? plannedParamsStr : undefined,
      // The columns shown while logging — so a column left empty (e.g. Weight without a planned
      // value) still shows in the logged session's table
      columns,
      sectionId: ex.sectionId,
      sectionName: ex.sectionName,
      sectionOrder: ex.sectionOrder ?? 0,
      supersetId: ex.supersetId,
      exerciseOrder: ex.order,
      sets: Array.from({ length: actualSetCount }, (_, setIdx) => {
        const ticked = exCompleted.includes(setIdx);
        let values = exLogged[setIdx] ?? {};
        if (allDone && !ticked) {
          values = { ...values };
          for (const col of columns) {
            if (values[col] !== undefined && values[col] !== '') continue;
            const planned = getPlannedValue(ex, col, setIdx);
            if (planned) values[col] = planned;
          }
        }
        return { setNumber: setIdx + 1, values, completed: ticked || allDone };
      }),
    };
  });
}
