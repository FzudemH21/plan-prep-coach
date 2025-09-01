export type Intensity = "off" | "deload" | "easy" | "easy-moderate" | "moderate" | "moderate-hard" | "hard" | "extremely-hard";

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

// Extended interface for the mesocycle page that includes additional properties
export interface ExtendedMesocycle extends Mesocycle {
  startDate: Date;
  endDate: Date;
  duration: number;
  intensity: Intensity;
  trainingMethods: any[];
  allocatedSubGoals?: string[];
}

export interface Plan {
  goal: string;
  mesocycles: Mesocycle[];
  qualities: string[];
}
