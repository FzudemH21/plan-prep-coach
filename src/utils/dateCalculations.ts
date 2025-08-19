import { addDays, startOfDay } from "date-fns";
import { Mesocycle } from "@/types/training";

export interface MesocycleWithDates extends Mesocycle {
  startDate: Date;
  endDate: Date;
}

/**
 * Calculates start and end dates for all mesocycles
 * Each mesocycle starts immediately after the previous one ends
 */
export function calculateMesocycleDates(
  mesocycles: Mesocycle[], 
  startDate: Date = new Date()
): MesocycleWithDates[] {
  let currentDate = startOfDay(startDate);
  
  return mesocycles.map((mesocycle) => {
    const start = new Date(currentDate);
    const end = addDays(currentDate, (mesocycle.duration * 7) - 1);
    
    // Move current date to start of next mesocycle
    currentDate = addDays(end, 1);
    
    return {
      ...mesocycle,
      startDate: start,
      endDate: end
    };
  });
}

/**
 * Calculates the total duration of all mesocycles in weeks
 */
export function getTotalDuration(mesocycles: Mesocycle[]): number {
  return mesocycles.reduce((sum, meso) => sum + meso.duration, 0);
}

/**
 * Calculates the end date for all mesocycles
 */
export function calculatePlanEndDate(mesocycles: Mesocycle[], startDate: Date = new Date()): Date {
  const totalWeeks = getTotalDuration(mesocycles);
  return addDays(startOfDay(startDate), (totalWeeks * 7) - 1);
}