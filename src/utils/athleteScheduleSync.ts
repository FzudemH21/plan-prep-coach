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

  console.log(`[syncAthleteSchedule] ▶ start | connectionId=${connectionId} | trainingDays=${trainingDays.length} | exercises=${exercises.length}`);

  // Build a lookup: date → mesocycle/microcycle name + ids
  const mesoByDate = new Map<string, {
    mesoName: string;
    microName: string | null;
    mesocycleId: string;
    microcycleIndex: number;
  }>();
  for (const meso of assignment.assignedMesocycles) {
    const start = new Date(meso.startDate + 'T12:00:00');
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
      const startD = new Date(meso.startDate + 'T12:00:00');
      const endD = new Date(meso.endDate + 'T12:00:00');
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
  const toolboxVisibleMap = new Map<string, string[]>();
  if (toolboxEntries) {
    const grouped = new Map<string, string[]>();
    for (const entry of toolboxEntries) {
      if (entry.showInGridByDefault === false || entry.isFrequencyParameter || entry.isSetParameter) continue;
      const key = entry.subCategory
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(entry.parameterName);
    }
    for (const [k, v] of grouped) toolboxVisibleMap.set(k, v);
  }

  // Helper: get planned params for an exercise
  function getPlannedParams(ex: ExerciseEntry): {
    plannedSets: number | undefined;
    plannedParams: Record<string, string | number> | undefined;
    visibleParams: string[] | undefined;
  } {
    if (!paramValues) return { plannedSets: undefined, plannedParams: undefined, visibleParams: undefined };

    const meta = mesoByDate.get(ex.dayDate);
    if (!meta) return { plannedSets: undefined, plannedParams: undefined, visibleParams: undefined };

    const { mesocycleId, microcycleIndex } = meta;
    const methodKey = ex.methodId ?? '';

    // Try to find stored params — same fallback chain as WorkoutSessionSheet
    const storedParams: Record<string, string | number> =
      (paramValues?.[mesocycleId]?.[microcycleIndex]?.[methodKey]?.[0] as Record<string, string | number>) ||
      {};

    if (Object.keys(storedParams).length === 0) {
      return { plannedSets: undefined, plannedParams: undefined, visibleParams: undefined };
    }

    // Extract set count
    const setsKey = Object.keys(storedParams).find(k => /^sets?$/i.test(k));
    const plannedSets = setsKey && storedParams[setsKey] ? Number(storedParams[setsKey]) : undefined;

    // Get visible params from toolbox
    let visibleParams: string[] | undefined;
    if (toolboxEntries && methodKey) {
      const vp = toolboxVisibleMap.get(methodKey);
      if (vp && vp.length > 0) visibleParams = vp;
    }

    return {
      plannedSets,
      plannedParams: storedParams,
      visibleParams,
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
            const { plannedSets, plannedParams, visibleParams } = getPlannedParams(ex);

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
            };
          });

        return {
          id: `${td.date}-${i}`,
          name: td.sessionNames?.[i] ?? `Session ${i + 1}`,
          order: i,
          exerciseCount: exercisesForSession.length,
          methodCount: 0,
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
