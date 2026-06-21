export interface WorkoutSection {
  id: string;
  name: string;
  order: number;
  exercises: WorkoutExercise[];
  comments?: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  order: number;
  supersetId?: string;
  parameters: Record<string, string | number>;
  notes?: string;
  eachSide?: boolean; // Mark exercise as unilateral (perform reps on each side)
  // Source of parameter values: 'toolbox' = use blank grid (ad-hoc), 'periodization' = use program method periodization
  parameterSource?: 'toolbox' | 'periodization';
  // Circuit fields — populated when this item is a circuit block
  isCircuit?: boolean;
  circuitId?: string;
  circuitLibraryId?: string;
  /** Snapshot of circuit exercises at the time of adding to session */
  circuitExercises?: import('@/contexts/CustomLibrariesContext').CircuitExercise[];
  circuitRounds?: string;
  circuitRestBetweenRounds?: string;
  circuitRestBetweenExercises?: string;
  circuitComments?: string;
}

export interface WorkoutSession {
  dayDate: string;
  sessionIndex: number;
  sessionName?: string;
  comments?: string;
  sessionIntensity?: string; // IntensityLevel from training types
  sections: WorkoutSection[];
}

export interface SupersetMapping {
  [dayDate: string]: {
    [sessionIndex: number]: {
      [sectionId: string]: {  // section ID or "__unsectioned__" for session-level
        [supersetId: string]: string[]; // array of exerciseIds
      };
    };
  };
}
