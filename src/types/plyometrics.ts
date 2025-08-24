export interface PlyometricsEntry {
  id: string;
  übung: string;
  intensität: string;
  tier: string;
  dauerDVZ: string;
  fokusrichtung: string;
  bewegungsart: string;
  modus: string;
  emphasis: string;
  übungsgruppe: string;
  kommentar: string;
}

export interface PlyometricsDatabase {
  exercises: PlyometricsEntry[];
  lastUpdated: string;
  version: string;
}

export interface PlyometricsFilterState {
  search: string;
  columnFilters: Record<string, string[]>;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

export interface PlyometricsTableColumn {
  key: keyof PlyometricsEntry;
  label: string;
  type: 'text' | 'select' | 'multiline';
  options?: string[];
}