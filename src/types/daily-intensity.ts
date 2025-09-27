import { IntensityLevel } from './training';

export interface DailyIntensity {
  date: string; // ISO date string (YYYY-MM-DD)
  mesocycleId: string;
  microcycleId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  intensity: IntensityLevel;
  isTestDay: boolean;
  isEventDay: boolean;
}

export interface TrainingDay {
  date: string;
  dayOfWeek: number;
  dayName: string;
  mesocycleId: string;
  microcycleId: string;
  isTestDay: boolean;
  isEventDay: boolean;
}