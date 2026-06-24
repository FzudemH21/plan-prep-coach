/**
 * exerciseDetailSync
 *
 * When the coach updates an exercise's video URL or description in the library,
 * propagates those changes to all athlete_schedule rows that reference the exercise
 * via ExerciseSummary.exerciseLibraryId (top-level exercises) or
 * CircuitExerciseSummary.exerciseId (circuit sub-exercises).
 *
 * Fire-and-forget — errors are swallowed so the UI save is never blocked.
 */
import { supabase } from '@/lib/supabase';
import type { ExerciseSummary, CircuitExerciseSummary, SessionSummary } from '@/utils/athleteScheduleSync';

export async function syncExerciseDetailToSchedule(
  exerciseId: string,
  videoUrl: string | undefined,
  description: string | undefined,
): Promise<void> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    // Get all athlete connections for this coach
    const { data: connections } = await supabase
      .from('athlete_connections')
      .select('id')
      .eq('coach_user_id', authData.user.id);

    if (!connections?.length) return;
    const connectionIds = connections.map(c => c.id as string);

    // Fetch all schedule rows — only the columns we need
    const { data: rows } = await supabase
      .from('athlete_schedule')
      .select('athlete_connection_id, date, sessions')
      .in('athlete_connection_id', connectionIds);

    if (!rows?.length) return;

    type ScheduleRow = { athlete_connection_id: string; date: string; sessions: SessionSummary[] };

    const toUpdate: ScheduleRow[] = [];

    for (const row of rows as ScheduleRow[]) {
      let modified = false;

      const sessions = row.sessions.map(session => ({
        ...session,
        exercises: session.exercises.map(ex => {
          const exTyped = ex as ExerciseSummary;

          // Circuit: patch matching sub-exercises
          if (exTyped.isCircuit && exTyped.circuitExercises?.length) {
            let circuitModified = false;
            const newCircuitExercises = exTyped.circuitExercises.map((cex: CircuitExerciseSummary) => {
              if (cex.exerciseId === exerciseId) {
                circuitModified = true;
                return { ...cex, exerciseVideoUrl: videoUrl, exerciseDescription: description };
              }
              return cex;
            });
            if (circuitModified) {
              modified = true;
              return { ...exTyped, circuitExercises: newCircuitExercises };
            }
          }

          // Top-level exercise
          if (exTyped.exerciseLibraryId === exerciseId) {
            modified = true;
            return { ...exTyped, exerciseVideoUrl: videoUrl, exerciseDescription: description };
          }

          return ex;
        }),
      }));

      if (modified) {
        toUpdate.push({ ...row, sessions });
      }
    }

    if (toUpdate.length === 0) return;

    const BATCH = 200;
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const { error } = await supabase
        .from('athlete_schedule')
        .upsert(toUpdate.slice(i, i + BATCH), { onConflict: 'athlete_connection_id,date' });
      if (error) {
        console.warn('[exerciseDetailSync] upsert error:', error.message);
      }
    }

    console.log(`[exerciseDetailSync] patched ${toUpdate.length} schedule row(s) for exercise ${exerciseId}`);
  } catch (err) {
    // Non-fatal — library save already succeeded
    console.warn('[exerciseDetailSync] failed (non-fatal):', err);
  }
}
