export interface WorkoutSection {
  id: string;
  name: string;
  order: number;
  exercises: WorkoutExercise[];
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
