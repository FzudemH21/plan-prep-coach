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
 * across a microcycle. The first occurrence of a method's exercise gets index 0,
 * the second gets index 1, etc.
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

  // Sort by chronological order: dayDate ASC, sessionIndex ASC, order ASC
  const sorted = [...sameMethodExercises].sort((a, b) => {
    // First sort by date
    const dateCompare = a.dayDate.localeCompare(b.dayDate);
    if (dateCompare !== 0) return dateCompare;
    
    // Then by session index within the day
    const sessionCompare = a.sessionIndex - b.sessionIndex;
    if (sessionCompare !== 0) return sessionCompare;
    
    // Finally by order within the session
    return (a.order ?? 0) - (b.order ?? 0);
  });

  // Find this exercise's position using id OR exerciseId (since id may be undefined)
  const exerciseLookupId = exercise.id || exercise.exerciseId;
  const position = sorted.findIndex(ex => {
    const exLookupId = ex.id || ex.exerciseId;
    return exLookupId === exerciseLookupId && 
           ex.dayDate === exercise.dayDate && 
           ex.sessionIndex === exercise.sessionIndex;
  });
  
  return Math.max(0, position);
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
