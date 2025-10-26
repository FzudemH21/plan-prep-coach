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
}

export interface WorkoutSession {
  dayDate: string;
  sessionIndex: number;
  sessionName?: string;
  comments?: string;
  sections: WorkoutSection[];
}

export interface SupersetMapping {
  [dayDate: string]: {
    [sessionIndex: number]: {
      [supersetId: string]: string[]; // array of exerciseIds
    };
  };
}
