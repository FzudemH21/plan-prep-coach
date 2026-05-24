import { differenceInDays, addDays, format, parseISO } from 'date-fns';
import { AssignedMesocycle } from '@/types/athlete';
import { ExerciseDistribution, SessionSection, SupersetMapping } from '@/types/microcycle-planning';
import { DailyIntensity } from '@/types/daily-intensity';

/**
 * Normalizes a date to UTC midnight to ensure consistent day-based calculations.
 * This eliminates timezone-related off-by-one errors when calculating day offsets.
 */
function normalizeToUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Calculates the day offset between original and new start dates.
 * Both dates are normalized to UTC midnight to ensure accurate day-based offset
 * regardless of the user's timezone.
 */
export function calculateDayOffset(originalStartDate: Date, newStartDate: Date): number {
  const normalizedOriginal = normalizeToUTCMidnight(originalStartDate);
  const normalizedNew = normalizeToUTCMidnight(newStartDate);
  return differenceInDays(normalizedNew, normalizedOriginal);
}

/**
 * Shifts all dates in mesocycle data to a new start date
 * @param mesocycles - Array of mesocycles with original dates
 * @param newStartDate - The new start date for the assignment
 * @returns Mesocycles with all dates shifted
 */
export function shiftMesocycleDates(
  mesocycles: AssignedMesocycle[],
  newStartDate: Date
): AssignedMesocycle[] {
  if (mesocycles.length === 0) return mesocycles;
  
  const originalStartDate = new Date(mesocycles[0].startDate);
  const dayOffset = calculateDayOffset(originalStartDate, newStartDate);
  
  return mesocycles.map(meso => ({
    ...meso,
    startDate: addDays(new Date(meso.startDate), dayOffset).toISOString(),
    endDate: addDays(new Date(meso.endDate), dayOffset).toISOString(),
    // Microcycles store duration in days, not absolute dates
    // So they don't need shifting
  }));
}

/**
 * Calculates the total duration of selected mesocycles in days
 */
export function calculateTotalDuration(mesocycles: AssignedMesocycle[]): number {
  return mesocycles.reduce((total, meso) => total + meso.duration, 0);
}

/**
 * Calculates the end date based on start date and total duration
 */
export function calculateEndDate(startDate: Date, totalDays: number): Date {
  return addDays(startDate, totalDays - 1);
}

/**
 * Filters mesocycles to only include selected ones
 */
export function filterMesocycles(
  mesocycles: AssignedMesocycle[],
  selectedMesocycleIds: string[]
): AssignedMesocycle[] {
  if (selectedMesocycleIds.length === 0) return mesocycles;
  return mesocycles.filter(meso => selectedMesocycleIds.includes(meso.id));
}

/**
 * Filters microcycles within mesocycles to only include selected ones
 */
export function filterMicrocycles(
  mesocycles: AssignedMesocycle[],
  selectedMicrocycleIds: string[]
): AssignedMesocycle[] {
  if (selectedMicrocycleIds.length === 0) return mesocycles;
  
  return mesocycles.map(meso => ({
    ...meso,
    microcycles: meso.microcycles.filter(micro => 
      selectedMicrocycleIds.includes(micro.id)
    ),
  })).filter(meso => meso.microcycles.length > 0);
}

/**
 * Recalculates mesocycle dates after filtering microcycles
 * This ensures dates are contiguous based on selected microcycles
 */
export function recalculateMesocycleDates(
  mesocycles: AssignedMesocycle[],
  startDate: Date
): AssignedMesocycle[] {
  let currentDate = startDate;
  
  return mesocycles.map(meso => {
    const totalDays = meso.microcycles.reduce((sum, micro) => sum + micro.duration, 0);
    const mesoStartDate = currentDate;
    const mesoEndDate = addDays(currentDate, totalDays - 1);
    
    const result: AssignedMesocycle = {
      ...meso,
      startDate: format(mesoStartDate, 'yyyy-MM-dd'),
      endDate: format(mesoEndDate, 'yyyy-MM-dd'),
      duration: totalDays,
      weeks: Math.ceil(totalDays / 7),
    };
    
    currentDate = addDays(mesoEndDate, 1);
    return result;
  });
}

/**
 * Shifts all exercise dates to match a new start date
 */
export function shiftExerciseDates(
  exercises: ExerciseDistribution[],
  originalStartDate: Date,
  newStartDate: Date
): ExerciseDistribution[] {
  const dayOffset = calculateDayOffset(originalStartDate, newStartDate);
  if (dayOffset === 0) return exercises;
  
  return exercises.map(ex => ({
    ...ex,
    dayDate: format(addDays(parseISO(ex.dayDate), dayOffset), 'yyyy-MM-dd'),
  }));
}

/**
 * Shifts all daily intensity dates to match a new start date
 */
export function shiftDailyIntensityDates(
  dailyIntensity: DailyIntensity[],
  originalStartDate: Date,
  newStartDate: Date
): DailyIntensity[] {
  const dayOffset = calculateDayOffset(originalStartDate, newStartDate);
  if (dayOffset === 0) return dailyIntensity;
  
  return dailyIntensity.map(di => ({
    ...di,
    date: format(addDays(parseISO(di.date), dayOffset), 'yyyy-MM-dd'),
  }));
}

/**
 * Shifts all session section dates to match a new start date
 */
export function shiftSessionSectionDates(
  sections: SessionSection[],
  originalStartDate: Date,
  newStartDate: Date
): SessionSection[] {
  const dayOffset = calculateDayOffset(originalStartDate, newStartDate);
  if (dayOffset === 0) return sections;
  
  return sections.map(section => ({
    ...section,
    dayDate: format(addDays(parseISO(section.dayDate), dayOffset), 'yyyy-MM-dd'),
  }));
}

/**
 * Shifts all superset date keys to match a new start date
 */
export function shiftSupersetDates(
  supersets: SupersetMapping,
  originalStartDate: Date,
  newStartDate: Date
): SupersetMapping {
  const dayOffset = calculateDayOffset(originalStartDate, newStartDate);
  if (dayOffset === 0) return supersets;
  
  const shifted: SupersetMapping = {};
  
  Object.entries(supersets).forEach(([dateKey, sessionData]) => {
    const newDateKey = format(addDays(parseISO(dateKey), dayOffset), 'yyyy-MM-dd');
    shifted[newDateKey] = sessionData;
  });
  
  return shifted;
}

/**
 * Shifts training days dates to match a new start date
 */
export function shiftTrainingDaysDates(
  trainingDays: any[],
  originalStartDate: Date,
  newStartDate: Date
): any[] {
  const dayOffset = calculateDayOffset(originalStartDate, newStartDate);
  if (dayOffset === 0) return trainingDays;
  
  return trainingDays.map(day => ({
    ...day,
    date: format(addDays(parseISO(day.date), dayOffset), 'yyyy-MM-dd'),
  }));
}

/**
 * Shifts daySplitStates date keys to match a new start date
 */
export function shiftDaySplitStatesDates(
  daySplitStates: Record<string, number>,
  originalStartDate: Date,
  newStartDate: Date
): Record<string, number> {
  const dayOffset = calculateDayOffset(originalStartDate, newStartDate);
  if (dayOffset === 0) return daySplitStates;
  
  const shifted: Record<string, number> = {};
  
  Object.entries(daySplitStates).forEach(([dateKey, value]) => {
    const newDateKey = format(addDays(parseISO(dateKey), dayOffset), 'yyyy-MM-dd');
    shifted[newDateKey] = value;
  });
  
  return shifted;
}
