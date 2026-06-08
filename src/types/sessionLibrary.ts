import type { SessionSection, ExerciseDistribution } from '@/types/microcycle-planning';

export interface SessionLibraryColumn {
  id: string;
  name: string;
  type: 'text' | 'select' | 'textarea';
  required: boolean;
  options?: string[]; // only for type === 'select'
}

export interface SessionLibraryEntry {
  id: string;
  name: string;
  /** Training method key (may include ::Category suffix) */
  method?: string;
  sections: SessionSection[];
  exercises: ExerciseDistribution[];
  /** Coach-defined custom column values: columnId → value */
  columnValues: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface SessionLibraryData {
  version: '1';
  columns: SessionLibraryColumn[];
  entries: SessionLibraryEntry[];
}
