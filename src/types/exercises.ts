export interface ExerciseEntry {
  id: string;
  übungsname: string;
  akzentuierteKörperregion: string;
  dominantesBewegungsmuster: string;
  forcesActingOnSpine: string;
  übungsausführung: string;
  trunkTrainingFramework: string;
  mainMovementPlane: string;
  level: string;
  artDesWiderstandes: string;
  stand: string;
  variationen: string;
}

export interface ExerciseDatabase {
  exercises: ExerciseEntry[];
  lastUpdated: string;
  version: string;
}

export interface FilterState {
  search: string;
  columnFilters: Record<string, string[]>;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

export interface TableColumn {
  key: keyof ExerciseEntry;
  label: string;
  type: 'text' | 'select' | 'multiline';
  options?: string[];
}