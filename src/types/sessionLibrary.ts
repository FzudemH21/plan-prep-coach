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
  /**
   * Parameter values in WorkoutSessionSheet format:
   * [mesocycleId][microcycleIndex][methodId][sessionIndex][exerciseId] → { paramName: value }
   * For library sessions: mesocycleId = entry.id, microcycleIndex = 0, sessionIndex = 0
   */
  parameterValues?: Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>;
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
