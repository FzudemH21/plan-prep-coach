/**
 * athleteScheduleSync
 *
 * Populates the athlete_schedule Supabase table from the shifted assignment data
 * produced during plan assignment. Called after handleAssignProgram writes to
 * localStorage, so the athlete app can read sessions directly from Supabase.
 */
import { supabase } from '@/lib/supabase';
import { AthleteCalendarAssignment } from '@/types/athlete';

interface TrainingDay {
  date: string;
  intensity: string;
  sessions: number;
  sessionNames?: string[];
  isTrainingDay: boolean;
  mesocycleId?: string;
  microcycleId?: string;
}

export interface ExerciseSummary {
  id: string;
  name: string;
  order: number;
  sectionId?: string;
  notes?: string;
  isCircuit?: boolean;
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
  dayDate: string;
  sessionIndex: number;
  order: number;
  sectionId?: string;
  notes?: string;
  isCircuit?: boolean;
  [key: string]: unknown;
}

export async function syncAthleteSchedule(
  connectionId: string,
  assignment: AthleteCalendarAssignment,
  trainingDays: TrainingDay[],
  exercises: ExerciseEntry[],
  programName: string,
): Promise<void> {
  if (!connectionId || trainingDays.length === 0) return;

  // Build a lookup: date → mesocycle/microcycle name
  const mesoByDate = new Map<string, { mesoName: string; microName: string | null }>();
  for (const meso of assignment.assignedMesocycles) {
    for (const micro of meso.microcycles || []) {
      // Compute dates covered by this microcycle
      const start = new Date(meso.startDate + 'T12:00:00');
      let microStart = new Date(start);
      // Find offset of this micro within the meso
      let offset = 0;
      for (const m of meso.microcycles) {
        if (m.id === micro.id) break;
        offset += m.duration;
      }
      microStart = new Date(start.getTime() + offset * 86400000);
      for (let d = 0; d < micro.duration; d++) {
        const day = new Date(microStart.getTime() + d * 86400000);
        const dateStr = day.toISOString().slice(0, 10);
        mesoByDate.set(dateStr, { mesoName: meso.name, microName: micro.name ?? null });
      }
    }
    // Fallback if no microcycles: cover full meso range
    if (!meso.microcycles?.length) {
      const start = new Date(meso.startDate + 'T12:00:00');
      const end = new Date(meso.endDate + 'T12:00:00');
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
        const dateStr = d.toISOString().slice(0, 10);
        mesoByDate.set(dateStr, { mesoName: meso.name, microName: null });
      }
    }
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
          .map(ex => ({
            id: ex.id,
            name: ex.exerciseName ?? ex.exerciseId,
            order: ex.order,
            sectionId: ex.sectionId,
            notes: ex.notes,
            isCircuit: ex.isCircuit,
          }));

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

  if (rows.length === 0) return;

  // Upsert in batches of 200 (Supabase row limit per request)
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('athlete_schedule')
      .upsert(batch, { onConflict: 'athlete_connection_id,date' });
    if (error) {
      console.error('[athleteScheduleSync] upsert error:', error.message);
    }
  }

  console.log(`[athleteScheduleSync] synced ${rows.length} days for connection ${connectionId}`);
}
