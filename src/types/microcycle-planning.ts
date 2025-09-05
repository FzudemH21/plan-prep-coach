export interface ExerciseSelection {
  id: string;
  exerciseId: string;
  exerciseName: string;
  library: 'exercise' | 'plyometrics' | 'athleticism';
}

export interface CellData {
  methodId: string;
  categoryName?: string;
  mesocycleId: string;
  microcycleId?: string; // undefined when not split
  exercises: ExerciseSelection[];
}

export interface MicrocycleGroup {
  id: string;
  mesocycleId: string;
  microcycleIds: string[];
  name: string;
}

export interface MicrocyclePlanningState {
  cellData: Record<string, CellData>; // keyed by cellId
  splitStates: Record<string, boolean>; // mesocycleId -> isSplit
  microcycleGroups: Record<string, MicrocycleGroup>; // groupId -> group
}

export interface TrainingMethodWithCategories {
  id: string;
  name: string;
  categories: string[];
}

export type ExerciseLibraryType = 'exercise' | 'plyometrics' | 'athleticism';