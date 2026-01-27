import { differenceInDays, addDays } from 'date-fns';
import { AssignedMesocycle } from '@/types/athlete';

/**
 * Calculates the day offset between original and new start dates
 */
export function calculateDayOffset(originalStartDate: Date, newStartDate: Date): number {
  return differenceInDays(newStartDate, originalStartDate);
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
      startDate: mesoStartDate.toISOString(),
      endDate: mesoEndDate.toISOString(),
      duration: totalDays,
      weeks: Math.ceil(totalDays / 7),
    };
    
    currentDate = addDays(mesoEndDate, 1);
    return result;
  });
}
