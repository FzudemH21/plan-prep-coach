export type Intensity = "low" | "moderate" | "high" | "deload";

export interface Microcycle {
  intensity: Intensity;
}

export interface Mesocycle {
  id: string;
  name: string;
  weeks: number;
  sessionsPerWeek: number;
  sessionLength: number; // minutes
  microcycles: Microcycle[];
}

export interface Plan {
  goal: string;
  mesocycles: Mesocycle[];
  qualities: string[];
}
