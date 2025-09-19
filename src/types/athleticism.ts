export interface AthleticismEntry {
  id: string;
  overarchingGoal: string;
  subGoal: string;
  quality: string;
  mappedMethods: string[];
  loadingRecommendations: Record<string, any>;
}

export interface AthleticismDatabase {
  entries: AthleticismEntry[];
  lastUpdated: string;
}

export interface AthleticismFilterState {
  search: string;
  columnFilters: Record<string, string[]>;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

export interface AthleticismTableColumn {
  key: 'overarchingGoal' | 'subGoal' | 'quality' | 'method' | 'loadingRecommendations';
  label: string;
  type: 'text' | 'select';
}

export interface FlatAthleticismRow {
  id: string;
  overarchingGoal: string;
  subGoal: string;
  quality: string;
  method: string;
  loadingRecommendations: Record<string, any>;
  originalEntry: AthleticismEntry;
}