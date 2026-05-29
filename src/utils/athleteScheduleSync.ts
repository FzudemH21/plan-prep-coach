/**
 * athleteScheduleSync
 *
 * Populates the athlete_schedule Supabase table from the shifted assignment data
 * produced during plan assignment. Called after handleAssignProgram writes to
 * localStorage, so the athlete app can read sessions directly from Supabase.
 */
import { supabase } from '@/lib/supabase';
import { AthleteCalendarAssignment } from '@/types/athlete';
import type { ToolboxEntry } from '@/types/toolbox';

interface TrainingDay {
  date: string;
  intensity: string;
  sessions: number;
  sessionNames?: string[];
  isTrainingDay: boolean;
  mesocycleId?: string;
  microcycleId?: string;
}

// Shared interface — also re-exported from useAthleteApp.ts (keep in sync)
export interface ExerciseSummary {
  id: string;
  name: string;
  order: number;
  sectionId?: string;
  sectionName?: string;
  sectionOrder?: number;
  notes?: string;
  isCircuit?: boolean;
  // Planned values from the periodization table
  methodKey?: string;
  plannedSets?: number;
  plannedParams?: Record<string, string | number>;  // flat planned params (Reps_set1, etc.)
  visibleParams?: string[];  // param names the coach marked showInAthleteApp
  restParamName?: string;    // name of the rest/pause parameter for this exercise's method
}

export interface SessionSummary {
  id: string;
  name: string;
  order: number;
  exerciseCount: number;
  methodCount: number;
  duration?: number;
  notes?: string;
  exercises: ExerciseSummary[];
}

interface ExerciseEntry {
  id: string;
  exerciseId: string;
  exerciseName?: string;
  methodId?: string;
  categoryName?: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
  order: number;
  sectionId?: string;
  notes?: string;
  isCircuit?: boolean;
  [key: string]: unknown;
}

interface SessionSectionEntry {
  id: string;
  dayDate: string;
  sessionIndex: number;
  name: string;
  order: number;
}

// parameterValues: [mesocycleId][microcycleIndex][methodKey][sessionIndex][paramName]
type ParamValues = Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>;

export async function syncAthleteSchedule(
  connectionId: string,
  assignment: AthleteCalendarAssignment,
  trainingDays: TrainingDay[],
  exercises: ExerciseEntry[],
  programName: string,
  paramValues?: ParamValues,
  sessionSections?: SessionSectionEntry[],
  toolboxEntries?: ToolboxEntry[],
): Promise<void> {
  if (!connectionId || trainingDays.length === 0) return;

  console.log(`[syncAthleteSchedule] ▶ start | connectionId=${connectionId} | trainingDays=${trainingDays.length} | exercises=${exercises.length} | paramKeys=${Object.keys(paramValues ?? {}).length}`);

  // Build a lookup: date → mesocycle/microcycle name + ids
  const mesoByDate = new Map<string, {
    mesoName: string;
    microName: string | null;
    mesocycleId: string;
    microcycleIndex: number;
  }>();
  for (const meso of assignment.assignedMesocycles) {
    // Normalise to yyyy-MM-dd before appending the noon-local suffix.
    // startDate/endDate may arrive as a full ISO timestamp ("2026-05-25T00:00:00.000Z")
    // from the assignment record; appending 'T12:00:00' to a full ISO string produces
    // an invalid date and causes toISOString() to throw "Invalid time value".
    const start = new Date(meso.startDate.slice(0, 10) + 'T12:00:00');
    let microOffset = 0;
    for (let microIdx = 0; microIdx < (meso.microcycles?.length ?? 0); microIdx++) {
      const micro = meso.microcycles[microIdx];
      for (let d = 0; d < micro.duration; d++) {
        const day = new Date(start.getTime() + (microOffset + d) * 86400000);
        const dateStr = day.toISOString().slice(0, 10);
        mesoByDate.set(dateStr, {
          mesoName: meso.name,
          microName: micro.name ?? null,
          mesocycleId: meso.id,
          microcycleIndex: microIdx,
        });
      }
      microOffset += micro.duration;
    }
    // Fallback if no microcycles
    if (!meso.microcycles?.length) {
      const startD = new Date(meso.startDate.slice(0, 10) + 'T12:00:00');
      const endD = new Date(meso.endDate.slice(0, 10) + 'T12:00:00');
      for (let d = new Date(startD); d <= endD; d = new Date(d.getTime() + 86400000)) {
        const dateStr = d.toISOString().slice(0, 10);
        mesoByDate.set(dateStr, {
          mesoName: meso.name,
          microName: null,
          mesocycleId: meso.id,
          microcycleIndex: 0,
        });
      }
    }
  }

  // Build section lookup: "dayDate-sessionIndex-sectionId" → { name, order }
  const sectionLookup = new Map<string, { name: string; order: number }>();
  if (sessionSections) {
    for (const sec of sessionSections) {
      const key = `${sec.dayDate}-${sec.sessionIndex}-${sec.id}`;
      sectionLookup.set(key, { name: sec.name, order: sec.order });
    }
  }

  // Build toolbox visible-params lookup: "category - subCategory" → string[]
  // Also build rest-param lookup: "category - subCategory" → restParamName
  const toolboxVisibleMap = new Map<string, string[]>();
  const toolboxRestMap = new Map<string, string>();
  if (toolboxEntries) {
    const grouped = new Map<string, string[]>();
    for (const entry of toolboxEntries) {
      const key = entry.subCategory
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      // Track rest parameter name for this method key
      if (entry.isRestParameter) {
        toolboxRestMap.set(key, entry.parameterName);
      }
      // Include all params that are shown in the grid by default (per toolbox config).
      // Qualitative params (e.g. Intensity expressed as "75-80% 1RM") and rest params
      // (e.g. "Inter-Set Rest Duration") are intentionally kept here — the coach app
      // shows them in the session grid and the athlete app should match.
      // Frequency and Set params are structural (not per-set columns) so always excluded.
      if (!entry.showInGridByDefault || entry.isFrequencyParameter || entry.isSetParameter) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(entry.parameterName);
    }
    for (const [k, v] of grouped) toolboxVisibleMap.set(k, v);
  }

  /** Strip the ::ExerciseCategory split suffix from a method key, e.g.
   *  "Lower Body Strength - Power::Squat" → "Lower Body Strength - Power" */
  function stripSplitSuffix(methodKey: string): string {
    const idx = methodKey.indexOf('::');
    return idx !== -1 ? methodKey.slice(0, idx) : methodKey;
  }

  // Helper: get planned params for an exercise
  function getPlannedParams(ex: ExerciseEntry): {
    plannedSets: number | undefined;
    plannedParams: Record<string, string | number> | undefined;
    visibleParams: string[] | undefined;
    restParamName: string | undefined;
  } {
    // Base method key without any ::ExerciseCategory split suffix
    const baseMethodKey = stripSplitSuffix(ex.methodId ?? '');

    // Ad-hoc (toolbox-sourced) exercises carry their own params — no periodization lookup needed.
    if (ex.parameterSource === 'toolbox') {
      if (ex.adhocPlannedParams) {
        const adhocParams = ex.adhocPlannedParams as Record<string, string | number>;
        const setsKey = Object.keys(adhocParams).find(k => /^sets?$/i.test(k));
        const plannedSets = setsKey ? Number(adhocParams[setsKey]) : undefined;
        const visibleParams = Array.isArray(ex.adhocVisibleParams)
          ? (ex.adhocVisibleParams as string[])
          : undefined;
        const restParamName = toolboxRestMap.get(baseMethodKey);
        return {
          plannedSets: plannedSets && !isNaN(plannedSets) ? plannedSets : undefined,
          plannedParams: adhocParams,
          visibleParams: visibleParams && visibleParams.length > 0 ? visibleParams : undefined,
          restParamName,
        };
      }

      // Legacy ad-hoc exercise (added before adhocPlannedParams was introduced):
      // derive visibility from toolbox, no planned values available.
      const vp = toolboxVisibleMap.get(baseMethodKey);
      const restParamName = toolboxRestMap.get(baseMethodKey);
      return {
        plannedSets: undefined,
        plannedParams: undefined,
        visibleParams: vp && vp.length > 0 ? vp : undefined,
        restParamName,
      };
    }

    if (!paramValues) return { plannedSets: undefined, plannedParams: undefined, visibleParams: undefined, restParamName: undefined };

    const meta = mesoByDate.get(ex.dayDate);
    if (!meta) return { plannedSets: undefined, plannedParams: undefined, visibleParams: undefined, restParamName: undefined };

    const { mesocycleId, microcycleIndex } = meta;
    const methodKeyBase = ex.methodId ?? '';

    // Mirror WorkoutSessionSheet's fallback chain:
    // 1. Try category-qualified key (for split methods stored as "Method::Category")
    // 2. Fall back to base method key (for unsplit methods)
    // Both at session index 0 (the periodization table default).
    const methodKeyFull = (ex.categoryName && ex.categoryName !== 'Uncategorized' && ex.categoryName !== '')
      ? `${methodKeyBase}::${ex.categoryName}`
      : methodKeyBase;

    const storedParams: Record<string, string | number> =
      (paramValues?.[mesocycleId]?.[microcycleIndex]?.[methodKeyFull]?.[0] as Record<string, string | number>) ||
      (paramValues?.[mesocycleId]?.[microcycleIndex]?.[methodKeyBase]?.[0] as Record<string, string | number>) ||
      {};

    if (Object.keys(storedParams).length === 0) {
      return { plannedSets: undefined, plannedParams: undefined, visibleParams: undefined, restParamName: undefined };
    }

    // Extract set count
    const setsKey = Object.keys(storedParams).find(k => /^sets?$/i.test(k));
    const plannedSets = setsKey && storedParams[setsKey] ? Number(storedParams[setsKey]) : undefined;

    // Get visible params from toolbox — strip ::suffix before lookup
    let visibleParams: string[] | undefined;
    if (toolboxEntries && baseMethodKey) {
      const vp = toolboxVisibleMap.get(baseMethodKey);
      if (vp && vp.length > 0) visibleParams = vp;
    }

    // Apply the coach's per-session visibility overrides (set via ParameterVisibilityPopover).
    // Key format matches WorkoutSessionSheet: workoutSessions_{mesoId}_{shiftedDate}_{sessionIdx}
    //
    // IMPORTANT: parameterVisibility is a DELTA relative to showInGridByDefault — it only
    // stores params where the coach changed from the toolbox default:
    //   { Tempo: true }  → Tempo was hidden by default, coach turned it ON
    //   { Organization: false } → Organization was visible by default, coach turned it OFF
    // Params absent from the record keep their toolbox default (showInGridByDefault).
    // We must apply overrides as a patch on top of visibleParams, not replace it entirely.
    try {
      const visKey = `workoutSessions_${mesocycleId}_${ex.dayDate}_${ex.sessionIndex}`;
      const storedVis = localStorage.getItem(visKey);
      if (storedVis) {
        const parsed = JSON.parse(storedVis) as { parameterVisibility?: Record<string, boolean> };
        const { parameterVisibility } = parsed;
        if (parameterVisibility && typeof parameterVisibility === 'object' && Object.keys(parameterVisibility).length > 0) {
          // Start with toolbox defaults as mutable base
          let base: string[] = visibleParams ? [...visibleParams] : [];
          for (const [param, visible] of Object.entries(parameterVisibility)) {
            if (visible && !base.includes(param)) {
              base.push(param);          // was hidden by default → turn on
            } else if (!visible) {
              base = base.filter(p => p !== param);  // was visible by default → turn off
            }
          }
          if (base.length > 0) visibleParams = base;
        }
      }
    } catch {
      // ignore — fall through with toolbox-derived visibleParams
    }

    // Get rest param name from toolbox
    const restParamName = toolboxRestMap.get(baseMethodKey);

    return {
      plannedSets,
      plannedParams: storedParams,
      visibleParams,
      restParamName,
    };
  }

  // Build rows — one per training day that has sessions
  const rows = trainingDays
    .filter(td => td.isTrainingDay && td.sessions > 0)
    .map(td => {
      const sessionCount = td.sessions;
      const sessions: SessionSummary[] = Array.from({ length: sessionCount }, (_, i) => {
        const exercisesForSession: ExerciseSummary[] = exercises
          .filter(ex => ex.dayDate === td.date && ex.sessionIndex === i)
          .sort((a, b) => a.order - b.order)
          .map(ex => {
            const { plannedSets, plannedParams, visibleParams, restParamName } = getPlannedParams(ex);

            // Section info
            let sectionName: string | undefined;
            let sectionOrder: number | undefined;
            if (ex.sectionId) {
              const secKey = `${ex.dayDate}-${i}-${ex.sectionId}`;
              const secInfo = sectionLookup.get(secKey);
              sectionName = secInfo?.name;
              sectionOrder = secInfo?.order;
            }

            return {
              id: ex.id,
              name: ex.exerciseName ?? ex.exerciseId,
              order: ex.order,
              sectionId: ex.sectionId,
              sectionName,
              sectionOrder,
              notes: ex.notes,
              isCircuit: ex.isCircuit,
              methodKey: ex.methodId,
              plannedSets,
              plannedParams,
              visibleParams,
              restParamName,
            };
          });

        // Read session notes (comments) from localStorage — same key used by WorkoutSessionSheet
        let sessionNotes: string | undefined;
        try {
          const mesoId = mesoByDate.get(td.date)?.mesocycleId;
          if (mesoId) {
            const metaKey = `workoutSessions_${mesoId}_${td.date}_${i}`;
            const stored = localStorage.getItem(metaKey);
            if (stored) {
              const parsed = JSON.parse(stored) as { comments?: string };
              if (parsed.comments && parsed.comments.trim()) {
                sessionNotes = parsed.comments.trim();
              }
            }
          }
        } catch { /* ignore */ }

        return {
          id: `${td.date}-${i}`,
          name: td.sessionNames?.[i] ?? `Session ${i + 1}`,
          order: i,
          exerciseCount: exercisesForSession.length,
          methodCount: 0,
          notes: sessionNotes,
          exercises: exercisesForSession,
        };
      });

      const meta = mesoByDate.get(td.date);
      return {
        athlete_connection_id: connectionId,
        date: td.date,
        intensity: td.intensity ?? null,
        sessions,
        program_name: programName,
        mesocycle_name: meta?.mesoName ?? null,
        microcycle_name: meta?.microName ?? null,
      };
    });

  // Delete all dates covered by trainingDays first so cleared days are removed.
  // This must happen even when rows is empty (full calendar clear case).
  const allDates = trainingDays.map(td => td.date);
  console.log(`[syncAthleteSchedule] plan: DELETE ${allDates.length} dates → UPSERT ${rows.length} training-day rows`);
  const DEL_BATCH = 200;
  for (let i = 0; i < allDates.length; i += DEL_BATCH) {
    const batch = allDates.slice(i, i + DEL_BATCH);
    const { error: delError } = await supabase
      .from('athlete_schedule')
      .delete()
      .eq('athlete_connection_id', connectionId)
      .in('date', batch);
    if (delError) {
      console.error(`[syncAthleteSchedule] ✗ DELETE error (code ${delError.code}):`, delError.message, delError.hint ?? '');
    } else {
      console.log(`[syncAthleteSchedule] ✓ DELETE batch: ${batch.length} dates`);
    }
  }

  if (rows.length === 0) {
    console.log(`[syncAthleteSchedule] ✓ cleared ${allDates.length} dates for connection ${connectionId}`);
    return;
  }

  // Upsert active training days (idempotent — handles retries and partial DELETE failures)
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('athlete_schedule')
      .upsert(batch, { onConflict: 'athlete_connection_id,date' });
    if (error) {
      console.error(`[syncAthleteSchedule] ✗ UPSERT error (code ${error.code}):`, error.message, error.hint ?? '');
      throw new Error(`athlete_schedule upsert failed: ${error.message} (code: ${error.code})`);
    } else {
      console.log(`[syncAthleteSchedule] ✓ UPSERT batch: ${batch.length} rows`);
    }
  }

  console.log(`[syncAthleteSchedule] ✓ done — ${rows.length} rows synced for connection ${connectionId}`);
}
