export interface ExerciseSelection {
  id: string;
  exerciseId: string;
  exerciseName: string;
  library: string; // Allow any library ID including custom ones
  subCategory?: string; // Sub-category like "Frog Tier", "Gazelle Tier", etc.
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
  mainCategory?: string; // Store the main category for grouping
}

export interface MethodCategory {
  categoryName: string;
  methods: TrainingMethodWithCategories[];
}

export type ExerciseLibraryType = 'exercise' | 'plyometrics' | string; // Allow custom library IDs

// Column structure types for the planning table
export type ColumnType = 'mesocycle' | 'microcycle' | 'microcycle-group' | 'link-area';

export interface BaseColumn {
  mesocycleId: string;
  mesocycleName: string;
  id: string;
  colSpan: number;
}

export interface MesocycleColumn extends BaseColumn {
  type: 'mesocycle';
}

export interface MicrocycleColumn extends BaseColumn {
  type: 'microcycle';
  microcycleId: string;
  microcycleName: string;
}

export interface MicrocycleGroupColumn extends BaseColumn {
  type: 'microcycle-group';
  groupId: string;
  groupName: string;
  microcycleIds: string[];
}

export interface LinkAreaColumn extends BaseColumn {
  type: 'link-area';
  microcycleId: string;
  nextMicrocycleId: string;
}

export type TableColumn = MesocycleColumn | MicrocycleColumn | MicrocycleGroupColumn | LinkAreaColumn;