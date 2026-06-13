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
import type { CalendarEvent } from '@/hooks/useCalendarEvents';

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
export interface CircuitExerciseSummary {
  id: string;
  /** Library exercise ID — used to look up video/description at sync time. */
  exerciseId?: string;
  exerciseName: string;
  reps: string;
  time?: string;
  distance?: string;
  enabledParams?: string[];
  order: number;
  /** Video URL snapshotted from the library at sync time. */
  exerciseVideoUrl?: string;
  /** Description snapshotted from the library at sync time. */
  exerciseDescription?: string;
}

export interface ExerciseSummary {
  id: string;
  name: string;
  order: number;
  sectionId?: string;
  sectionName?: string;
  sectionOrder?: number;
  sectionNotes?: string;
  notes?: string;
  isCircuit?: boolean;
  supersetId?: string;       // shared key for all exercises in the same superset group
  /** Library exercise ID — kept for reference. */
  exerciseLibraryId?: string;
  /** Video URL snapshotted from the library at sync time. */
  exerciseVideoUrl?: string;
  /** Description snapshotted from the library at sync time. */
  exerciseDescription?: string;
  // Circuit-specific fields — populated when isCircuit is true
  circuitRounds?: string;
  circuitRestBetweenRounds?: string;
  circuitRestBetweenExercises?: string;
  circuitComments?: string;
  circuitExercises?: CircuitExerciseSummary[];
  // Planned values from the periodization table
  methodKey?: string;
  plannedSets?: number;
  plannedParams?: Record<string, string | number>;  // flat planned params (Reps_set1, etc.)
  visibleParams?: string[];  // param names the coach marked showInAthleteApp
  restParamName?: string;    // name of the rest/pause parameter for this exercise's method
  /** True when the coach ticked "Each side" — athlete performs the exercise on each side separately */
  eachSide?: boolean;
  /** True when plannedParams were directly edited on the mobile coach app.
   *  Exercises with this flag have their plannedParams preserved across plan syncs
   *  (syncAthleteSchedule will not overwrite them). */
  mobileEdited?: boolean;
  /** True when the exercise was added on the mobile coach app (not in the plan).
   *  Re-appended to the session after each plan sync so they survive desktop resyncs. */
  mobileAdded?: boolean;
}

export interface SessionSummary {
  id: string;
  name: string;
  order: number;
  exerciseCount: number;
  methodCount: number;
  duration?: number;
  notes?: string;
  intensity?: string;   // session-level planned intensity
  exercises: ExerciseSummary[];
  /** Set when a coach moves this session to a different day on mobile.
   *  syncAthleteSchedule reads this flag before DELETE/UPSERT and re-applies the
   *  rearrangement so plan re-syncs from the desktop don't revert mobile moves. */
  mobileRearranged?: boolean;
  /** The plan date this session originally lived on (before any mobile rearrangement). */
  originalDate?: string;
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

// SupersetMapping mirrors the type in microcycle-planning.ts (avoided circular import)
type SupersetMapping = Record<string, Record<number, Record<string, Record<string, string[]>>>>;

// ── Library exercise detail lookup ───────────────────────────────────────────

type ExerciseDetailMap = Map<string, { videoUrl?: string; description?: string }>;

async function buildExerciseDetailMap(userId: string): Promise<ExerciseDetailMap> {
  const map: ExerciseDetailMap = new Map();
  try {
    const { data: libRow } = await supabase
      .from('custom_libraries')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();

    if (!libRow?.data) return map;

    const libData = libRow.data as {
      libraries?: Array<{
        columns?: Array<{ id: string; role?: string }>;
        exercises?: Array<{
          id: string;
          videoUrl?: string;
          description?: string;
          data?: Record<string, unknown>;
        }>;
      }>;
    };

    for (const lib of libData.libraries ?? []) {
      const videoCol = lib.columns?.find(c => c.role === 'video');
      const descCol  = lib.columns?.find(c => c.role === 'description');

      for (const ex of lib.exercises ?? []) {
        // Primary: top-level fields (set by detail modal)
        let videoUrl    = ex.videoUrl   ?? undefined;
        let description = ex.description ?? undefined;

        // Fallback: inline cell edit stores value in exercise.data[columnId]
        if (!videoUrl && videoCol) {
          const v = ex.data?.[videoCol.id];
          if (typeof v === 'string' && v) videoUrl = v;
        }
        if (!description && descCol) {
          const d = ex.data?.[descCol.id];
          if (typeof d === 'string' && d) description = d;
        }

        if (videoUrl || description) map.set(ex.id, { videoUrl, description });
      }
    }
  } catch {
    // ignore — exercise detail is optional enrichment
  }
  return map;
}

/** CalendarEvent enriched with the parameter unit, resolved at call time. */
export type SyncCalendarEvent = CalendarEvent & { unit?: string };

export async function syncAthleteSchedule(
  connectionId: string,
  assignment: AthleteCalendarAssignment,
  trainingDays: TrainingDay[],
  exercises: ExerciseEntry[],
  programName: string,
  paramValues?: ParamValues,
  sessionSections?: SessionSectionEntry[],
  toolboxEntries?: ToolboxEntry[],
  supersets?: SupersetMapping,
  sessionIntensities?: Record<string, string>,
  calendarEvents?: SyncCalendarEvent[],
): Promise<void> {
  if (!connectionId || trainingDays.length === 0) return;

  console.log(`[syncAthleteSchedule] ▶ start | connectionId=${connectionId} | trainingDays=${trainingDays.length} | exercises=${exercises.length} | paramKeys=${Object.keys(paramValues ?? {}).length}`);

  // Fetch exercise video/description from the coach's library (coach is the authenticated user here)
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  const exerciseDetails = coachUser
    ? await buildExerciseDetailMap(coachUser.id)
    : new Map<string, { videoUrl?: string; description?: string }>();
  console.log(`[syncAthleteSchedule] exercise detail map: ${exerciseDetails.size} entries`);

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

  // Build section lookup: "dayDate-sessionIndex-sectionId" → { name, order, notes }
  const sectionLookup = new Map<string, { name: string; order: number; notes?: string }>();
  if (sessionSections) {
    for (const sec of sessionSections) {
      const key = `${sec.dayDate}-${sec.sessionIndex}-${sec.id}`;
      sectionLookup.set(key, { name: sec.name, order: sec.order, notes: (sec as any).comments ?? undefined });
    }
  }

  // Build superset lookup: exerciseId → supersetGroupId
  // SupersetMapping shape: { dayDate: { sessionIndex: { sectionId: { supersetId: exerciseId[] } } } }
  const supersetLookup = new Map<string, string>();
  if (supersets) {
    for (const [dayDate, bySession] of Object.entries(supersets)) {
      for (const [sessionIdxStr, bySection] of Object.entries(bySession)) {
        for (const [_sectionId, groups] of Object.entries(bySection)) {
          for (const [supersetId, exerciseIds] of Object.entries(groups)) {
            for (const exId of exerciseIds) {
              // Key: "dayDate-sessionIndex-exerciseId" to avoid collisions across days/sessions
              supersetLookup.set(`${dayDate}-${sessionIdxStr}-${exId}`, supersetId);
            }
          }
        }
      }
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
      // Track rest parameter name for this method key.
      // Use the explicit flag first; fall back to name heuristic for legacy toolbox entries
      // where isRestParameter was not set (e.g. tagged only as isSetParameter before the fix).
      const REST_NAME = /rest|pause|recovery/i;
      if (entry.isRestParameter || REST_NAME.test(entry.parameterName)) {
        toolboxRestMap.set(key, entry.parameterName);
      }
      // Include all params that are shown in the grid by default (per toolbox config).
      // Qualitative params and rest params are intentionally kept here — the coach app
      // shows them in the session grid and the athlete app should match.
      // Frequency and true set-count params are structural so always excluded.
      // Rest params are excluded from athlete column display inside getParamColumns instead.
      if (!entry.showInGridByDefault || entry.isFrequencyParameter) continue;
      if (entry.isSetParameter && !entry.isRestParameter && !REST_NAME.test(entry.parameterName)) continue;
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
    // Priority: session-specific index first (training-calendar overrides written by
    // handleSaveParameters), then session 0 (periodization-table baseline shared across sessions).
    const methodKeyFull = (ex.categoryName && ex.categoryName !== 'Uncategorized' && ex.categoryName !== '')
      ? `${methodKeyBase}::${ex.categoryName}`
      : methodKeyBase;

    const sessionIdx = ex.sessionIndex ?? 0;

    const storedParams: Record<string, string | number> =
      (paramValues?.[mesocycleId]?.[microcycleIndex]?.[methodKeyFull]?.[sessionIdx] as Record<string, string | number>) ||
      (paramValues?.[mesocycleId]?.[microcycleIndex]?.[methodKeyBase]?.[sessionIdx] as Record<string, string | number>) ||
      // Fall back to session 0 (periodization-table baseline) if no session-specific data yet
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

  // Build events-by-date lookup
  const eventsByDate = new Map<string, Array<{ id: string; type: string; title: string; notes?: string; targetValue?: string; unit?: string; parameterId?: string }>>();
  for (const ev of calendarEvents ?? []) {
    if (!eventsByDate.has(ev.date)) eventsByDate.set(ev.date, []);
    eventsByDate.get(ev.date)!.push({
      id: ev.id,
      type: ev.type,
      title: ev.title,
      notes: ev.notes,
      targetValue: ev.targetValue,
      unit: ev.unit,
      parameterId: ev.parameterId,
    });
  }

  // Build rows — one per training day that has sessions
  const trainingDayDates = new Set(trainingDays.map(td => td.date));
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
            let sectionNotes: string | undefined;
            if (ex.sectionId) {
              const secKey = `${ex.dayDate}-${i}-${ex.sectionId}`;
              const secInfo = sectionLookup.get(secKey);
              sectionName = secInfo?.name;
              sectionOrder = secInfo?.order;
              sectionNotes = secInfo?.notes;
            }

            // Use the same ID logic as buildSectionsFromExercises so IDs match
            // when the desktop applies mobile coach param overrides.
            const exerciseId = ex.id || ex.exerciseId;

            // Look up superset group for this exercise
            const supersetId = supersetLookup.get(`${ex.dayDate}-${i}-${exerciseId}`);

            return {
              id: exerciseId,
              name: ex.exerciseName ?? ex.exerciseId,
              order: ex.order,
              sectionId: ex.sectionId,
              sectionName,
              sectionOrder,
              sectionNotes,
              notes: ex.notes,
              isCircuit: ex.isCircuit,
              supersetId,
              // Library ID + snapshotted detail (undefined for circuits)
              exerciseLibraryId: ex.isCircuit ? undefined : ex.exerciseId,
              exerciseVideoUrl: ex.isCircuit ? undefined : exerciseDetails.get(ex.exerciseId)?.videoUrl,
              exerciseDescription: ex.isCircuit ? undefined : exerciseDetails.get(ex.exerciseId)?.description,
              // Circuit-specific fields
              circuitRounds: ex.isCircuit ? (ex.circuitRounds as string | undefined) : undefined,
              circuitRestBetweenRounds: ex.isCircuit ? (ex.circuitRestBetweenRounds as string | undefined) : undefined,
              circuitRestBetweenExercises: ex.isCircuit ? (ex.circuitRestBetweenExercises as string | undefined) : undefined,
              circuitComments: ex.isCircuit ? (ex.circuitComments as string | undefined) : undefined,
              circuitExercises: ex.isCircuit
                ? ((ex.circuitExercises as (CircuitExerciseSummary & { exerciseId?: string })[] | undefined)
                    ?.map(cex => ({
                      ...cex,
                      exerciseVideoUrl: cex.exerciseId ? exerciseDetails.get(cex.exerciseId)?.videoUrl : undefined,
                      exerciseDescription: cex.exerciseId ? exerciseDetails.get(cex.exerciseId)?.description : undefined,
                    })))
                : undefined,
              methodKey: ex.methodId,
              plannedSets,
              plannedParams,
              visibleParams,
              restParamName,
              eachSide: ex.eachSide ?? false,
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

        // Use full assignment ID so sessions from different plan assignments never
        // share the same ID, AND so the ID matches what the coach calendar builds
        // (${assignment.id}-${date}-${sessionIdx}) for session-log lookups.
        return {
          id: `${assignment.id}-${td.date}-${i}`,
          name: td.sessionNames?.[i] ?? `Session ${i + 1}`,
          order: i,
          exerciseCount: exercisesForSession.length,
          methodCount: 0,
          notes: sessionNotes,
          intensity: sessionIntensities?.[`${td.date}-${i}`] ?? (td.intensity || undefined),
          exercises: exercisesForSession,
        };
      });

      const meta = mesoByDate.get(td.date);
      return {
        athlete_connection_id: connectionId,
        date: td.date,
        intensity: td.intensity ?? null,
        sessions,
        events: eventsByDate.get(td.date) ?? [],
        program_name: programName,
        mesocycle_name: meta?.mesoName ?? null,
        microcycle_name: meta?.microName ?? null,
      };
    });

  // Append event-only rows for dates that have events but no training session row.
  // This ensures tests/events on rest days are visible in the athlete app.
  for (const [evDate, evList] of eventsByDate) {
    if (trainingDayDates.has(evDate)) continue; // already included above
    const meta = mesoByDate.get(evDate);
    rows.push({
      athlete_connection_id: connectionId,
      date: evDate,
      intensity: null,
      sessions: [],
      events: evList,
      program_name: programName,
      mesocycle_name: meta?.mesoName ?? null,
      microcycle_name: meta?.microName ?? null,
    });
  }

  // Delete all dates covered by trainingDays OR calendarEvents first so cleared days are removed.
  // This must happen even when rows is empty (full calendar clear case).
  const allDates = [
    ...trainingDays.map(td => td.date),
    ...[...eventsByDate.keys()].filter(d => !trainingDayDates.has(d)),
  ];

  // ── Preserve mobile-edited content AND mobile-added exercises ───────────────
  // Before deleting rows, read existing athlete_schedule data and collect:
  //   1. exercises flagged mobileEdited: true  → preserve their full content
  //      (plannedParams, notes, sectionNotes, visibleParams, etc.)
  //   2. exercises flagged mobileAdded: true   → re-append after sync (not in plan)
  //   3. day-level intensity                   → preserved per date
  //   4. session-level intensity               → preserved per date+sessionIdx
  //   5. session-level notes                   → preserved per date+sessionIdx
  const mobileParamsMap = new Map<string, Map<string, ExerciseSummary>>();
  // mobileAddedMap: date → sessionOrder → exercises[]
  const mobileAddedMap = new Map<string, Map<number, ExerciseSummary[]>>();
  // Day-level intensity: date → intensity string
  const mobileDayIntensityMap = new Map<string, string>();
  // Session-level intensity + notes: `${date}-${sIdx}` → { intensity?, notes? }
  const mobileSessionMetaMap = new Map<string, { intensity?: string; notes?: string }>();
  // Sessions repositioned by the mobile coach app: { targetDate, session }
  const rearrangedSessions: Array<{ targetDate: string; session: SessionSummary }> = [];
  // Full existing sessions per date — ground truth for rearranged dates
  const existingSessionsMap = new Map<string, SessionSummary[]>();
  try {
    if (allDates.length > 0) {
      // Fetch ALL rows within the plan's date range — not just plan dates.
      // This is critical for detecting mobileRearranged sessions on rest days:
      // those dates are not in allDates (no plan sessions or events), so an
      // allDates-scoped .in() query would miss them, leaving rearrangedSessions
      // empty and causing the locked-dates logic to skip the rearrangement.
      const minDate = allDates.reduce((a, b) => a < b ? a : b);
      const maxDate = allDates.reduce((a, b) => a > b ? a : b);
      const { data: existingData } = await supabase
        .from('athlete_schedule')
        .select('date, intensity, sessions')
        .eq('athlete_connection_id', connectionId)
        .gte('date', minDate)
        .lte('date', maxDate);
      if (existingData) {
        for (const row of existingData as Array<{ date: string; intensity?: string | null; sessions: SessionSummary[] }>) {
          // Preserve day-level intensity if set
          if (row.intensity) mobileDayIntensityMap.set(row.date, row.intensity);

          const exMap = new Map<string, ExerciseSummary>();
          for (let sIdx = 0; sIdx < (row.sessions ?? []).length; sIdx++) {
            const session = row.sessions[sIdx];

            // Preserve session-level intensity and notes
            const sessionMeta: { intensity?: string; notes?: string } = {};
            if (session.intensity) sessionMeta.intensity = session.intensity;
            if (session.notes) sessionMeta.notes = session.notes;
            if (sessionMeta.intensity || sessionMeta.notes) {
              mobileSessionMetaMap.set(`${row.date}-${sIdx}`, sessionMeta);
            }

            // Collect sessions repositioned on the mobile coach app
            if ((session as SessionSummary).mobileRearranged) {
              rearrangedSessions.push({ targetDate: row.date, session: session as SessionSummary });
            }

            const addedExs: ExerciseSummary[] = [];
            for (const ex of (session.exercises ?? [])) {
              const exTyped = ex as ExerciseSummary;
              // Collect mobileEdited exercises for preservation (full object, not just params).
              // This preserves plannedParams, notes, sectionNotes, visibleParams, etc.
              if (exTyped.mobileEdited) {
                // Key by both the stored exercise id AND the stable library id so that
                // the lookup succeeds even when ExerciseDistribution.id has changed
                // (e.g. after the AI re-adds exercises with a new dist-ai-… id).
                exMap.set(exTyped.id, exTyped);
                const libId = exTyped.exerciseLibraryId;
                if (libId) exMap.set(libId, exTyped);
              }
              // Collect mobileAdded exercises for re-appending
              if (exTyped.mobileAdded) {
                addedExs.push(exTyped);
              }
            }
            if (addedExs.length > 0) {
              if (!mobileAddedMap.has(row.date)) mobileAddedMap.set(row.date, new Map());
              mobileAddedMap.get(row.date)!.set(sIdx, addedExs);
            }
          }
          if (exMap.size > 0) mobileParamsMap.set(row.date, exMap);
          // Store full session array so the rearrangement logic can restore it
          existingSessionsMap.set(row.date, (row.sessions ?? []) as SessionSummary[]);
        }
      }
    }
  } catch {
    // Non-fatal — if we can't read existing data, proceed without preserving.
  }

  // Apply preserved mobile params on top of the newly computed rows.
  if (mobileParamsMap.size > 0) {
    for (const row of rows) {
      const exMap = mobileParamsMap.get(row.date);
      if (!exMap) continue;
      row.sessions = row.sessions.map(session => ({
        ...session,
        exercises: session.exercises.map(ex => {
          // Try primary id first, then fall back to the stable library id.
          const preserved = exMap.get(ex.id)
            ?? exMap.get((ex as ExerciseSummary).exerciseLibraryId ?? '');
          if (!preserved) return ex;
          // Restore content fields edited on mobile while keeping structural fields
          // (sectionId, name, order, methodKey, etc.) from the freshly computed plan.
          return {
            ...ex,
            plannedParams: preserved.plannedParams ?? ex.plannedParams,
            visibleParams: preserved.visibleParams ?? ex.visibleParams,
            notes: preserved.notes,
            sectionNotes: preserved.sectionNotes ?? ex.sectionNotes,
            mobileEdited: true,
          };
        }),
      }));
    }
    console.log(`[syncAthleteSchedule] preserved mobile edits for ${mobileParamsMap.size} dates`);
  }

  // Re-append mobile-added exercises (coach added them via mobile — not in the plan).
  if (mobileAddedMap.size > 0) {
    for (const row of rows) {
      const bySession = mobileAddedMap.get(row.date);
      if (!bySession) continue;
      row.sessions = row.sessions.map((session, sIdx) => {
        const addedExs = bySession.get(sIdx) ?? [];
        if (addedExs.length === 0) return session;
        return {
          ...session,
          exercises: [...session.exercises, ...addedExs],
          exerciseCount: session.exerciseCount + addedExs.length,
        };
      });
    }
    console.log(`[syncAthleteSchedule] re-appended mobile-added exercises for ${mobileAddedMap.size} dates`);
  }

  // Apply preserved day-level and session-level intensities / notes from mobile.
  // These are overwritten by the plan rebuild above, so re-apply them here.
  if (mobileDayIntensityMap.size > 0 || mobileSessionMetaMap.size > 0) {
    for (const row of rows) {
      // Day intensity
      const preservedDayIntensity = mobileDayIntensityMap.get(row.date);
      if (preservedDayIntensity) row.intensity = preservedDayIntensity;

      // Session intensity + notes
      if (mobileSessionMetaMap.size > 0) {
        row.sessions = row.sessions.map((session, sIdx) => {
          const meta = mobileSessionMetaMap.get(`${row.date}-${sIdx}`);
          if (!meta) return session;
          return {
            ...session,
            ...(meta.intensity ? { intensity: meta.intensity } : {}),
            ...(meta.notes ? { notes: meta.notes } : {}),
          };
        });
      }
    }
    console.log(`[syncAthleteSchedule] preserved mobile intensities/notes for ${mobileDayIntensityMap.size} dates`);
  }

  // ── Apply mobile session rearrangements ──────────────────────────────────────
  // Sessions dragged between days on mobile carry mobileRearranged: true.
  //
  // Rather than patching plan rows (which creates duplicates when the target date
  // already has plan sessions with the same name), we instead use the existing
  // athlete_schedule data as the ground truth for every date involved in a
  // rearrangement.  This avoids the "copy" problem entirely.
  //
  // Delete-takes-precedence: if a rearranged session was deleted from the plan on
  // the desktop, we skip the rearrangement so the plan deletion wins.
  if (rearrangedSessions.length > 0) {
    console.log(`[syncAthleteSchedule] processing ${rearrangedSessions.length} session rearrangement(s)`);

    const lockedDates = new Set<string>();

    for (const { targetDate, session } of rearrangedSessions) {
      // Check if the session still exists in the plan (it might have been deleted
      // on the desktop).  We look for the session ID in the plan row for its
      // original date BEFORE any modification.
      const stillInPlan = session.originalDate
        ? (rows.find(r => r.date === session.originalDate)
               ?.sessions.some(s => s.id === session.id) ?? false)
        : false;

      if (!stillInPlan) {
        console.log(`[syncAthleteSchedule] session ${session.id} no longer in plan — skipping rearrangement (plan delete takes precedence)`);
        continue;
      }

      lockedDates.add(targetDate);
      if (session.originalDate) lockedDates.add(session.originalDate);
    }

    // For each locked date, replace the plan-computed sessions with the existing
    // athlete_schedule sessions (written by the mobile drag).  This is the last
    // step before DELETE/UPSERT so it overwrites any plan reconstruction.
    for (const lockedDate of lockedDates) {
      const existingSessions = existingSessionsMap.get(lockedDate);
      if (existingSessions === undefined) continue; // date not in athlete_schedule — skip

      const planRow = rows.find(r => r.date === lockedDate);
      if (planRow) {
        planRow.sessions = existingSessions;
        console.log(`[syncAthleteSchedule] locked ${lockedDate}: using existing ${existingSessions.length} session(s) from athlete_schedule`);
      } else if (existingSessions.length > 0) {
        // Rearrangement target was a rest day — create a row so the UPSERT covers it
        const meta = mesoByDate.get(lockedDate);
        rows.push({
          athlete_connection_id: connectionId,
          date: lockedDate,
          intensity: null,
          sessions: existingSessions,
          events: eventsByDate.get(lockedDate) ?? [],
          program_name: programName,
          mesocycle_name: meta?.mesoName ?? null,
          microcycle_name: meta?.microName ?? null,
        });
        if (!allDates.includes(lockedDate)) allDates.push(lockedDate);
        console.log(`[syncAthleteSchedule] locked ${lockedDate}: created rest-day row with ${existingSessions.length} session(s)`);
      }
    }

    if (lockedDates.size > 0) {
      console.log(`[syncAthleteSchedule] locked ${lockedDates.size} date(s) to mobile arrangement`);
    }
  }

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
