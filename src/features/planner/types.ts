// Intensity is now the Borg CR10 scale (0–10). Re-exported from central utility.
export type { BorgLevel as Intensity } from "@/utils/intensityScale";

export interface Microcycle {
  id: string;
  name: string;
  duration: number; // days
  intensity: Intensity;
}

export interface Mesocycle {
  id: string;
  name: string;
  weeks: number;
  sessionsPerWeek: number;
  sessionLength: number; // minutes
  microcycles: Microcycle[];
  trainingQualities?: string[];
}

/** A training method as stored on a mesocycle — minimal shape used across the wizard. */
export interface TrainingMethodRef {
  id: string;
  name: string;
  category?: string;
  parentCategory?: string;
}

// Extended interface for the mesocycle page that includes additional properties
export interface ExtendedMesocycle extends Mesocycle {
  startDate: Date;
  endDate: Date;
  duration: number;
  intensity: Intensity;
  trainingMethods: TrainingMethodRef[];
  allocatedSubGoals?: string[];
}

export interface Plan {
  goal: string;
  mesocycles: Mesocycle[];
  qualities: string[];
}
