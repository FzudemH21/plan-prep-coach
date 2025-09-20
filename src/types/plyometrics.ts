export interface PlyometricsEntry extends Record<string, string> {
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
  columnDefinitions?: Array<{
    key: string;
    label: string;
    type: 'text' | 'multiline' | 'select';
    options?: string[];
    required?: boolean;
  }>;
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