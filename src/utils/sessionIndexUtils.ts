// Minimal exercise interface for session index calculation
// This is more flexible than the full ExerciseDistribution type to accommodate
// different components that may have slightly different local interfaces
interface ExerciseForSessionIndex {
  id: string;
  exerciseId: string;
  methodId: string;
  categoryName?: string;
  dayDate: string;
  sessionIndex: number;
  order?: number;
}

/**
 * Calculate the chronological session index for an exercise within its method
 * across a microcycle. Exercises in the first training session containing the method
 * get index 0, those in the second session index 1, etc.
 * 
 * This is used to match exercises with split method parameters - when a method
 * has frequency > 1 and different parameters for each session, exercises are
 * assigned session parameters based on their chronological order in the microcycle.
 * 
 * @param exercise - The exercise to find the session index for
 * @param allExercises - All exercises in the microcycle
 * @param microcycleDates - Array of date strings in the microcycle
 * @returns The chronological session index (0 for first occurrence, 1 for second, etc.)
 */
export function getMethodSessionIndex(
  exercise: ExerciseForSessionIndex,
  allExercises: ExerciseForSessionIndex[],
  microcycleDates: string[]
): number {
  if (!exercise || !allExercises || allExercises.length === 0 || !microcycleDates || microcycleDates.length === 0) {
    return 0;
  }

  // Filter exercises with the same methodId and categoryName within the microcycle
  const sameMethodExercises = allExercises.filter(ex => {
    // Must be same method
    if (ex.methodId !== exercise.methodId) return false;
    
    // Must be same category (if category exists)
    const exCategory = ex.categoryName || '';
    const targetCategory = exercise.categoryName || '';
    if (exCategory !== targetCategory) return false;
    
    // Must be within the microcycle dates
    if (!microcycleDates.includes(ex.dayDate)) return false;
    
    return true;
  });

  if (sameMethodExercises.length <= 1) {
    return 0;
  }

  // The method's Nth session of the microcycle = the Nth distinct training session (day +
  // session index, chronological) containing the method. All exercises of the method within the
  // same session share that session's parameters — counting exercises instead would give the 2nd
  // exercise of a session the next session's values.
  const slotKey = (ex: { dayDate: string; sessionIndex: number }) => `${ex.dayDate}#${ex.sessionIndex}`;
  const slots = [...new Set(
    [...sameMethodExercises]
      .sort((a, b) => a.dayDate.localeCompare(b.dayDate) || a.sessionIndex - b.sessionIndex)
      .map(slotKey)
  )];

  return Math.max(0, slots.indexOf(slotKey(exercise)));
}

/**
 * Get the chronological session index modulo the number of defined sessions.
 * This handles cases where more exercises are allocated than there are session
 * parameter definitions (e.g., 3 exercises for a method with frequency 2).
 * 
 * @param chronologicalIndex - The raw chronological index from getMethodSessionIndex
 * @param sessionCount - The number of defined sessions (frequency)
 * @returns The modulo session index to use for parameter lookup
 */
export function getModuloSessionIndex(
  chronologicalIndex: number,
  sessionCount: number
): number {
  if (sessionCount <= 0) return 0;
  return chronologicalIndex % sessionCount;
}
